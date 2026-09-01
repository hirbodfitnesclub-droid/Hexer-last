begin;

-- Durable notification outbox. One logical message id is shared by the database row,
-- the push payload, the service worker, the local shown-store, and the inbox, so a
-- foreground display and a push delivery can never be counted as two notifications.
--
-- Nothing reads from these tables until reminder_outbox_v2 is enabled; the existing
-- view-driven dispatcher keeps running unchanged in the meantime.

create table if not exists public.notification_messages (
  message_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_purpose text not null
    check (channel_purpose in ('task_reminder', 'custom_reminder', 'daily_nudge', 'automation')),
  occurrence_key text not null,
  entity_type text check (entity_type is null or entity_type in ('task', 'habit', 'reminder', 'automation')),
  entity_id uuid,
  title text not null check (length(btrim(title)) > 0),
  body text,
  scheduled_for timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  state text not null default 'pending'
    check (state in ('pending', 'leased', 'sent', 'partial', 'retry', 'dead', 'cancelled', 'superseded')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error_code text,
  sent_at timestamptz,
  read_at timestamptz,
  superseded_by uuid references public.notification_messages(message_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One logical message per user, purpose, and occurrence. A rescheduled reminder
  -- produces a new occurrence key rather than mutating a delivered one.
  unique (user_id, channel_purpose, occurrence_key),
  check (lease_owner is null or lease_expires_at is not null)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.notification_messages(message_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('web_push', 'foreground', 'realtime')),
  endpoint text,
  status text not null check (status in ('succeeded', 'failed', 'expired', 'skipped')),
  provider_status integer,
  error_code text,
  attempted_at timestamptz not null default now(),
  -- Retrying the same attempt number for the same endpoint is idempotent.
  attempt_number integer not null default 1 check (attempt_number >= 1),
  unique nulls not distinct (message_id, channel, endpoint, attempt_number)
);

create table if not exists public.notification_dead_letters (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_purpose text not null,
  occurrence_key text not null,
  attempt_count integer not null,
  last_error_code text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_messages_claimable_idx
  on public.notification_messages (next_attempt_at, scheduled_for)
  where state in ('pending', 'retry');
create index if not exists notification_messages_lease_idx
  on public.notification_messages (lease_expires_at)
  where state = 'leased';
create index if not exists notification_messages_user_state_idx
  on public.notification_messages (user_id, state, scheduled_for desc);
create index if not exists notification_messages_entity_idx
  on public.notification_messages (user_id, entity_type, entity_id)
  where entity_id is not null;
create index if not exists notification_deliveries_message_idx
  on public.notification_deliveries (message_id, attempted_at desc);

alter table public.notification_messages enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_dead_letters enable row level security;
revoke all on public.notification_messages from public, anon, authenticated;
revoke all on public.notification_deliveries from public, anon, authenticated;
revoke all on public.notification_dead_letters from public, anon, authenticated;
grant all on public.notification_messages to service_role;
grant all on public.notification_deliveries to service_role;
grant all on public.notification_dead_letters to service_role;
create policy "service manages notification messages" on public.notification_messages
  for all to service_role using (true) with check (true);
create policy "service manages notification deliveries" on public.notification_deliveries
  for all to service_role using (true) with check (true);
create policy "service manages notification dead letters" on public.notification_dead_letters
  for all to service_role using (true) with check (true);

insert into public.feature_flags (key, description, stage, enabled, rollout_percent, rollout_salt)
values ('reminder_outbox_v2', 'Durable notification outbox and dispatcher', 'off', false, 0, 'reminder-v2')
on conflict (key) do nothing;

commit;
