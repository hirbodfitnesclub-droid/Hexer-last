begin;

-- Compound recurrence receipts identify both the completed occurrence and the
-- successor created by that operation. Provenance is explicit rather than inferred
-- from service_role, since every caller of these RPCs uses that database role.
alter table public.agent_action_receipts
  add column if not exists provenance text not null default 'legacy',
  add column if not exists compound_entity_type text,
  add column if not exists compound_entity_id uuid,
  add column if not exists compound_entity_version bigint,
  add column if not exists undo_result jsonb;

alter table public.agent_action_receipts
  drop constraint if exists agent_action_receipts_provenance_check,
  add constraint agent_action_receipts_provenance_check
    check (provenance in ('legacy', 'user', 'ai', 'system')),
  drop constraint if exists agent_action_receipts_compound_entity_check,
  add constraint agent_action_receipts_compound_entity_check check (
    (compound_entity_type is null and compound_entity_id is null and compound_entity_version is null)
    or
    (compound_entity_type = 'task' and compound_entity_id is not null and compound_entity_version > 0)
  ),
  drop constraint if exists agent_action_receipts_undo_result_check,
  add constraint agent_action_receipts_undo_result_check
    check (undo_result is null or jsonb_typeof(undo_result) = 'object'),
  drop constraint if exists agent_action_receipts_undo_kind_check,
  add constraint agent_action_receipts_undo_kind_check check (undo_kind in (
    'delete_created', 'restore_updated', 'restore_deleted', 'delete_link', 'restore_link',
    'delete_habit_completion', 'restore_habit_completion', 'restore_recurring_completion'
  ));

create index if not exists agent_action_receipts_compound_entity_idx
  on public.agent_action_receipts (user_id, compound_entity_type, compound_entity_id)
  where compound_entity_id is not null;

