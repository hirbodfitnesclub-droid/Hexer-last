begin;

-- Reminder outbox enqueue. Same discipline as the memory queue: the trigger writes a
-- message row inside the user's own transaction and never makes a network call, so a
-- push outage can never delay or roll back saving a reminder.
--
-- Inert until reminder_outbox_v2 is enabled, because the dispatcher is the only reader
-- and the legacy view-driven worker still owns delivery today.

create or replace function public.enqueue_reminder_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_occurrence_key text;
begin
  if tg_op = 'DELETE' then
    perform public.supersede_notification_message(
      old.user_id, 'custom_reminder',
      'reminder:' || old.id::text || ':' || (extract(epoch from old.remind_at) * 1000)::bigint::text,
      null
    );
    return old;
  end if;

  -- Identity is the reminder plus the exact moment, so rescheduling produces a new
  -- occurrence rather than mutating one that may already have been delivered.
  v_occurrence_key := 'reminder:' || new.id::text || ':' ||
                      (extract(epoch from new.remind_at) * 1000)::bigint::text;

  if tg_op = 'UPDATE' and old.remind_at is distinct from new.remind_at then
    perform public.supersede_notification_message(
      new.user_id, 'custom_reminder',
      'reminder:' || old.id::text || ':' || (extract(epoch from old.remind_at) * 1000)::bigint::text,
      null
    );
  end if;

  -- Already-sent reminders are historical records, not future work.
  if coalesce(new.is_sent, false) then
    return new;
  end if;

  perform public.enqueue_notification_message(
    new.user_id,
    'custom_reminder',
    v_occurrence_key,
    new.title,
    new.body,
    new.remind_at,
    new.related_entity_type,
    new.related_entity_id,
    jsonb_build_object('reminderId', new.id, 'type', new.type)
  );
  return new;
end;
$function$;

revoke all on function public.enqueue_reminder_message() from public, anon, authenticated;

create or replace trigger reminder_outbox_enqueue
  after insert or update of remind_at, title, body, is_sent or delete on public.reminders
  for each row execute function public.enqueue_reminder_message();

/**
 * Materializes task due-date reminders into the outbox. Called by the dispatcher path
 * rather than a trigger, because "a task is due" is a time condition, not a row change.
 */
create or replace function public.enqueue_due_task_reminders(p_horizon_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select t.id, t.user_id, t.title, t.description, t.due_date
    from public.tasks t
    where t.status <> 'done'
      and t.due_date is not null
      and t.due_date <= now() + make_interval(mins => p_horizon_minutes)
      and t.due_date > now() - interval '1 day'
    limit 200
  loop
    perform public.enqueue_notification_message(
      v_row.user_id,
      'task_reminder',
      'task:' || v_row.id::text || ':' || (extract(epoch from v_row.due_date) * 1000)::bigint::text,
      v_row.title,
      coalesce(v_row.description, 'سررسید این وظیفه فرا رسیده است.'),
      v_row.due_date,
      'task',
      v_row.id,
      jsonb_build_object('taskId', v_row.id)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_due_task_reminders(integer) from public, anon, authenticated;
grant execute on function public.enqueue_due_task_reminders(integer) to service_role;

commit;
