begin;

-- ISSUE_03-C / QA phase 1.6: the reminder outbox trigger must close the pending
-- outbox occurrence when a reminder is marked sent in place (the legacy dispatcher
-- flips is_sent=true without changing remind_at). Today only DELETE and a remind_at
-- change supersede; the is_sent transition leaves a pending row behind, so once
-- reminder_outbox_v2 is enabled the user would get the same reminder twice
-- (once from the legacy worker that already sent it, once from the new outbox).
--
-- Verified live 2026-08-24: all recent reminders rows are created with is_sent=true
-- by the legacy path, so today notification_messages stays empty; this only matters
-- once the flag turns on.
--
-- No-op while notification_messages is empty; required BEFORE enabling the flag.

create or replace function public.enqueue_reminder_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_occurrence_key text;
  v_old_occurrence_key text;
begin
  if tg_op = 'DELETE' then
    perform public.supersede_notification_message(
      old.user_id, 'custom_reminder',
      'reminder:' || old.id::text || ':' || (extract(epoch from old.remind_at) * 1000)::bigint::text,
      null
    );
    return old;
  end if;

  v_occurrence_key := 'reminder:' || new.id::text || ':' ||
                      (extract(epoch from new.remind_at) * 1000)::bigint::text;
  v_old_occurrence_key := 'reminder:' || old.id::text || ':' ||
                      (extract(epoch from old.remind_at) * 1000)::bigint::text;

  if tg_op = 'UPDATE' and old.remind_at is distinct from new.remind_at then
    perform public.supersede_notification_message(
      new.user_id, 'custom_reminder', v_old_occurrence_key, null
    );
  end if;

  -- Marked sent in place (legacy dispatcher path): close any pending occurrence so
  -- the outbox never re-notifies for something the old pipeline already delivered.
  if tg_op = 'UPDATE' and not coalesce(old.is_sent, false) and coalesce(new.is_sent, false) then
    perform public.supersede_notification_message(
      new.user_id, 'custom_reminder', v_occurrence_key, null
    );
    return new;
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

commit;
