-- ============================================================================
-- IDEMPOTENT MIGRATION: 41_fix_push_dispatch_transport.sql
-- Description: Sets up secure, reliable pg_net + pg_cron transports for push alerts
-- using decrypted credentials from Supabase Vault instead of app settings.
-- ============================================================================

-- IMPORTANT FOR ADMINS:
-- 1. Ensure the extensions 'pg_net' and 'pg_cron' are enabled in your Supabase panel (extensions tab).
-- 2. VAPID encryption requires match of public (client) and private (server/Edge) keys.
-- 3. To set your true credentials manually inside Vault after this migration, run:
--    select vault.update_secret('YOUR_SECRET_ID', 'your-real-value');
--    or manage secrets directly in your Supabase Dashboard Vault settings.

-- 1. Enable pg_net and pg_cron extensions if available
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2. Create the placeholder Vault secrets (if they do not already exist)
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'push_dispatch_url') then
    perform vault.create_secret('https://rvgiidesehuaqqncqilu.supabase.co/functions/v1/push-dispatch', 'push_dispatch_url', 'URL for the push-dispatch Edge Function');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') then
    perform vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z2lpZGVzZWh1YXFxbmNxaWx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA1NzQ0NCwiZXhwIjoyMDk1NjMzNDQ0fQ.wGF2rnZzi6zRMGO52rki4vLvLeyK-AdGeplwd_ujUvg', 'service_role_key', 'Service role key for Authorization header');
  end if;
end;
$$;

-- 3. Safely unschedule the previous cron job if it exists
do $$
begin
  perform cron.unschedule('push-dispatch-cron');
exception
  when others then
    raise notice 'Job push-dispatch-cron was not found or could not be unscheduled, proceeding...';
end;
$$;

-- 4. Re-schedule the cron job utilizing Vault secrets
select cron.schedule(
  'push-dispatch-cron',
  '* * * * *',
  $$
  select net.http_post(
    url := (select coalesce(max(decrypted_secret), 'https://rvgiidesehuaqqncqilu.supabase.co/functions/v1/push-dispatch') from vault.decrypted_secrets where name = 'push_dispatch_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select coalesce(max(decrypted_secret), '') from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Create push_dispatch_log table for observability
create table if not exists public.push_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  cleaned_count integer not null default 0,
  notes text
);

-- Apply highly restrictive RLS on logging table (only Admin/service_role can look/write, default behavior with no policies)
alter table public.push_dispatch_log enable row level security;

-- 6. Create highly optimal performance partial index on incomplete tasks
create index if not exists idx_tasks_due_pending 
on public.tasks(due_date) 
where completed_at is null;

notify pgrst, 'reload schema';
