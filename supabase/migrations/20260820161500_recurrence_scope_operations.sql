begin;

-- Scope operations for recurring series. Each goes through the operation ledger so
-- retries are idempotent and a stale client version can never silently overwrite.
-- Completed occurrences are never rewritten: skip records an exception, editing
-- future occurrences opens a new rule version, and stopping only closes the series.

create or replace function public.skip_recurring_occurrence_v2(
  p_user_id uuid,
  p_task_id uuid,
  p_expected_version bigint,
  p_op_id uuid,
  p_idempotency_key text,
  p_next_due timestamptz,
  p_next_recurrence jsonb,
  p_occurrence_key text,
  p_calculator_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task public.tasks%rowtype;
  v_series public.task_recurrence_series%rowtype;
  v_updated public.tasks%rowtype;
  v_claim jsonb;
begin
  if p_calculator_version <> 'tehran-jalali-v1' then raise exception 'unsupported_recurrence_calculator'; end if;
  if p_next_due is null or jsonb_typeof(coalesce(p_next_recurrence, 'null'::jsonb)) <> 'object' then
    raise exception 'invalid_next_occurrence';
  end if;
  if p_occurrence_key is distinct from to_char(p_next_due at time zone 'Asia/Tehran', 'YYYY-MM-DD:HH24:MI:SS') then
    raise exception 'invalid_occurrence_key';
  end if;

  v_claim := public.claim_mutation_operation(
    p_op_id, p_user_id, 'skip_recurring_occurrence', p_idempotency_key,
    'recurrence', p_task_id, p_expected_version, '{}'::uuid[],
    jsonb_build_object('taskId', p_task_id, 'nextDue', p_next_due, 'occurrenceKey', p_occurrence_key)
  );
  if coalesce((v_claim->>'claimed')::boolean, false) = false then return v_claim; end if;

  select * into v_task from public.tasks where id = p_task_id and user_id = p_user_id for update;
  if not found then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', null, null, 'not_found', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_found', 'operationId', p_op_id);
  end if;
  if v_task.version is distinct from p_expected_version then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'conflict', v_task.version, null, 'version_conflict', '{}'::jsonb);
    return jsonb_build_object('status', 'conflict', 'errorCode', 'version_conflict', 'operationId', p_op_id, 'server', to_jsonb(v_task));
  end if;
  if v_task.recurrence is null then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'not_recurring', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_recurring', 'operationId', p_op_id);
  end if;
  if v_task.status = 'done' then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'already_applied', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'already_applied', 'operationId', p_op_id);
  end if;
  if v_task.due_date is not null and p_next_due <= v_task.due_date then raise exception 'next_occurrence_not_later'; end if;

  if v_task.recurrence_series_id is null then
    v_task.recurrence_series_id := gen_random_uuid();
  end if;

  insert into public.task_recurrence_series (id, user_id, rule, calculator_version, rule_version, status, anchor_due)
  values (v_task.recurrence_series_id, p_user_id, v_task.recurrence, p_calculator_version,
          coalesce(v_task.recurrence_rule_version, 1), 'active', v_task.due_date)
  on conflict (id) do update set rule = excluded.rule, updated_at = now()
  where task_recurrence_series.user_id = excluded.user_id
  returning * into v_series;
  if v_series.id is null then raise exception 'recurrence_series_owner_mismatch'; end if;
  if v_series.status <> 'active' then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'series_stopped', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'series_stopped', 'operationId', p_op_id);
  end if;

  -- The skipped slot is recorded as an exception, then the same row advances to the
  -- next slot. A skip is deliberately not a completion.
  insert into public.task_recurrence_exceptions (user_id, series_id, occurrence_key, kind, payload)
  values (
    p_user_id, v_series.id,
    coalesce(v_task.recurrence_occurrence_key,
             to_char(coalesce(v_task.due_date, now()) at time zone 'Asia/Tehran', 'YYYY-MM-DD:HH24:MI:SS')),
    'skip',
    jsonb_build_object('taskId', v_task.id, 'skippedDue', v_task.due_date)
  )
  on conflict (user_id, series_id, occurrence_key, kind) do nothing;

  update public.tasks set
    due_date = p_next_due,
    recurrence = p_next_recurrence,
    recurrence_series_id = v_series.id,
    recurrence_occurrence_key = p_occurrence_key,
    recurrence_sequence = coalesce(recurrence_sequence, 0) + 1,
    recurrence_status = 'active',
    recurrence_rule_version = v_series.rule_version,
    recurrence_calculator_version = p_calculator_version
  where id = v_task.id and user_id = p_user_id
  returning * into v_updated;

  perform public.finalize_mutation_operation(
    p_op_id, p_user_id, 'succeeded', v_updated.version,
    jsonb_build_object('taskId', v_updated.id, 'occurrenceKey', p_occurrence_key), null, null
  );
  return jsonb_build_object('status', 'succeeded', 'operationId', p_op_id, 'task', to_jsonb(v_updated));
