begin;

-- ISSUE_03-B / QA phase 1.6: production's live claim_notification_messages has a 4th
-- parameter and a staleness guard that no repo file contained. This migration copies
-- the LIVE definition verbatim so repo becomes a truthful source again. It is
-- idempotent: applying it to the current database changes nothing.
--
-- Verified live 2026-08-24 via pg_get_functiondef on production.

create or replace function public.claim_notification_messages(
  p_lease_owner text,
  p_batch_size integer default 25,
  p_lease_seconds integer default 60,
  p_max_age_minutes integer default 180
)
returns setof public.notification_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if btrim(coalesce(p_lease_owner, '')) = '' then raise exception 'invalid_lease_owner'; end if;
  if p_batch_size < 1 or p_batch_size > 200 then raise exception 'invalid_batch_size'; end if;

  -- Reclaim anything whose lease expired before handing out new work, so a worker
  -- that died mid-send does not strand its messages.
  update public.notification_messages set
    state = 'retry', lease_owner = null, lease_expires_at = null, updated_at = now()
  where state = 'leased' and lease_expires_at <= now();

  -- Too old to be worth delivering: close it rather than surprising the user.
  update public.notification_messages set
    state = 'cancelled', last_error_code = 'stale_before_delivery',
    lease_owner = null, lease_expires_at = null, updated_at = now()
  where state in ('pending', 'retry')
    and scheduled_for < now() - make_interval(mins => p_max_age_minutes);

  return query
  with claimable as (
    select message_id from public.notification_messages
    where state in ('pending', 'retry')
      and scheduled_for <= now()
      and scheduled_for >= now() - make_interval(mins => p_max_age_minutes)
      and next_attempt_at <= now()
    order by scheduled_for
    limit p_batch_size
    for update skip locked
  )
  update public.notification_messages m set
    state = 'leased',
    lease_owner = p_lease_owner,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = m.attempt_count + 1,
    updated_at = now()
  from claimable c
  where m.message_id = c.message_id
  returning m.*;
end;
$function$;

revoke all on function public.claim_notification_messages(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_messages(text, integer, integer, integer) to service_role;

commit;
