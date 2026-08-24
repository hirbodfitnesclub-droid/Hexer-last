begin;

revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all sequences in schema net from public, anon, authenticated;
revoke all on all tables in schema cron from public, anon, authenticated;
revoke all on all sequences in schema cron from public, anon, authenticated;
revoke all on all tables in schema vault from public, anon, authenticated;
revoke all on all sequences in schema vault from public, anon, authenticated;
revoke usage on schema net, cron, vault from anon, authenticated;

create or replace function public.verify_worker_secret(p_name text, p_supplied text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, vault, extensions
as $function$
  select case
    when p_name not in ('push_dispatch_secret', 'vectorize_worker_secret') then false
    when p_supplied is null or length(p_supplied) < 32 then false
    else coalesce((
      select extensions.digest(ds.decrypted_secret, 'sha256') = extensions.digest(p_supplied, 'sha256')
      from vault.decrypted_secrets ds
      where ds.name = p_name
      limit 1
    ), false)
  end;
$function$;

revoke all on function public.verify_worker_secret(text, text) from public, anon, authenticated;
grant execute on function public.verify_worker_secret(text, text) to service_role;

select vault.create_secret(
  pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
  'push_dispatch_secret',
  'Dedicated secret for the push-dispatch cron worker',
  null
)
where not exists (select 1 from vault.secrets where name = 'push_dispatch_secret');

select vault.create_secret(
  pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
  'vectorize_worker_secret',
  'Dedicated secret for database vectorization triggers',
  null
)
where not exists (select 1 from vault.secrets where name = 'vectorize_worker_secret');

create or replace function public.enqueue_vectorize()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $function$
declare
  v_type text;
  v_content text;
  v_worker_secret text;
begin
  if tg_table_name = 'tasks' then
    v_type := 'task';
    v_content := coalesce(new.title, '') || ' ' || coalesce(new.description, '');
  elsif tg_table_name = 'notes' then
    v_type := 'note';
    v_content := coalesce(new.title, '') || ' ' || coalesce(new.content, '');
  elsif tg_table_name = 'projects' then
    v_type := 'project';
    v_content := coalesce(new.title, '') || ' ' || coalesce(new.description, '');
  else
    return new;
  end if;

  if btrim(v_content) = '' then
    return new;
  end if;

  select decrypted_secret into v_worker_secret
  from vault.decrypted_secrets
  where name = 'vectorize_worker_secret'
  limit 1;

  if v_worker_secret is null then
    raise warning 'Vectorization worker secret is unavailable';
    return new;
  end if;

  perform net.http_post(
    url := 'https://rvgiidesehuaqqncqilu.supabase.co/functions/v1/vectorize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', v_worker_secret
    ),
    body := jsonb_build_object('type', v_type, 'id', new.id),
    timeout_milliseconds := 10000
  );

  return new;
end;
$function$;

revoke all on function public.enqueue_vectorize() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'push-dispatch-cron';

select cron.schedule(
  'push-dispatch-cron',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://rvgiidesehuaqqncqilu.supabase.co/functions/v1/push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-worker-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'push_dispatch_secret'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
  $cron$
);

commit;