create or replace function public.complete_recurring_task_v3(
  p_user_id uuid,
  p_task_id uuid,
  p_expected_version bigint,
  p_op_id uuid,
  p_idempotency_key text,
  p_next_due timestamptz,
  p_next_recurrence jsonb,
  p_occurrence_key text,
  p_calculator_version text,
  p_is_terminal boolean default false,
  p_provenance text default 'user',
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task public.tasks%rowtype;
  v_completed public.tasks%rowtype;
  v_series public.task_recurrence_series%rowtype;
  v_next public.tasks%rowtype;
  v_claim jsonb;
  v_result jsonb;
  v_request_payload jsonb;
  v_series_before jsonb;
  v_expected_key text;
  v_series_id uuid;
  v_next_id uuid := gen_random_uuid();
  v_receipt_id uuid;
  v_receipt_expires_at timestamptz;
  v_next_created boolean := false;
  v_series_created boolean := false;
begin
  if p_user_id is null or p_task_id is null or p_op_id is null
    or p_expected_version is null or p_is_terminal is null then
    raise exception 'invalid_recurrence_request';
  end if;
  if p_provenance is null or p_provenance not in ('user', 'ai', 'system') then
    raise exception 'invalid_recurrence_provenance';
  end if;
  if p_provenance = 'ai' and p_request_id is null then
    raise exception 'ai_request_id_required';
  end if;
  if p_calculator_version <> 'tehran-jalali-v1' then
    raise exception 'unsupported_recurrence_calculator';
  end if;
  if p_is_terminal then
    if p_next_due is not null or p_next_recurrence is not null or p_occurrence_key is not null then
      raise exception 'terminal_completion_has_next';
    end if;
  else
    if p_next_due is null
      or p_next_recurrence is null
      or jsonb_typeof(p_next_recurrence) <> 'object'
      or p_occurrence_key is null then
      raise exception 'invalid_next_occurrence';
    end if;
    v_expected_key := to_char(p_next_due at time zone 'Asia/Tehran', 'YYYY-MM-DD:HH24:MI:SS');
    if p_occurrence_key is distinct from v_expected_key then
      raise exception 'invalid_occurrence_key';
    end if;
  end if;

  v_request_payload := jsonb_build_object(
    'taskId', p_task_id,
    'isTerminal', p_is_terminal,
    'nextDue', p_next_due,
    'nextRecurrence', p_next_recurrence,
    'occurrenceKey', p_occurrence_key,
    'calculatorVersion', p_calculator_version,
    'provenance', p_provenance,
    'requestId', p_request_id
  );

  v_claim := public.claim_mutation_operation(
    p_op_id, p_user_id, 'complete_recurring_task_v3', p_idempotency_key,
    'recurrence', p_task_id, p_expected_version, '{}'::uuid[], v_request_payload
  );
  if coalesce((v_claim->>'claimed')::boolean, false) = false then
    -- A finalized operation replays the exact same top-level document returned by
    -- the first execution, not the claim helper's nested { result: ... } envelope.
    if v_claim->'result' is not null and jsonb_typeof(v_claim->'result') <> 'null' then
      return v_claim->'result';
    end if;
    return v_claim - 'claimed' - 'result';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id and user_id = p_user_id
  for update;

  if not found then
    v_result := jsonb_build_object(
      'status', 'failed', 'operationId', p_op_id, 'errorCode', 'not_found'
    );
    perform public.finalize_mutation_operation(
      p_op_id, p_user_id, 'failed', null, v_result, 'not_found', '{}'::jsonb
    );
    return v_result;
  end if;
  if v_task.version is distinct from p_expected_version then
    v_result := jsonb_build_object(
      'status', 'conflict', 'operationId', p_op_id, 'errorCode', 'version_conflict',
      'expectedVersion', p_expected_version, 'serverVersion', v_task.version,
      'server', to_jsonb(v_task)
    );
    perform public.finalize_mutation_operation(
      p_op_id, p_user_id, 'conflict', v_task.version, v_result, 'version_conflict',
      jsonb_build_object('expectedVersion', p_expected_version, 'serverVersion', v_task.version)
    );
    return v_result;
  end if;
  if v_task.status = 'done' then
    v_result := jsonb_build_object(
      'status', 'failed', 'operationId', p_op_id, 'errorCode', 'already_applied'
    );
    perform public.finalize_mutation_operation(
      p_op_id, p_user_id, 'failed', v_task.version, v_result, 'already_applied', '{}'::jsonb
    );
    return v_result;
  end if;
  if v_task.recurrence is null then
    v_result := jsonb_build_object(
      'status', 'failed', 'operationId', p_op_id, 'errorCode', 'not_recurring'
    );
    perform public.finalize_mutation_operation(
      p_op_id, p_user_id, 'failed', v_task.version, v_result, 'not_recurring', '{}'::jsonb
    );
    return v_result;
  end if;
  if not p_is_terminal and v_task.due_date is not null and p_next_due <= v_task.due_date then
    raise exception 'next_occurrence_not_later';
  end if;

  v_series_id := coalesce(v_task.recurrence_series_id, gen_random_uuid());
  select * into v_series
  from public.task_recurrence_series
  where id = v_series_id
  for update;

  if found then
    if v_series.user_id <> p_user_id then
      raise exception 'recurrence_series_owner_mismatch';
    end if;
    if v_series.status <> 'active' then
      v_result := jsonb_build_object(
        'status', 'failed', 'operationId', p_op_id, 'errorCode', 'series_stopped'
      );
      perform public.finalize_mutation_operation(
        p_op_id, p_user_id, 'failed', v_task.version, v_result, 'series_stopped', '{}'::jsonb
      );
      return v_result;
    end if;
    v_series_before := to_jsonb(v_series);
    update public.task_recurrence_series
    set rule = v_task.recurrence,
        calculator_version = p_calculator_version,
        status = case when p_is_terminal then 'stopped' else status end,
        stopped_at = case when p_is_terminal then now() else stopped_at end,
        updated_at = now()
    where id = v_series_id and user_id = p_user_id
    returning * into v_series;
  else
    v_series_created := true;
    insert into public.task_recurrence_series (
      id, user_id, rule, calculator_version, rule_version, status, anchor_due, stopped_at
    ) values (
      v_series_id, p_user_id, v_task.recurrence, p_calculator_version,
      coalesce(v_task.recurrence_rule_version, 1),
      case when p_is_terminal then 'stopped' else 'active' end,
      v_task.due_date, case when p_is_terminal then now() else null end
    ) returning * into v_series;
  end if;

  if not p_is_terminal then
    -- Serialize contenders for one logical occurrence before checking/inserting it.
    -- This also lets AI fail before mutating the current task when the successor was
    -- created by another operation and therefore cannot be safely owned by its Undo.
    perform pg_advisory_xact_lock(hashtextextended(
      p_user_id::text || ':' || v_series.id::text || ':' || p_occurrence_key,
      0
    ));

    select * into v_next
    from public.tasks
    where user_id = p_user_id
      and recurrence_series_id = v_series.id
      and recurrence_occurrence_key = p_occurrence_key;

    if found and p_provenance = 'ai' then
      v_result := jsonb_build_object(
        'status', 'conflict', 'operationId', p_op_id,
        'errorCode', 'successor_already_exists', 'serverNext', to_jsonb(v_next)
      );
      perform public.finalize_mutation_operation(
        p_op_id, p_user_id, 'conflict', v_task.version, v_result,
        'successor_already_exists', '{}'::jsonb
      );
      return v_result;
    end if;

    if not found then
    insert into public.tasks (
      id, user_id, project_id, title, description, status, priority, due_date, completed_at,
      tags, checklist, recurrence, recurrence_series_id, recurrence_occurrence_key,
      recurrence_sequence, recurrence_status, recurrence_rule_version,
      recurrence_calculator_version, created_at, updated_at
    ) values (
      v_next_id, p_user_id, v_task.project_id, v_task.title, v_task.description, 'todo',
      v_task.priority, p_next_due, null, v_task.tags,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', gen_random_uuid(), 'text', item->>'text', 'isCompleted', false
      )) from jsonb_array_elements(
        case when jsonb_typeof(v_task.checklist) = 'array' then v_task.checklist else '[]'::jsonb end
      ) item), '[]'::jsonb),
      p_next_recurrence, v_series.id, p_occurrence_key,
      coalesce(v_task.recurrence_sequence, 0) + 1, 'active', v_series.rule_version,
      p_calculator_version, now(), now()
    )
    on conflict (user_id, recurrence_series_id, recurrence_occurrence_key)
      where recurrence_series_id is not null and recurrence_occurrence_key is not null
    do nothing
    returning * into v_next;

    if v_next.id is not null then
      v_next_created := true;
    else
      select * into v_next
      from public.tasks
      where user_id = p_user_id
        and recurrence_series_id = v_series.id
        and recurrence_occurrence_key = p_occurrence_key;
      if not found then
        raise exception 'next_occurrence_readback_failed';
      end if;
    end if;
    end if;
  end if;

  update public.tasks
  set status = 'done',
      completed_at = now(),
      recurrence = case when p_is_terminal then null else recurrence end,
      recurrence_series_id = v_series.id,
      recurrence_status = 'completed',
      recurrence_rule_version = v_series.rule_version,
      recurrence_calculator_version = p_calculator_version
  where id = v_task.id and user_id = p_user_id and version = p_expected_version
  returning * into v_completed;

  if v_completed.id is null then
    raise exception 'task_version_ownership_lost';
  end if;

  -- Existing successors are never claimed as this operation's work. Therefore an AI
  -- receipt is emitted only for a terminal completion or a successor inserted above.
  if p_provenance = 'ai' and (p_is_terminal or v_next_created) then
    insert into public.agent_action_receipts (
      user_id, request_id, action, entity_type, entity_id, before_state, after_state,
      undo_kind, operation_id, entity_version_before, entity_version_after, provenance,
      compound_entity_type, compound_entity_id, compound_entity_version
    ) values (
      p_user_id, p_request_id, 'COMPLETE_RECURRING_TASK', 'task', v_task.id,
      to_jsonb(v_task),
      jsonb_build_object(
        'completedTaskId', v_completed.id,
        'completedTaskVersion', v_completed.version,
        'terminal', p_is_terminal,
        'nextCreatedByOperation', v_next_created,
        'seriesId', v_series.id,
        'seriesCreatedByOperation', v_series_created,
        'seriesDeleteOnUndo', v_series_created and v_task.recurrence_series_id is null,
        'seriesBefore', v_series_before,
        'seriesUpdatedAt', v_series.updated_at
      ),
      'restore_recurring_completion', p_op_id, v_task.version, v_completed.version, 'ai',
      case when v_next_created then 'task' else null end,
      case when v_next_created then v_next.id else null end,
      case when v_next_created then v_next.version else null end
    ) returning id, expires_at into v_receipt_id, v_receipt_expires_at;
  end if;

  v_result := jsonb_build_object(
    'status', 'succeeded',
    'operationId', p_op_id,
    'terminal', p_is_terminal,
    'current', to_jsonb(v_completed),
    'next', case when p_is_terminal then 'null'::jsonb else to_jsonb(v_next) end,
    'nextCreatedByOperation', v_next_created,
    'receiptId', v_receipt_id,
    'undoExpiresAt', v_receipt_expires_at
  );

  perform public.finalize_mutation_operation(
    p_op_id, p_user_id, 'succeeded', v_completed.version, v_result, null, null
  );
  return v_result;
