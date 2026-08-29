begin;

create table if not exists public.sms_hook_deliveries (
  delivery_key text primary key,
  phone_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.sms_hook_deliveries enable row level security;
revoke all on table public.sms_hook_deliveries from public, anon, authenticated;
grant select, insert, delete on table public.sms_hook_deliveries to service_role;
create index if not exists sms_hook_deliveries_created_idx
  on public.sms_hook_deliveries(created_at);

notify pgrst, 'reload schema';
commit;
