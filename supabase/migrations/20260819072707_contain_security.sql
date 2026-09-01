begin;

-- Remove the compromised legacy service-role JWT from Vault. A dedicated random
-- worker secret, with no Supabase API privileges, must be stored as
-- push_dispatch_secret before enabling the cron.
do $$
begin
  delete from vault.secrets where name = 'service_role_key';
exception when undefined_table or invalid_schema_name then
  raise notice 'Vault is not available in this environment';
end;
$$;

-- Do not let the old cron continue with a credential that was committed to git.
do $$
begin
  perform cron.unschedule('push-dispatch-cron');
exception when undefined_function or invalid_schema_name then
  raise notice 'push-dispatch-cron was not present';
end;
$$;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  status text not null check (status in ('requested', 'succeeded', 'failed')),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select, insert on table public.admin_audit_log to service_role;
create index if not exists idx_admin_audit_log_admin_created
  on public.admin_audit_log(admin_user_id, created_at desc);

-- Views expose push encryption material and therefore must never be reachable
-- from browser roles, even when a future view option changes.
alter view public.pending_push_reminders set (security_invoker = true);
revoke all on table public.pending_push_reminders from public, anon, authenticated;
grant select on table public.pending_push_reminders to service_role;

-- Cross-tenant references are rejected at the schema boundary as defense in depth.
create unique index if not exists projects_id_user_unique on public.projects(id, user_id);
create unique index if not exists tasks_id_user_unique on public.tasks(id, user_id);
create unique index if not exists notes_id_user_unique on public.notes(id, user_id);

alter table public.tasks drop constraint if exists tasks_project_owner_fkey;
alter table public.tasks add constraint tasks_project_owner_fkey
  foreign key (project_id, user_id) references public.projects(id, user_id)
  on delete set null (project_id) not valid;
alter table public.tasks validate constraint tasks_project_owner_fkey;

alter table public.notes drop constraint if exists notes_project_owner_fkey;
alter table public.notes add constraint notes_project_owner_fkey
  foreign key (project_id, user_id) references public.projects(id, user_id)
  on delete set null (project_id) not valid;
alter table public.notes validate constraint notes_project_owner_fkey;

alter table public.task_note_links drop constraint if exists task_note_links_task_owner_fkey;
alter table public.task_note_links add constraint task_note_links_task_owner_fkey
  foreign key (task_id, user_id) references public.tasks(id, user_id)
  on delete cascade not valid;
alter table public.task_note_links validate constraint task_note_links_task_owner_fkey;

alter table public.task_note_links drop constraint if exists task_note_links_note_owner_fkey;
alter table public.task_note_links add constraint task_note_links_note_owner_fkey
  foreign key (note_id, user_id) references public.notes(id, user_id)
  on delete cascade not valid;
alter table public.task_note_links validate constraint task_note_links_note_owner_fkey;

-- Privileged payment/admin/worker routines are service-only. Trigger functions
-- are not callable through the Data API either.
revoke execute on function public.activate_subscription(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.activate_subscription(uuid, text, uuid) to service_role;
revoke execute on function public.activate_manual_subscription(uuid) from public, anon, authenticated;
grant execute on function public.activate_manual_subscription(uuid) to service_role;
revoke execute on function public.reject_manual_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.reject_manual_payment(uuid, text) to service_role;
revoke execute on function public.get_daily_nudge_candidates() from public, anon, authenticated;
grant execute on function public.get_daily_nudge_candidates() to service_role;
revoke execute on function public.enqueue_vectorize() from public, anon, authenticated;
grant execute on function public.enqueue_vectorize() to service_role;
revoke execute on function public.notify_telegram_on_manual_payment() from public, anon, authenticated;
grant execute on function public.notify_telegram_on_manual_payment() to service_role;
revoke execute on function public.notify_telegram_on_new_ticket() from public, anon, authenticated;
grant execute on function public.notify_telegram_on_new_ticket() to service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

-- Analytics and discount internals are never exposed to browser roles.
revoke all on table public.discount_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.discount_codes to service_role;
drop policy if exists "Allow select for authenticated users" on public.discount_codes;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'marketing') then
    revoke usage on schema marketing from public, anon, authenticated;
    revoke all privileges on all tables in schema marketing from public, anon, authenticated;
    revoke execute on all functions in schema marketing from public, anon, authenticated;
    alter default privileges in schema marketing revoke select on tables from public, anon, authenticated;
  end if;
end;
$$;

-- User-facing routines require a real authenticated JWT and never anon/PUBLIC.
do $$
declare
  routine regprocedure;
begin
  foreach routine in array array[
    'public.create_task_with_tags(text,text,uuid,timestamptz,text,text[],jsonb,uuid,jsonb,uuid)'::regprocedure,
    'public.create_note_with_tags(text,text,uuid,text[],uuid)'::regprocedure,
    'public.consume_ai_quota()'::regprocedure,
    'public.hybrid_search(vector,text,integer)'::regprocedure,
    'public.match_documents(vector,double precision,integer)'::regprocedure,
    'public.link_task_note(uuid,uuid)'::regprocedure,
    'public.unlink_task_note(uuid,uuid)'::regprocedure,
    'public.get_linked_notes(uuid)'::regprocedure,
    'public.get_linked_tasks(uuid)'::regprocedure,
    'public.get_or_create_today_session()'::regprocedure,
    'public.get_chat_sessions(integer)'::regprocedure,
    'public.get_usage_status()'::regprocedure,
    'public.get_daily_usage(integer)'::regprocedure,
    'public.get_related_knowledge_today(text)'::regprocedure,
    'public.submit_manual_payment(text,text,text)'::regprocedure,
    'public.preview_discount(text,text)'::regprocedure,
    'public.upsert_push_subscription(text,text,text,text)'::regprocedure
  ] loop
    execute format('revoke execute on function %s from public, anon', routine);
    execute format('grant execute on function %s to authenticated', routine);
  end loop;
end;
$$;

-- Storage policies include the bucket boundary. Receipts are immutable after
-- upload so users cannot replace evidence while an admin is reviewing it.
drop policy if exists "Allow authenticated selects" on storage.objects;
drop policy if exists "Allow authenticated inserts" on storage.objects;
drop policy if exists "Allow authenticated updates" on storage.objects;
drop policy if exists "Allow authenticated deletes" on storage.objects;

create policy "Users read owned private objects" on storage.objects
  for select to authenticated
  using (bucket_id in ('chat-media', 'avatars', 'receipts') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users insert owned private objects" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('chat-media', 'avatars', 'receipts') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update owned mutable objects" on storage.objects
  for update to authenticated
  using (bucket_id in ('chat-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('chat-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete owned mutable objects" on storage.objects
  for delete to authenticated
  using (bucket_id in ('chat-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'receipts';

notify pgrst, 'reload schema';
commit;
