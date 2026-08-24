begin;

-- Two defects found by production smoke:
--   1. stop_recurring_series_v2 rejected tasks that carry a rule but no series id
--      (legacy rows), leaving the user unable to stop repeating at all.
--   2. edit_recurring_series_v2 with scope 'future' rewrote the anchor row even when
--      it was already completed, and fanned out only the rule -- not the field
--      updates -- so "this and future" silently failed to change future occurrences.

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

  -- A rule with no series id still repeats from the client's perspective, so it must
  -- be stoppable. Adopt a series id rather than refusing the request.
  if v_task.recurrence is null and v_task.recurrence_series_id is null then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'not_recurring', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_recurring', 'operationId', p_op_id);
  end if;
  v_series_id := coalesce(v_task.recurrence_series_id, gen_random_uuid());

  insert into public.task_recurrence_series (id, user_id, rule, calculator_version, rule_version, status, anchor_due, stopped_at)
  values (v_series_id, p_user_id, coalesce(v_task.recurrence, '{}'::jsonb), 'tehran-jalali-v1',
          coalesce(v_task.recurrence_rule_version, 1), 'stopped', v_task.due_date, now())
  on conflict (id) do update set status = 'stopped', stopped_at = now(), updated_at = now()
  where task_recurrence_series.user_id = excluded.user_id;

  with cleared as (
    update public.tasks set
      recurrence = null,
      recurrence_series_id = v_series_id,
      recurrence_status = case
        when id = v_task.id and p_keep_current then 'active'
        else 'cancelled'
      end,
      status = case when id = v_task.id and not p_keep_current then 'done' else status end,
      completed_at = case when id = v_task.id and not p_keep_current then now() else completed_at end
    where user_id = p_user_id
      and status <> 'done'
      and (recurrence_series_id = v_series_id or id = v_task.id)
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
  v_anchor_due timestamptz;
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

  -- Editing a single occurrence requires that occurrence to still be open.
  if p_scope = 'current' and v_task.status = 'done' then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'already_applied', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'already_applied', 'operationId', p_op_id);
  end if;

  v_anchor_due := v_task.due_date;

  -- The anchor row is only rewritten when it is still open. A completed occurrence
  -- stays exactly as the user left it.
  if v_task.status <> 'done' then
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
  else
    v_updated := v_task;
  end if;

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

      -- Future open occurrences receive the same field updates as the anchor, plus
      -- the new rule. Completed occurrences are excluded.
      with fanned as (
        update public.tasks set
          title = coalesce(p_updates->>'title', title),
          description = case when p_updates ? 'description' then p_updates->>'description' else description end,
          priority = coalesce(p_updates->>'priority', priority),
          project_id = case when p_updates ? 'project_id' then (p_updates->>'project_id')::uuid else project_id end,
          tags = case when jsonb_typeof(p_updates->'tags') = 'array'
            then array(select jsonb_array_elements_text(p_updates->'tags')) else tags end,
          checklist = case when jsonb_typeof(p_updates->'checklist') = 'array'
            then p_updates->'checklist' else checklist end,
          recurrence = coalesce(p_recurrence, recurrence),
          recurrence_rule_version = v_series.rule_version,
          recurrence_calculator_version = p_calculator_version
        where user_id = p_user_id
          and recurrence_series_id = v_series.id
          and status <> 'done'
          and id <> v_task.id
          and (v_anchor_due is null or due_date is null or due_date >= v_anchor_due)
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
    'futureUpdated', v_future, 'anchorRewritten', v_task.status <> 'done',
    'task', (select to_jsonb(t) from public.tasks t where t.id = v_updated.id)
  );
end;
$function$;

revoke all on function public.stop_recurring_series_v2(uuid, uuid, bigint, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.edit_recurring_series_v2(uuid, uuid, bigint, uuid, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.stop_recurring_series_v2(uuid, uuid, bigint, uuid, text, boolean) to service_role;
grant execute on function public.edit_recurring_series_v2(uuid, uuid, bigint, uuid, text, text, jsonb, jsonb, text) to service_role;

commit;
