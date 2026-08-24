begin;

create table if not exists public.agent_action_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action text not null,
  entity_type text not null check (entity_type in ('task', 'note', 'project', 'habit', 'reminder', 'link', 'habit_completion')),
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  undo_kind text not null check (undo_kind in ('delete_created', 'restore_updated', 'restore_deleted', 'delete_link', 'restore_link', 'delete_habit_completion', 'restore_habit_completion')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists agent_action_receipts_user_created_idx
  on public.agent_action_receipts (user_id, created_at desc);
create index if not exists agent_action_receipts_expiry_idx
  on public.agent_action_receipts (expires_at)
  where undone_at is null;

alter table public.agent_action_receipts enable row level security;
revoke all on public.agent_action_receipts from public, anon, authenticated;
grant all on public.agent_action_receipts to service_role;

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
  v_task public.tasks%rowtype;
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
  if v_receipt.undone_at is not null then raise exception 'Undo receipt already used'; end if;
  if v_receipt.expires_at <= now() then raise exception 'Undo receipt expired'; end if;

  if v_receipt.undo_kind = 'delete_created' then
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
        tags = case when v_receipt.before_state ? 'tags' then array(select jsonb_array_elements_text(coalesce(v_receipt.before_state->'tags', '[]'::jsonb))) else null end,
        checklist = coalesce(v_receipt.before_state->'checklist', '[]'::jsonb), updated_at = now()
      where id = v_receipt.entity_id and user_id = p_user_id returning * into v_task;
      v_result := to_jsonb(v_task);
    elsif v_receipt.entity_type = 'note' then
      update public.notes set
        project_id = (v_receipt.before_state->>'project_id')::uuid,
        title = v_receipt.before_state->>'title', content = v_receipt.before_state->>'content',
        tags = case when v_receipt.before_state ? 'tags' then array(select jsonb_array_elements_text(coalesce(v_receipt.before_state->'tags', '[]'::jsonb))) else null end,
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

  update public.agent_action_receipts set undone_at = now() where id = v_receipt.id;
  return jsonb_build_object(
    'receiptId', v_receipt.id,
    'entityType', v_receipt.entity_type,
    'entityId', v_receipt.entity_id,
    'undoKind', v_receipt.undo_kind,
    'data', v_result,
    'undoneAt', now()
  );
end;
$function$;

revoke all on function public.undo_agent_action(uuid, uuid) from public, anon, authenticated;
grant execute on function public.undo_agent_action(uuid, uuid) to service_role;

commit;
