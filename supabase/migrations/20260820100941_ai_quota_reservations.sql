begin;

alter table public.ai_requests_log
  add column if not exists request_id uuid,
  add column if not exists reservation_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists feature text,
  add column if not exists status text,
  add column if not exists requested_model_key text,
  add column if not exists requested_provider_slug text,
  add column if not exists actual_model text,
  add column if not exists actual_provider text,
  add column if not exists provider_request_id text,
  add column if not exists schema_name text,
  add column if not exists schema_version text,
  add column if not exists prompt_version text,
  add column if not exists thinking_effort text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists reasoning_tokens integer,
  add column if not exists cached_tokens integer,
  add column if not exists cost_microunits bigint,
  add column if not exists currency text,
  add column if not exists usage_source text,
  add column if not exists latency_ms integer,
  add column if not exists failure_class text,
  add column if not exists http_status integer,
  add column if not exists started_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.ai_requests_log
  drop constraint if exists ai_requests_log_status_check,
  add constraint ai_requests_log_status_check
    check (status is null or status in ('reserved', 'started', 'succeeded', 'failed', 'released', 'expired')),
  drop constraint if exists ai_requests_log_usage_source_check,
  add constraint ai_requests_log_usage_source_check
    check (usage_source is null or usage_source in ('provider', 'estimated', 'unknown')),
  drop constraint if exists ai_requests_log_usage_nonnegative_check,
  add constraint ai_requests_log_usage_nonnegative_check check (
    coalesce(input_tokens, 0) >= 0 and coalesce(output_tokens, 0) >= 0 and
    coalesce(reasoning_tokens, 0) >= 0 and coalesce(cached_tokens, 0) >= 0 and
    coalesce(cost_microunits, 0) >= 0 and coalesce(latency_ms, 0) >= 0
  );

create index if not exists ai_requests_log_user_created_idx
  on public.ai_requests_log (user_id, created_at desc);
create index if not exists ai_requests_log_status_created_idx
  on public.ai_requests_log (status, created_at)
  where status in ('reserved', 'started');
create unique index if not exists ai_requests_log_user_feature_idempotency_idx
  on public.ai_requests_log (user_id, feature, idempotency_key)
  where idempotency_key is not null and feature is not null;

create table if not exists public.ai_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  idempotency_key text not null,
  requested_model_key text not null,
  resolved_model text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'started', 'succeeded', 'failed', 'released', 'expired')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  started_at timestamptz,
  finalized_at timestamptz,
  failure_class text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature, idempotency_key),
  unique (request_id),
  check (expires_at > created_at)
);

create index if not exists ai_quota_reservations_active_idx
  on public.ai_quota_reservations (user_id, period_start, period_end, expires_at)
  where status in ('reserved', 'started');
create index if not exists ai_quota_reservations_expiry_idx
  on public.ai_quota_reservations (expires_at)
  where status in ('reserved', 'started');

alter table public.ai_quota_reservations enable row level security;
revoke all on public.ai_quota_reservations from public, anon, authenticated;
grant all on public.ai_quota_reservations to service_role;
create policy "service manages quota reservations" on public.ai_quota_reservations
  for all to service_role using (true) with check (true);

