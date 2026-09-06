-- ============================================================================
-- IDEMPOTENT MIGRATION: 42_notification_digest_policy.sql
-- Description: Date-only tasks (Tehran 12:00 convention) must never receive
-- individual pushes — they are covered by the entry summary + noon digest.
-- Also bounds dispatch staleness to 24h and adds the noon-digest candidate RPC.
-- ============================================================================

-- 1. Timed-only dispatch view (excludes date-only + ancient overdue rows)
drop view if exists public.pending_push_reminders;

create view public.pending_push_reminders with (security_invoker = true) as
select
  t.id as task_id,
  t.user_id,
  t.title,
  coalesce(t.description, '') as description,
  t.due_date,
  s.endpoint,
  s.p256dh,
  s.auth
from public.tasks t
join public.push_subscriptions s on s.user_id = t.user_id
where t.due_date <= now()
  and t.due_date > now() - interval '24 hours'
  and t.completed_at is null
  -- Date-only convention: Tehran wall-clock exactly 12:00 (minute-truncated
  -- for robustness). Digest-covered, never an individual push.
  and date_trunc('minute', t.due_date at time zone 'Asia/Tehran')::time <> '12:00:00'
  and not exists (
    select 1
    from public.reminders r
    where r.related_entity_id = t.id
      and r.related_entity_type = 'task'
      and r.is_sent = true
  );

revoke all on table public.pending_push_reminders from public, anon, authenticated;
grant select on table public.pending_push_reminders to service_role;

-- 2. Noon-digest candidates: one summary push per user per day, 12:00+ Tehran
create or replace function public.get_noon_digest_candidates()
returns table (
  user_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  open_today integer,
  overdue integer
) language plpgsql security definer set search_path = public as $$
begin
  -- Digest window opens at 12:00 Tehran; the ledger guard keeps it once/day.
  if extract(hour from now() at time zone 'Asia/Tehran') >= 12 then
    return query
    select
      s.user_id,
      s.endpoint,
      s.p256dh,
      s.auth,
      (
        select count(*)::int from public.tasks t
        where t.user_id = s.user_id
          and t.completed_at is null
          and (t.due_date at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date
      ),
      (
        select count(*)::int from public.tasks t
        where t.user_id = s.user_id
          and t.completed_at is null
          and t.due_date is not null
          and (t.due_date at time zone 'Asia/Tehran')::date < (now() at time zone 'Asia/Tehran')::date
      )
    from public.push_subscriptions s
    -- The user must have at least one uncompleted task due today (Tehran)
    where exists (
      select 1 from public.tasks t
      where t.user_id = s.user_id
        and t.completed_at is null
        and (t.due_date at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date
    )
    -- The user must not have received the noon digest today yet
    and not exists (
      select 1 from public.reminders r
      where r.user_id = s.user_id
        and r.related_entity_type = 'noon_digest'
        and (r.created_at at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date
    );
  end if;
end; $$;

revoke all on function public.get_noon_digest_candidates() from public, anon, authenticated;
grant execute on function public.get_noon_digest_candidates() to service_role;

notify pgrst, 'reload schema';
