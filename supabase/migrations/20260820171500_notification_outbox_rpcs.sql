begin;

-- Claim, acknowledge, and retry primitives for the notification outbox.
-- `for update skip locked` lets several dispatcher invocations run concurrently
-- without ever handing the same message to two workers.

create or replace function public.enqueue_notification_message(
  p_user_id uuid,
  p_channel_purpose text,
  p_occurrence_key text,
  p_title text,
  p_body text,
  p_scheduled_for timestamptz,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_message_id uuid;
begin
  if p_user_id is null or p_occurrence_key is null or btrim(coalesce(p_title, '')) = '' then
    raise exception 'invalid_notification_message';
  end if;

  -- Re-enqueueing the same occurrence is a no-op. The unique key is the guarantee
  -- that a retry, a replay, or two triggers cannot create a second notification.
  insert into public.notification_messages (
    user_id, channel_purpose, occurrence_key, entity_type, entity_id,
    title, body, scheduled_for, payload
  ) values (
    p_user_id, p_channel_purpose, p_occurrence_key, p_entity_type, p_entity_id,
    p_title, p_body, p_scheduled_for, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (user_id, channel_purpose, occurrence_key) do nothing
  returning message_id into v_message_id;

  if v_message_id is null then
    select message_id into v_message_id from public.notification_messages
    where user_id = p_user_id and channel_purpose = p_channel_purpose and occurrence_key = p_occurrence_key;
  end if;

  return v_message_id;
end;
$function$;

create or replace function public.claim_notification_messages(
  p_lease_owner text,
  p_batch_size integer default 25,
  p_lease_seconds integer default 60
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

  return query
  with claimable as (
    select message_id from public.notification_messages
    where state in ('pending', 'retry')
      and scheduled_for <= now()
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

create or replace function public.record_notification_delivery(
  p_message_id uuid,
  p_user_id uuid,
  p_channel text,
  p_endpoint text,
  p_status text,
  p_provider_status integer default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_attempt integer;
begin
  select attempt_count into v_attempt from public.notification_messages
  where message_id = p_message_id and user_id = p_user_id;
  if v_attempt is null then raise exception 'notification_message_not_found'; end if;

  insert into public.notification_deliveries (
    message_id, user_id, channel, endpoint, status, provider_status, error_code, attempt_number
  ) values (
    p_message_id, p_user_id, p_channel, p_endpoint, p_status, p_provider_status, p_error_code,
    greatest(v_attempt, 1)
  )
  on conflict (message_id, channel, endpoint, attempt_number) do update
  set status = excluded.status,
      provider_status = excluded.provider_status,
      error_code = excluded.error_code,
      attempted_at = now();
end;
$function$;

create or replace function public.finalize_notification_message(
  p_message_id uuid,
  p_user_id uuid,
  p_succeeded integer,
  p_failed integer,
  p_permanent integer default 0,
  p_max_attempts integer default 5,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_message public.notification_messages%rowtype;
  v_state text;
  v_backoff interval;
begin
  select * into v_message from public.notification_messages
  where message_id = p_message_id and user_id = p_user_id for update;
  if not found then raise exception 'notification_message_not_found'; end if;

  if p_succeeded > 0 and p_failed = 0 then
    v_state := 'sent';
  elsif p_succeeded > 0 then
    -- Some endpoints worked. The user has been notified, so this is not retried:
    -- retrying would re-notify the endpoints that already succeeded.
    v_state := 'partial';
  elsif p_succeeded = 0 and p_failed = 0 and p_permanent > 0 then
    -- Every endpoint is gone. There is nothing left to deliver to.
    v_state := 'dead';
  elsif v_message.attempt_count >= p_max_attempts then
    v_state := 'dead';
  else
    v_state := 'retry';
  end if;

  v_backoff := make_interval(secs => least(3600, power(2, greatest(v_message.attempt_count, 1))::integer * 30));

  update public.notification_messages set
    state = v_state,
    lease_owner = null,
    lease_expires_at = null,
    last_error_code = coalesce(p_error_code, last_error_code),
    sent_at = case when v_state in ('sent', 'partial') then coalesce(sent_at, now()) else sent_at end,
    next_attempt_at = case when v_state = 'retry' then now() + v_backoff else next_attempt_at end,
    updated_at = now()
  where message_id = p_message_id;

  if v_state = 'dead' then
    insert into public.notification_dead_letters (
      message_id, user_id, channel_purpose, occurrence_key, attempt_count, last_error_code, payload
    ) values (
      v_message.message_id, v_message.user_id, v_message.channel_purpose, v_message.occurrence_key,
      v_message.attempt_count, coalesce(p_error_code, v_message.last_error_code), v_message.payload
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object('messageId', p_message_id, 'state', v_state, 'attemptCount', v_message.attempt_count);
end;
$function$;

create or replace function public.supersede_notification_message(
  p_user_id uuid,
  p_channel_purpose text,
  p_occurrence_key text,
  p_replacement uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_count integer;
begin
  -- Snoozing or rescheduling closes the old occurrence instead of mutating it, so a
  -- delivered notification is never rewritten after the fact.
  with closed as (
    update public.notification_messages set
      state = 'superseded', superseded_by = p_replacement,
      lease_owner = null, lease_expires_at = null, updated_at = now()
    where user_id = p_user_id
      and channel_purpose = p_channel_purpose
      and occurrence_key = p_occurrence_key
      and state in ('pending', 'retry', 'leased')
    returning message_id
  ) select count(*) into v_count from closed;
  return v_count;
end;
$function$;

create or replace function public.mark_notification_message_read(
  p_message_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_updated integer;
begin
  update public.notification_messages set read_at = coalesce(read_at, now()), updated_at = now()
  where message_id = p_message_id and user_id = p_user_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$function$;

revoke all on function public.enqueue_notification_message(uuid, text, text, text, text, timestamptz, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_notification_messages(text, integer, integer) from public, anon, authenticated;
revoke all on function public.record_notification_delivery(uuid, uuid, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.finalize_notification_message(uuid, uuid, integer, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.supersede_notification_message(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.mark_notification_message_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_notification_message(uuid, text, text, text, text, timestamptz, text, uuid, jsonb) to service_role;
grant execute on function public.claim_notification_messages(text, integer, integer) to service_role;
grant execute on function public.record_notification_delivery(uuid, uuid, text, text, text, integer, text) to service_role;
grant execute on function public.finalize_notification_message(uuid, uuid, integer, integer, integer, integer, text) to service_role;
grant execute on function public.supersede_notification_message(uuid, text, text, uuid) to service_role;
grant execute on function public.mark_notification_message_read(uuid, uuid) to service_role;

commit;