end;
$function$;

create or replace function public.stop_recurring_series_v2(
  p_user_id uuid,
  p_task_id uuid,
  p_expected_version bigint,
  p_op_id uuid,
  p_idempotency_key text,
  p_keep_current boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task public.tasks%rowtype;
  v_series_id uuid;
  v_claim jsonb;
  v_cleared integer := 0;
begin
  v_claim := public.claim_mutation_operation(
    p_op_id, p_user_id, 'stop_recurring_series', p_idempotency_key,
    'recurrence', p_task_id, p_expected_version, '{}'::uuid[],
    jsonb_build_object('taskId', p_task_id, 'keepCurrent', p_keep_current)
  );
  if coalesce((v_claim->>'claimed')::boolean, false) = false then return v_claim; end if;

  select * into v_task from public.tasks where id = p_task_id and user_id = p_user_id for update;
  if not found then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', null, null, 'not_found', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_found', 'operationId', p_op_id);
  end if;
  if v_task.version is distinct from p_expected_version then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'conflict', v_task.version, null, 'version_conflict', '{}'::jsonb);
    return jsonb_build_object('status', 'conflict', 'errorCode', 'version_conflict', 'operationId', p_op_id, 'server', to_jsonb(v_task));
  end if;
  v_series_id := v_task.recurrence_series_id;
  if v_series_id is null then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'not_recurring', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_recurring', 'operationId', p_op_id);
  end if;

  update public.task_recurrence_series
  set status = 'stopped', stopped_at = now(), updated_at = now()
  where id = v_series_id and user_id = p_user_id;

  -- Completed occurrences keep their history. Open ones stop repeating; the current
  -- one is cancelled only when the user asked not to keep it.
  with cleared as (
    update public.tasks set
      recurrence = null,
      recurrence_status = case
        when id = v_task.id and p_keep_current then 'active'
        when id = v_task.id then 'cancelled'
        else 'cancelled'
      end,
      status = case when id = v_task.id and not p_keep_current then 'done' else status end,
      completed_at = case when id = v_task.id and not p_keep_current then now() else completed_at end
    where user_id = p_user_id and recurrence_series_id = v_series_id and status <> 'done'
    returning id
  ) select count(*) into v_cleared from cleared;

  perform public.finalize_mutation_operation(
    p_op_id, p_user_id, 'succeeded', null,
    jsonb_build_object('seriesId', v_series_id, 'clearedCount', v_cleared), null, null
  );
  return jsonb_build_object('status', 'succeeded', 'operationId', p_op_id, 'seriesId', v_series_id, 'clearedCount', v_cleared);
end;
$function$;