create or replace function public.reserve_ai_quota(
  p_feature text,
  p_idempotency_key text,
  p_requested_model_key text default 'gemini-3.1-flash-lite'
)
returns table(
  allowed boolean,
  reservation_id uuid,
  request_id uuid,
  model text,
  remaining integer,
  reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan_code text;
  v_sub_status text;
  v_sub_expires timestamptz;
  v_plan_quota integer;
  v_plan_period_days integer;
  v_plan_model text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_request_count integer;
  v_active_reservations integer;
  v_existing public.ai_quota_reservations%rowtype;
  v_created public.ai_quota_reservations%rowtype;
begin
  if v_user_id is null then
    return query select false, null::uuid, null::uuid, null::text, 0, 'unauthorized'::text;
    return;
  end if;
  if p_feature is null or btrim(p_feature) = '' or length(p_feature) > 80 then
    return query select false, null::uuid, null::uuid, null::text, 0, 'invalid_feature'::text;
    return;
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 200 then
    return query select false, null::uuid, null::uuid, null::text, 0, 'invalid_idempotency_key'::text;
    return;
  end if;

  select * into v_existing from public.ai_quota_reservations
  where user_id = v_user_id and feature = p_feature and idempotency_key = p_idempotency_key;
  if found and v_existing.status in ('reserved', 'started', 'succeeded') then
    return query select
      true,
      v_existing.id,
      v_existing.request_id,
      v_existing.resolved_model,
      greatest(0, coalesce((
        select p.monthly_quota - c.request_count
        from public.usage_counters c
        join public.subscriptions s on s.user_id = c.user_id
        join public.plans p on p.plan_code = s.plan_code
        where c.user_id = v_user_id
      ), 0)),
      'idempotent_replay'::text;
    return;
  end if;

  select s.plan_code, s.status, s.expires_at, p.monthly_quota, p.period_days, p.ai_model
  into v_plan_code, v_sub_status, v_sub_expires, v_plan_quota, v_plan_period_days, v_plan_model
  from public.subscriptions s join public.plans p on p.plan_code = s.plan_code
  where s.user_id = v_user_id;
  if not found then
    return query select false, null::uuid, null::uuid, null::text, 0, 'no_subscription'::text;
    return;
  end if;

  select period_start, period_end, request_count
  into v_period_start, v_period_end, v_request_count
  from public.usage_counters where user_id = v_user_id for update;
  if not found then
    insert into public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    values (v_user_id, now(), v_sub_expires, 0, now())
    returning period_start, period_end, request_count into v_period_start, v_period_end, v_request_count;
  end if;

  -- Recheck after serializing on the usage row. A concurrent request with the
  -- same idempotency key may have committed while this transaction waited.
  select * into v_existing from public.ai_quota_reservations
  where user_id = v_user_id and feature = p_feature and idempotency_key = p_idempotency_key;
  if found and v_existing.status in ('reserved', 'started', 'succeeded') then
    return query select true, v_existing.id, v_existing.request_id, v_existing.resolved_model,
      greatest(0, v_plan_quota - v_request_count), 'idempotent_replay'::text;
    return;
  end if;

  if v_plan_code = 'free' then
    if now() > v_sub_expires then
      return query select false, null::uuid, null::uuid, v_plan_model, 0, 'trial_expired'::text;
      return;
    end if;
  elsif v_sub_status <> 'active' or now() > v_sub_expires then
    return query select false, null::uuid, null::uuid, v_plan_model, 0, 'subscription_expired'::text;
    return;
  end if;

  if now() > v_period_end and v_plan_code <> 'free' then
    v_period_start := now();
    v_period_end := now() + (interval '1 day' * v_plan_period_days);
    v_request_count := 0;
    update public.usage_counters set period_start = v_period_start, period_end = v_period_end,
      request_count = 0, updated_at = now() where user_id = v_user_id;
  end if;

  update public.ai_quota_reservations set status = 'expired', finalized_at = now(), updated_at = now()
  where user_id = v_user_id and status in ('reserved', 'started') and expires_at <= now();

  select count(*) into v_active_reservations
  from public.ai_quota_reservations
  where user_id = v_user_id and status in ('reserved', 'started') and expires_at > now()
    and period_start = v_period_start and period_end = v_period_end;

  if v_request_count + v_active_reservations >= v_plan_quota then
    return query select false, null::uuid, null::uuid, v_plan_model, 0, 'quota_exceeded'::text;
    return;
  end if;

  if v_existing.id is not null then
    update public.ai_quota_reservations set
      requested_model_key = p_requested_model_key, resolved_model = v_plan_model,
      status = 'reserved', period_start = v_period_start, period_end = v_period_end,
      expires_at = now() + interval '10 minutes', started_at = null, finalized_at = null,
      failure_class = null, updated_at = now()
    where id = v_existing.id returning * into v_created;
    update public.ai_requests_log set
      model = v_plan_model, status = 'reserved', requested_model_key = p_requested_model_key,
      actual_model = null, actual_provider = null, provider_request_id = null,
      input_tokens = null, output_tokens = null, reasoning_tokens = null, cached_tokens = null,
      cost_microunits = null, usage_source = null, latency_ms = null, failure_class = null,
      http_status = null, started_at = null, finalized_at = null, metadata = '{}'::jsonb,
      created_at = now()
    where reservation_id = v_existing.id and user_id = v_user_id;
  else
    insert into public.ai_quota_reservations (
      user_id, feature, idempotency_key, requested_model_key, resolved_model, period_start, period_end
    ) values (
      v_user_id, p_feature, p_idempotency_key, p_requested_model_key, v_plan_model, v_period_start, v_period_end
    ) returning * into v_created;

    insert into public.ai_requests_log (
      user_id, mode, model, request_id, reservation_id, idempotency_key, feature, status,
      requested_model_key, created_at
    ) values (
      v_user_id, p_feature, v_plan_model, v_created.request_id, v_created.id,
      p_idempotency_key, p_feature, 'reserved', p_requested_model_key, now()
    );
  end if;

  return query select true, v_created.id, v_created.request_id, v_plan_model,
    greatest(0, v_plan_quota - v_request_count - v_active_reservations - 1), 'quota_reserved'::text;
end;
$function$;

create or replace function public.start_ai_request(p_reservation_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare v_updated integer;
begin
  update public.ai_quota_reservations set status = 'started', started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_reservation_id and user_id = p_user_id and status = 'reserved' and expires_at > now();
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;
  update public.ai_requests_log set status = 'started', started_at = coalesce(started_at, now())
  where reservation_id = p_reservation_id and user_id = p_user_id and status = 'reserved';
  return true;
end;
$function$;

create or replace function public.finalize_ai_request_success(
  p_reservation_id uuid,
  p_user_id uuid,
  p_actual_model text,
  p_actual_provider text,
  p_provider_request_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_reasoning_tokens integer,
  p_cached_tokens integer,
  p_cost_microunits bigint,
  p_usage_source text,
  p_latency_ms integer,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare v_reservation public.ai_quota_reservations%rowtype;
begin
  select * into v_reservation from public.ai_quota_reservations
  where id = p_reservation_id and user_id = p_user_id for update;
  if not found then return false; end if;
  if v_reservation.status = 'succeeded' then return true; end if;
  if v_reservation.status not in ('reserved', 'started') or v_reservation.expires_at <= now() then return false; end if;

  update public.usage_counters set request_count = request_count + 1, updated_at = now()
  where user_id = p_user_id and period_start = v_reservation.period_start and period_end = v_reservation.period_end;
  if not found then return false; end if;

  update public.ai_quota_reservations set status = 'succeeded', finalized_at = now(), updated_at = now()
  where id = p_reservation_id;
  update public.ai_requests_log set status = 'succeeded', actual_model = p_actual_model,
    actual_provider = p_actual_provider, provider_request_id = p_provider_request_id,
    input_tokens = greatest(coalesce(p_input_tokens, 0), 0), output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
    reasoning_tokens = greatest(coalesce(p_reasoning_tokens, 0), 0), cached_tokens = greatest(coalesce(p_cached_tokens, 0), 0),
    cost_microunits = greatest(coalesce(p_cost_microunits, 0), 0), usage_source = p_usage_source,
    latency_ms = greatest(coalesce(p_latency_ms, 0), 0), metadata = coalesce(p_metadata, '{}'::jsonb), finalized_at = now()
  where reservation_id = p_reservation_id and user_id = p_user_id;
  return true;
end;
$function$;

create or replace function public.finalize_ai_request_failure(
  p_reservation_id uuid,
  p_user_id uuid,
  p_failure_class text,
  p_http_status integer default null,
  p_latency_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare v_updated integer;
begin
  update public.ai_quota_reservations set status = 'released', failure_class = p_failure_class,
    finalized_at = now(), updated_at = now()
  where id = p_reservation_id and user_id = p_user_id and status in ('reserved', 'started');
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;
  update public.ai_requests_log set status = 'released', failure_class = p_failure_class,
    http_status = p_http_status, latency_ms = greatest(coalesce(p_latency_ms, 0), 0),
    metadata = coalesce(p_metadata, '{}'::jsonb), usage_source = 'unknown', finalized_at = now()
  where reservation_id = p_reservation_id and user_id = p_user_id;
  return true;
end;
$function$;

create or replace function public.expire_stale_ai_reservations()
returns integer language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare v_count integer;
begin
  with expired as (
    update public.ai_quota_reservations set status = 'expired', finalized_at = now(), updated_at = now()
    where status in ('reserved', 'started') and expires_at <= now() returning id
  ) select count(*) into v_count from expired;
  update public.ai_requests_log set status = 'expired', usage_source = 'unknown', finalized_at = now()
  where status in ('reserved', 'started') and reservation_id in (
    select id from public.ai_quota_reservations where status = 'expired' and finalized_at >= now() - interval '1 minute'
  );
  return v_count;
end;
$function$;

revoke all on function public.reserve_ai_quota(text, text, text) from public, anon;
grant execute on function public.reserve_ai_quota(text, text, text) to authenticated;
revoke all on function public.start_ai_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_ai_request_success(uuid, uuid, text, text, text, integer, integer, integer, integer, bigint, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_ai_request_failure(uuid, uuid, text, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.expire_stale_ai_reservations() from public, anon, authenticated;
grant execute on function public.start_ai_request(uuid, uuid) to service_role;
grant execute on function public.finalize_ai_request_success(uuid, uuid, text, text, text, integer, integer, integer, integer, bigint, text, integer, jsonb) to service_role;
grant execute on function public.finalize_ai_request_failure(uuid, uuid, text, integer, integer, jsonb) to service_role;
grant execute on function public.expire_stale_ai_reservations() to service_role;

commit;
