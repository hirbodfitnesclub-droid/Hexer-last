begin;

-- Background writes must not invalidate a client's optimistic version. The
-- vectorize worker updates `embedding` after insert, which previously bumped the
-- row to version 2 and made the very first user mutation fail with a conflict.
create or replace function public.bump_entity_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  v_old := v_old - 'version' - 'updated_at' - 'embedding' - 'search_vector';
  v_new := v_new - 'version' - 'updated_at' - 'embedding' - 'search_vector';
  if v_old <> v_new then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$function$;

revoke all on function public.bump_entity_version() from public, anon, authenticated;
grant execute on function public.bump_entity_version() to service_role;

commit;