create or replace function public.edit_recurring_series_v2(
  p_user_id uuid,
  p_task_id uuid,
  p_expected_version bigint,
  p_op_id uuid,
  p_idempotency_key text,
  p_scope text,
  p_updates jsonb,
  p_recurrence jsonb default null,
  p_calculator_version text default 'tehran-jalali-v1'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task public.tasks%rowtype;
  v_series public.task_recurrence_series%rowtype;
  v_updated public.tasks%rowtype;
  v_claim jsonb;
  v_future integer := 0;
  v_allowed text[] := array['title', 'description', 'priority', 'project_id', 'tags', 'checklist', 'due_date'];
  v_key text;
begin
  if p_scope not in ('current', 'future') then raise exception 'invalid_recurrence_scope'; end if;
  if jsonb_typeof(coalesce(p_updates, 'null'::jsonb)) <> 'object' then raise exception 'invalid_updates'; end if;
  if p_scope = 'future' and p_recurrence is not null and jsonb_typeof(p_recurrence) <> 'object' then
    raise exception 'invalid_recurrence';
  end if;
  for v_key in select jsonb_object_keys(p_updates) loop
    if not (v_key = any(v_allowed)) then raise exception 'field_not_editable'; end if;
  end loop;

  v_claim := public.claim_mutation_operation(
    p_op_id, p_user_id, 'edit_recurring_series_' || p_scope, p_idempotency_key,
    'recurrence', p_task_id, p_expected_version, '{}'::uuid[],
    jsonb_build_object('taskId', p_task_id, 'scope', p_scope, 'updates', p_updates, 'recurrence', p_recurrence)
  );
  if coalesce((v_claim->>'claimed')::boolean, false) = false then return v_claim; end if;

  select * into v_task from public.tasks where id = p_task_id and user_id = p_user_id for update;
  if not found then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', null, null, 'not_found', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_found', 'operationId', p_op_id);
  end if;
  if v_task.version is distinct from p_expected_version then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'conflict', v_task.version, null, 'version_conflict', '{}'::jsonb);
    return jsonb_build_object('status', 'conflict', 'errorCode', 'version_conflict', 'operationId', p_op_id, 'server', to_jsonb(v_task));
  end if;

  update public.tasks set
    title = coalesce(p_updates->>'title', title),
    description = case when p_updates ? 'description' then p_updates->>'description' else description end,
    priority = coalesce(p_updates->>'priority', priority),
    project_id = case when p_updates ? 'project_id' then (p_updates->>'project_id')::uuid else project_id end,
    due_date = case when p_updates ? 'due_date' then (p_updates->>'due_date')::timestamptz else due_date end,
    tags = case when jsonb_typeof(p_updates->'tags') = 'array'
      then array(select jsonb_array_elements_text(p_updates->'tags')) else tags end,
    checklist = case when jsonb_typeof(p_updates->'checklist') = 'array'
      then p_updates->'checklist' else checklist end,
    recurrence = case when p_scope = 'future' and p_recurrence is not null then p_recurrence else recurrence end,
    recurrence_calculator_version = case when p_scope = 'future' then p_calculator_version
      else recurrence_calculator_version end
  where id = v_task.id and user_id = p_user_id
  returning * into v_updated;

  if p_scope = 'future' and v_task.recurrence_series_id is not null then
    select * into v_series from public.task_recurrence_series
    where id = v_task.recurrence_series_id and user_id = p_user_id for update;
    if found then
      update public.task_recurrence_series set
        rule = coalesce(p_recurrence, rule),
        rule_version = rule_version + 1,
        calculator_version = p_calculator_version,
        updated_at = now()
      where id = v_series.id
      returning * into v_series;

      -- Only occurrences strictly after this one change. Completed history is untouched.
      with fanned as (
        update public.tasks set
          recurrence = coalesce(p_recurrence, recurrence),
          recurrence_rule_version = v_series.rule_version,
          recurrence_calculator_version = p_calculator_version
        where user_id = p_user_id
          and recurrence_series_id = v_series.id
          and status <> 'done'
          and id <> v_task.id
          and (v_task.due_date is null or due_date > v_task.due_date)
        returning id
      ) select count(*) into v_future from fanned;
    end if;
  end if;

  perform public.finalize_mutation_operation(
    p_op_id, p_user_id, 'succeeded', v_updated.version,
    jsonb_build_object('taskId', v_updated.id, 'scope', p_scope, 'futureUpdated', v_future), null, null
  );
  return jsonb_build_object(
    'status', 'succeeded', 'operationId', p_op_id, 'scope', p_scope,
    'futureUpdated', v_future, 'task', to_jsonb(v_updated)
  );
end;
$function$;

revoke all on function public.skip_recurring_occurrence_v2(uuid, uuid, bigint, uuid, text, timestamptz, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.stop_recurring_series_v2(uuid, uuid, bigint, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.edit_recurring_series_v2(uuid, uuid, bigint, uuid, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.skip_recurring_occurrence_v2(uuid, uuid, bigint, uuid, text, timestamptz, jsonb, text, text) to service_role;
grant execute on function public.stop_recurring_series_v2(uuid, uuid, bigint, uuid, text, boolean) to service_role;
grant execute on function public.edit_recurring_series_v2(uuid, uuid, bigint, uuid, text, text, jsonb, jsonb, text) to service_role;

commit;
