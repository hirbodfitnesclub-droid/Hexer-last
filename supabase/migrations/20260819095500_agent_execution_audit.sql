begin;

create table if not exists public.agent_execution_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null default gen_random_uuid(),
  intent text not null check (intent in ('chat', 'create', 'search', 'link', 'extract', 'mutate')),
  model text not null,
  thinking_effort text not null check (thinking_effort in ('minimal', 'low', 'medium', 'high')),
  accepted_action_count integer not null default 0 check (accepted_action_count >= 0),
  rejected_action_count integer not null default 0 check (rejected_action_count >= 0),
  successful_action_count integer not null default 0 check (successful_action_count >= 0),
  failed_action_count integer not null default 0 check (failed_action_count >= 0),
  honesty_mode text not null check (honesty_mode in ('none', 'full', 'partial')),
  latency_ms integer not null check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_audit_user_created_idx
  on public.agent_execution_audit (user_id, created_at desc);

alter table public.agent_execution_audit enable row level security;
revoke all on public.agent_execution_audit from public, anon, authenticated;
grant all on public.agent_execution_audit to service_role;

commit;