end;
$function$;

create or replace function public.undo_agent_action(
  p_receipt_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_receipt public.agent_action_receipts%rowtype;
  v_result jsonb;
  v_response jsonb;
  v_undone_at timestamptz;
  v_task public.tasks%rowtype;
  v_next public.tasks%rowtype;
  v_note public.notes%rowtype;
  v_project public.projects%rowtype;
  v_habit public.habits%rowtype;
  v_reminder public.reminders%rowtype;
begin
  if p_receipt_id is null or p_user_id is null then
    raise exception 'Invalid undo request';
  end if;

  select * into v_receipt
  from public.agent_action_receipts
  where id = p_receipt_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Undo receipt not found'; end if;
  if v_receipt.undone_at is not null then
    return coalesce(v_receipt.undo_result, jsonb_build_object(
        'receiptId', v_receipt.id, 'entityType', v_receipt.entity_type,
        'entityId', v_receipt.entity_id, 'undoKind', v_receipt.undo_kind,
        'undoneAt', v_receipt.undone_at
      )) || jsonb_build_object('replayed', true);
  end if;
  if v_receipt.expires_at <= now() then raise exception 'Undo receipt expired'; end if;

  if v_receipt.undo_kind = 'restore_recurring_completion' then
    if v_receipt.entity_type <> 'task'
      or v_receipt.entity_version_before is null
      or v_receipt.entity_version_after is null
      or v_receipt.operation_id is null
      or v_receipt.provenance <> 'ai' then
      raise exception 'Invalid recurring completion receipt';
    end if;

    select * into v_task
    from public.tasks
    where id = v_receipt.entity_id and user_id = p_user_id
    for update;
    if not found then raise exception 'Completed task no longer exists'; end if;
    if v_task.version is distinct from v_receipt.entity_version_after then
      raise exception 'Completed task changed after receipt';
    end if;

    if v_receipt.compound_entity_id is not null then
      select * into v_next
      from public.tasks
      where id = v_receipt.compound_entity_id and user_id = p_user_id
      for update;
      if not found then raise exception 'Created next occurrence no longer exists'; end if;
      if v_next.version is distinct from v_receipt.compound_entity_version then
        raise exception 'Created next occurrence changed after receipt';
      end if;
      delete from public.tasks
      where id = v_receipt.compound_entity_id
        and user_id = p_user_id
        and version = v_receipt.compound_entity_version;
      if not found then raise exception 'Created next occurrence changed during undo'; end if;
    end if;

    update public.tasks set
      status = v_receipt.before_state->>'status',
      completed_at = (v_receipt.before_state->>'completed_at')::timestamptz,
       recurrence = case
         when v_receipt.before_state ? 'recurrence'
           and jsonb_typeof(v_receipt.before_state->'recurrence') <> 'null'
         then v_receipt.before_state->'recurrence'
         else null
       end,
      recurrence_series_id = (v_receipt.before_state->>'recurrence_series_id')::uuid,
      recurrence_occurrence_key = v_receipt.before_state->>'recurrence_occurrence_key',
      recurrence_sequence = coalesce((v_receipt.before_state->>'recurrence_sequence')::integer, 0),
      recurrence_status = coalesce(v_receipt.before_state->>'recurrence_status', 'active'),
      recurrence_rule_version = (v_receipt.before_state->>'recurrence_rule_version')::bigint,
      recurrence_calculator_version = v_receipt.before_state->>'recurrence_calculator_version',
      updated_at = now()
    where id = v_receipt.entity_id
      and user_id = p_user_id
      and version = v_receipt.entity_version_after
    returning * into v_task;
    if not found then raise exception 'Completed task changed during undo'; end if;

    if coalesce((v_receipt.after_state->>'seriesDeleteOnUndo')::boolean, false) then
      delete from public.task_recurrence_series
      where id = (v_receipt.after_state->>'seriesId')::uuid
        and user_id = p_user_id
        and updated_at = (v_receipt.after_state->>'seriesUpdatedAt')::timestamptz
        and not exists (
          select 1 from public.tasks
          where recurrence_series_id = (v_receipt.after_state->>'seriesId')::uuid
        );
      if not found then raise exception 'Created recurrence series is still in use'; end if;
    elsif not coalesce((v_receipt.after_state->>'seriesCreatedByOperation')::boolean, false) then
      update public.task_recurrence_series
      set rule = v_receipt.after_state->'seriesBefore'->'rule',
          calculator_version = v_receipt.after_state->'seriesBefore'->>'calculator_version',
          rule_version = (v_receipt.after_state->'seriesBefore'->>'rule_version')::bigint,
          status = v_receipt.after_state->'seriesBefore'->>'status',
          anchor_due = (v_receipt.after_state->'seriesBefore'->>'anchor_due')::timestamptz,
          stopped_at = (v_receipt.after_state->'seriesBefore'->>'stopped_at')::timestamptz,
          updated_at = now()
      where id = (v_receipt.after_state->>'seriesId')::uuid
        and user_id = p_user_id
        and updated_at = (v_receipt.after_state->>'seriesUpdatedAt')::timestamptz;
      if not found then raise exception 'Recurrence series no longer exists'; end if;
    end if;

    update public.mutation_operations
    set status = 'compensated', updated_at = now()
    where op_id = v_receipt.operation_id
      and user_id = p_user_id
      and status = 'succeeded';

    v_result := jsonb_build_object(
      'current', to_jsonb(v_task),
      'deletedNextId', v_receipt.compound_entity_id,
      'operationId', v_receipt.operation_id
    );

  elsif v_receipt.undo_kind = 'delete_created' then
    if v_receipt.entity_type = 'task' then
      delete from public.tasks where id = v_receipt.entity_id and user_id = p_user_id returning to_jsonb(tasks.*) into v_result;
    elsif v_receipt.entity_type = 'note' then
      delete from public.notes where id = v_receipt.entity_id and user_id = p_user_id returning to_jsonb(notes.*) into v_result;
    elsif v_receipt.entity_type = 'project' then
      delete from public.projects where id = v_receipt.entity_id and user_id = p_user_id returning to_jsonb(projects.*) into v_result;
    elsif v_receipt.entity_type = 'habit' then
      delete from public.habits where id = v_receipt.entity_id and user_id = p_user_id returning to_jsonb(habits.*) into v_result;
    elsif v_receipt.entity_type = 'reminder' then
      delete from public.reminders where id = v_receipt.entity_id and user_id = p_user_id returning to_jsonb(reminders.*) into v_result;
    else
      raise exception 'Unsupported created entity undo';
    end if;
    if v_result is null then raise exception 'Created entity no longer exists'; end if;

  elsif v_receipt.undo_kind = 'restore_updated' then
    if v_receipt.entity_type = 'task' then
      update public.tasks set
        project_id = (v_receipt.before_state->>'project_id')::uuid,
        title = v_receipt.before_state->>'title', description = v_receipt.before_state->>'description',
        status = v_receipt.before_state->>'status', priority = v_receipt.before_state->>'priority',
        due_date = (v_receipt.before_state->>'due_date')::timestamptz,
        completed_at = (v_receipt.before_state->>'completed_at')::timestamptz,
        tags = case when jsonb_typeof(v_receipt.before_state->'tags') = 'array' then array(select jsonb_array_elements_text(v_receipt.before_state->'tags')) else null end,
        checklist = case when jsonb_typeof(v_receipt.before_state->'checklist') = 'array' then v_receipt.before_state->'checklist' else '[]'::jsonb end,
        updated_at = now()
      where id = v_receipt.entity_id and user_id = p_user_id returning * into v_task;
      v_result := to_jsonb(v_task);
    elsif v_receipt.entity_type = 'note' then
      update public.notes set
        project_id = (v_receipt.before_state->>'project_id')::uuid,
        title = v_receipt.before_state->>'title', content = v_receipt.before_state->>'content',
        tags = case when jsonb_typeof(v_receipt.before_state->'tags') = 'array' then array(select jsonb_array_elements_text(v_receipt.before_state->'tags')) else null end,
        updated_at = now()
      where id = v_receipt.entity_id and user_id = p_user_id returning * into v_note;
      v_result := to_jsonb(v_note);
    elsif v_receipt.entity_type = 'project' then
      update public.projects set
        title = v_receipt.before_state->>'title', description = v_receipt.before_state->>'description',
        status = v_receipt.before_state->>'status', priority = v_receipt.before_state->>'priority',
        color = v_receipt.before_state->>'color', updated_at = now()
      where id = v_receipt.entity_id and user_id = p_user_id returning * into v_project;
      v_result := to_jsonb(v_project);
    elsif v_receipt.entity_type = 'habit' then
      update public.habits set
        name = v_receipt.before_state->>'name', description = v_receipt.before_state->>'description',
        frequency = v_receipt.before_state->>'frequency', target_count = (v_receipt.before_state->>'target_count')::integer,
        updated_at = now()
      where id = v_receipt.entity_id and user_id = p_user_id returning * into v_habit;
      v_result := to_jsonb(v_habit);
    elsif v_receipt.entity_type = 'reminder' then
      update public.reminders set
        title = v_receipt.before_state->>'title', body = v_receipt.before_state->>'body',
        remind_at = (v_receipt.before_state->>'remind_at')::timestamptz,
        type = v_receipt.before_state->>'type', related_entity_type = v_receipt.before_state->>'related_entity_type',
        related_entity_id = (v_receipt.before_state->>'related_entity_id')::uuid,
        is_sent = coalesce((v_receipt.before_state->>'is_sent')::boolean, false),
        is_read = coalesce((v_receipt.before_state->>'is_read')::boolean, false)
      where id = v_receipt.entity_id and user_id = p_user_id returning * into v_reminder;
      v_result := to_jsonb(v_reminder);
    else
      raise exception 'Unsupported updated entity undo';
    end if;
    if v_result is null then raise exception 'Updated entity no longer exists'; end if;

  elsif v_receipt.undo_kind = 'restore_deleted' then
    if v_receipt.entity_type = 'task' then
      insert into public.tasks (
        id, user_id, project_id, title, description, status, priority, due_date, completed_at,
        tags, checklist, recurrence, recurrence_series_id, recurrence_occurrence_key,
        recurrence_sequence, recurrence_status, recurrence_rule_version,
        recurrence_calculator_version, created_at, updated_at, version
      ) values (
        v_receipt.entity_id, p_user_id, (v_receipt.before_state->>'project_id')::uuid,
        v_receipt.before_state->>'title', v_receipt.before_state->>'description',
        v_receipt.before_state->>'status', v_receipt.before_state->>'priority',
        (v_receipt.before_state->>'due_date')::timestamptz,
        (v_receipt.before_state->>'completed_at')::timestamptz,
        case when jsonb_typeof(v_receipt.before_state->'tags') = 'array' then array(select jsonb_array_elements_text(v_receipt.before_state->'tags')) else null end,
        case when jsonb_typeof(v_receipt.before_state->'checklist') = 'array' then v_receipt.before_state->'checklist' else '[]'::jsonb end,
         case
           when v_receipt.before_state ? 'recurrence'
             and jsonb_typeof(v_receipt.before_state->'recurrence') <> 'null'
           then v_receipt.before_state->'recurrence'
           else null
         end,
        (v_receipt.before_state->>'recurrence_series_id')::uuid,
        v_receipt.before_state->>'recurrence_occurrence_key',
        coalesce((v_receipt.before_state->>'recurrence_sequence')::integer, 0),
        coalesce(v_receipt.before_state->>'recurrence_status', 'active'),
        (v_receipt.before_state->>'recurrence_rule_version')::bigint,
        v_receipt.before_state->>'recurrence_calculator_version',
        coalesce((v_receipt.before_state->>'created_at')::timestamptz, now()), now(),
        coalesce((v_receipt.before_state->>'version')::bigint, 1)
      ) returning * into v_task;
      v_result := to_jsonb(v_task);
    elsif v_receipt.entity_type = 'note' then
      insert into public.notes (id, user_id, project_id, title, content, tags, created_at, updated_at, version)
      values (
        v_receipt.entity_id, p_user_id, (v_receipt.before_state->>'project_id')::uuid,
        v_receipt.before_state->>'title', v_receipt.before_state->>'content',
        case when jsonb_typeof(v_receipt.before_state->'tags') = 'array' then array(select jsonb_array_elements_text(v_receipt.before_state->'tags')) else null end,
        coalesce((v_receipt.before_state->>'created_at')::timestamptz, now()), now(),
        coalesce((v_receipt.before_state->>'version')::bigint, 1)
      ) returning * into v_note;
      v_result := to_jsonb(v_note);
    elsif v_receipt.entity_type = 'project' then
      insert into public.projects (id, user_id, title, description, status, priority, color, created_at, updated_at, version)
      values (
        v_receipt.entity_id, p_user_id, v_receipt.before_state->>'title',
        v_receipt.before_state->>'description', v_receipt.before_state->>'status',
        v_receipt.before_state->>'priority', v_receipt.before_state->>'color',
        coalesce((v_receipt.before_state->>'created_at')::timestamptz, now()), now(),
        coalesce((v_receipt.before_state->>'version')::bigint, 1)
      ) returning * into v_project;
      v_result := to_jsonb(v_project);
    elsif v_receipt.entity_type = 'habit' then
      insert into public.habits (id, user_id, name, description, frequency, target_count, created_at, updated_at, version)
      values (
        v_receipt.entity_id, p_user_id, v_receipt.before_state->>'name',
        v_receipt.before_state->>'description', v_receipt.before_state->>'frequency',
        (v_receipt.before_state->>'target_count')::integer,
        coalesce((v_receipt.before_state->>'created_at')::timestamptz, now()), now(),
        coalesce((v_receipt.before_state->>'version')::bigint, 1)
      ) returning * into v_habit;
      v_result := to_jsonb(v_habit);
    elsif v_receipt.entity_type = 'reminder' then
      insert into public.reminders (
        id, user_id, title, body, remind_at, type, related_entity_type, related_entity_id,
        is_sent, is_read, created_at, version
      ) values (
        v_receipt.entity_id, p_user_id, v_receipt.before_state->>'title',
        v_receipt.before_state->>'body', (v_receipt.before_state->>'remind_at')::timestamptz,
        v_receipt.before_state->>'type', v_receipt.before_state->>'related_entity_type',
        (v_receipt.before_state->>'related_entity_id')::uuid,
        coalesce((v_receipt.before_state->>'is_sent')::boolean, false),
        coalesce((v_receipt.before_state->>'is_read')::boolean, false),
        coalesce((v_receipt.before_state->>'created_at')::timestamptz, now()),
        coalesce((v_receipt.before_state->>'version')::bigint, 1)
      ) returning * into v_reminder;
      v_result := to_jsonb(v_reminder);
    else
      raise exception 'Unsupported deleted entity undo';
    end if;

  elsif v_receipt.undo_kind = 'delete_link' then
    delete from public.task_note_links
    where user_id = p_user_id
      and task_id = (v_receipt.after_state->>'task_id')::uuid
      and note_id = (v_receipt.after_state->>'note_id')::uuid;
    v_result := v_receipt.after_state;
  elsif v_receipt.undo_kind = 'restore_link' then
    insert into public.task_note_links (user_id, task_id, note_id)
    values (p_user_id, (v_receipt.before_state->>'task_id')::uuid, (v_receipt.before_state->>'note_id')::uuid)
    on conflict (task_id, note_id) do nothing;
    v_result := v_receipt.before_state;
  elsif v_receipt.undo_kind = 'delete_habit_completion' then
    delete from public.habit_completions
    where user_id = p_user_id
      and habit_id = (v_receipt.after_state->>'habit_id')::uuid
      and completion_date = (v_receipt.after_state->>'completion_date')::date;
    v_result := v_receipt.after_state;
  elsif v_receipt.undo_kind = 'restore_habit_completion' then
    insert into public.habit_completions (user_id, habit_id, completion_date)
    values (p_user_id, (v_receipt.before_state->>'habit_id')::uuid, (v_receipt.before_state->>'completion_date')::date)
    on conflict (habit_id, completion_date) do nothing;
    v_result := v_receipt.before_state;
  else
    raise exception 'Unsupported undo operation';
  end if;

  v_undone_at := now();
  v_response := jsonb_build_object(
    'receiptId', v_receipt.id,
    'entityType', v_receipt.entity_type,
    'entityId', v_receipt.entity_id,
    'undoKind', v_receipt.undo_kind,
    'data', v_result,
    'undoneAt', v_undone_at,
    'replayed', false
  );
  update public.agent_action_receipts
  set undone_at = v_undone_at, undo_result = v_response
  where id = v_receipt.id;
  return v_response;
end;
$function$;

insert into public.feature_flags (
  key, description, stage, enabled, rollout_percent, rollout_salt, config
)
values (
  'recurrence_completion_v3',
  'Canonical recurring completion with compound AI receipt and version-aware undo',
  'off', false, 0, 'recurrence-completion-v3', '{}'::jsonb
)
on conflict (key) do nothing;

revoke all on function public.complete_recurring_task_v3(
  uuid, uuid, bigint, uuid, text, timestamptz, jsonb, text, text, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.complete_recurring_task_v3(
  uuid, uuid, bigint, uuid, text, timestamptz, jsonb, text, text, boolean, text, uuid
) to service_role;

revoke all on function public.undo_agent_action(uuid, uuid) from public, anon, authenticated;
grant execute on function public.undo_agent_action(uuid, uuid) to service_role;

commit;
