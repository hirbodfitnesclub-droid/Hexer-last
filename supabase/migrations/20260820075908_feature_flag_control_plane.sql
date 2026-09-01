begin;

create table if not exists public.feature_flags (
  key text primary key,
  description text not null default '',
  stage text not null default 'off'
    check (stage in ('off', 'shadow', 'suggestion', 'canary_write', 'gradual', 'active', 'deprecated')),
  enabled boolean not null default false,
  rollout_percent numeric(5,2) not null default 0
    check (rollout_percent >= 0 and rollout_percent <= 100),
  rollout_salt text not null default 'v1',
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object'),
  starts_at timestamptz,
  expires_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.feature_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null references public.feature_flags(key) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  cohort text,
  environment text not null default 'production',
  enabled boolean,
  stage text check (stage is null or stage in ('off', 'shadow', 'suggestion', 'canary_write', 'gradual', 'active', 'deprecated')),
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object'),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or cohort is not null),
  unique nulls not distinct (flag_key, user_id, cohort, environment)
);

create table if not exists public.feature_flag_exposures (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete restrict,
  flag_version bigint not null,
  stage text not null,
  enabled boolean not null,
  bucket integer not null check (bucket >= 0 and bucket < 10000),
  reason text not null check (reason in ('inactive', 'override', 'rollout', 'enabled')),
  created_at timestamptz not null default now(),
  unique (request_id, flag_key)
);

create table if not exists public.deprecation_registry (
  key text primary key,
  owner text not null,
  replacement_key text,
  status text not null default 'candidate'
    check (status in ('candidate', 'shadow', 'canary', 'active', 'deprecated', 'disabled', 'removed')),
  introduced_at timestamptz not null default now(),
  deprecated_at timestamptz,
  sunset_at timestamptz,
  rollback_target text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  updated_at timestamptz not null default now(),
  check (sunset_at is null or deprecated_at is null or sunset_at >= deprecated_at)
);

create index if not exists feature_flag_overrides_user_idx
  on public.feature_flag_overrides (user_id, flag_key)
  where user_id is not null;
create index if not exists feature_flag_overrides_cohort_idx
  on public.feature_flag_overrides (cohort, flag_key)
  where cohort is not null;
create index if not exists feature_flag_exposures_user_created_idx
  on public.feature_flag_exposures (user_id, created_at desc);
create index if not exists feature_flag_exposures_flag_created_idx
  on public.feature_flag_exposures (flag_key, created_at desc);

alter table public.feature_flags enable row level security;
alter table public.feature_flag_overrides enable row level security;
alter table public.feature_flag_exposures enable row level security;
alter table public.deprecation_registry enable row level security;

revoke all on public.feature_flags from public, anon, authenticated;
revoke all on public.feature_flag_overrides from public, anon, authenticated;
revoke all on public.feature_flag_exposures from public, anon, authenticated;
revoke all on public.deprecation_registry from public, anon, authenticated;
grant all on public.feature_flags to service_role;
grant all on public.feature_flag_overrides to service_role;
grant all on public.feature_flag_exposures to service_role;
grant all on public.deprecation_registry to service_role;

insert into public.feature_flags (key, description, stage, enabled, rollout_percent, rollout_salt)
values
  ('agent_writes', 'Server-authoritative gate for AI mutations', 'active', true, 100, 'agent-writes-v1'),
  ('recurrence_rpc_v2', 'Atomic server recurrence operations', 'off', false, 0, 'recurrence-v2'),
  ('reminder_outbox_v2', 'Durable notification outbox and dispatcher', 'off', false, 0, 'reminder-v2'),
  ('offline_sync_v2', 'Versioned operation-based offline sync', 'off', false, 0, 'offline-v2'),
  ('memory_v2', 'Document/chunk memory retrieval pipeline', 'off', false, 0, 'memory-v2'),
  ('voice_actions_v2', 'Two-stage voice transcription and confirmed actions', 'off', false, 0, 'voice-v2'),
  ('automations_v1', 'Suggestion-first automation rules', 'off', false, 0, 'automations-v1'),
  ('calendar_writes_v1', 'Confirmed calendar write-back', 'off', false, 0, 'calendar-v1')
on conflict (key) do nothing;

insert into public.deprecation_registry (key, owner, status, replacement_key, rollback_target)
values
  ('consume_ai_quota', 'ai-platform', 'active', 'ai_quota_reservations', 'consume_ai_quota'),
  ('legacy_recurrence_client_spawn', 'tasks', 'active', 'recurrence_rpc_v2', 'legacy_recurrence_client_spawn'),
  ('legacy_reminder_foreground_generation', 'notifications', 'active', 'reminder_outbox_v2', 'legacy_reminder_foreground_generation'),
  ('legacy_entity_embeddings', 'memory', 'active', 'memory_v2', 'legacy_entity_embeddings')
on conflict (key) do nothing;

commit;
