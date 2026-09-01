begin;

-- Proactive platform: automation rules, durable user memory facts, focus sessions, and
-- calendar links. Everything defaults to suggestion-only. Automatic writes require an
-- explicit opt-in mode on a rule, and calendar starts read-only.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  trigger_type text not null
    check (trigger_type in ('task_overdue', 'task_completed', 'daily_time', 'focus_ended', 'calendar_event')),
  trigger_config jsonb not null default '{}'::jsonb check (jsonb_typeof(trigger_config) = 'object'),
  conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(conditions) = 'array'),
  action_type text not null
    check (action_type in ('suggest_task', 'suggest_reschedule', 'create_reminder', 'notify')),
  action_config jsonb not null default '{}'::jsonb check (jsonb_typeof(action_config) = 'object'),
  -- 'suggest' is the default everywhere; 'automatic' is opt-in per rule.
  mode text not null default 'suggest' check (mode in ('suggest', 'confirm', 'automatic')),
  enabled boolean not null default false,
  timezone text not null default 'Asia/Tehran',
  quiet_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(quiet_hours) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_version bigint not null,
  idempotency_key text not null,
  matched_conditions jsonb not null default '[]'::jsonb,
  proposed_action jsonb not null default '{}'::jsonb,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'executed', 'failed', 'skipped')),
  operation_id uuid references public.mutation_operations(op_id) on delete set null,
  error_code text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  -- One run per rule per trigger occurrence; replaying a trigger cannot double-act.
  unique (user_id, rule_id, idempotency_key)
);

create table if not exists public.user_memory_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fact_key text not null check (length(btrim(fact_key)) > 0),
  fact_value text not null,
  -- Where this came from, so the user can see why the assistant believes it.
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'sensitive')),
  -- Nothing is used for personalization until the user confirms it.
  user_confirmed boolean not null default false,
  status text not null default 'shadow'
    check (status in ('shadow', 'active', 'superseded', 'forgotten')),
  superseded_by uuid references public.user_memory_facts(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fact_key, status) deferrable initially deferred
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  planned_minutes integer not null check (planned_minutes > 0 and planned_minutes <= 480),
  -- Server timestamps are authoritative, so a reload or device switch cannot invent time.
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_ms integer not null default 0 check (paused_ms >= 0),
  state text not null default 'running' check (state in ('running', 'paused', 'completed', 'abandoned')),
  device_id text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook', 'caldav')),
  account_label text,
  -- Tokens live in Vault; this only records which secret to fetch.
  credential_secret_name text not null,
  scopes text[] not null default '{}'::text[],
  access_mode text not null default 'read_only' check (access_mode in ('read_only', 'read_write')),
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_synced_at timestamptz,
  sync_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, account_label)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_event_id text not null,
  etag text,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Tehran',
  is_all_day boolean not null default false,
  linked_task_id uuid references public.tasks(id) on delete set null,
  raw jsonb not null default '{}'::jsonb check (jsonb_typeof(raw) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_event_id),
  check (ends_at >= starts_at)
);

create index if not exists automation_rules_user_enabled_idx
  on public.automation_rules (user_id, enabled, trigger_type);
create index if not exists automation_runs_user_status_idx
  on public.automation_runs (user_id, status, created_at desc);
create index if not exists user_memory_facts_user_status_idx
  on public.user_memory_facts (user_id, status, updated_at desc);
create index if not exists focus_sessions_user_state_idx
  on public.focus_sessions (user_id, state, started_at desc);
create index if not exists calendar_events_user_window_idx
  on public.calendar_events (user_id, starts_at, ends_at);

alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.user_memory_facts enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_events enable row level security;

revoke all on public.automation_rules from public, anon, authenticated;
revoke all on public.automation_runs from public, anon, authenticated;
revoke all on public.user_memory_facts from public, anon, authenticated;
revoke all on public.calendar_connections from public, anon, authenticated;
revoke all on public.calendar_events from public, anon, authenticated;
grant all on public.automation_rules to service_role;
grant all on public.automation_runs to service_role;
grant all on public.user_memory_facts to service_role;
grant all on public.focus_sessions to service_role;
grant all on public.calendar_connections to service_role;
grant all on public.calendar_events to service_role;

create policy "service manages automation rules" on public.automation_rules
  for all to service_role using (true) with check (true);
create policy "service manages automation runs" on public.automation_runs
  for all to service_role using (true) with check (true);
create policy "service manages memory facts" on public.user_memory_facts
  for all to service_role using (true) with check (true);
create policy "service manages calendar connections" on public.calendar_connections
  for all to service_role using (true) with check (true);
create policy "service manages calendar events" on public.calendar_events
  for all to service_role using (true) with check (true);

-- Focus sessions are the one table the client owns directly, matching how tasks and
-- notes already work, so the timer keeps working offline through the normal client.
grant select, insert, update, delete on public.focus_sessions to authenticated;
create policy "users manage their focus sessions" on public.focus_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "service manages focus sessions" on public.focus_sessions
  for all to service_role using (true) with check (true);

create or replace trigger focus_sessions_bump_version before update on public.focus_sessions
  for each row execute function public.bump_entity_version();

insert into public.feature_flags (key, description, stage, enabled, rollout_percent, rollout_salt)
values
  ('automations_v1', 'Suggestion-first automation rules', 'off', false, 0, 'automations-v1'),
  ('conversational_memory_v1', 'Durable user facts with consent', 'off', false, 0, 'convmem-v1'),
  ('focus_sessions_v1', 'Server-authoritative focus sessions', 'off', false, 0, 'focus-v1'),
  ('calendar_writes_v1', 'Confirmed calendar write-back', 'off', false, 0, 'calendar-v1')
on conflict (key) do nothing;

commit;
