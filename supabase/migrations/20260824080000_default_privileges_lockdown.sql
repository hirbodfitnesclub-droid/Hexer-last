begin;

-- ISSUE_03-A (QA phase 1.6): the project-wide default privileges still grant every
-- privilege — including TRUNCATE — to anon/authenticated for FUTURE tables in public.
-- That is the root cause pattern behind the old focus_sessions incident.
--
-- After this migration, every new table in public starts with zero client grants and
-- each migration/table owner MUST grant explicitly what clients need (see the grant
-- blocks used across supabase/sql/*). Tables created BEFORE this migration keep their
-- current grants; this changes defaults only.

alter default privileges in schema public
  revoke all on tables from anon;
alter default privileges in schema public
  revoke all on tables from authenticated;

-- supabase_admin owns a second set of defaults; attempt to lock it down too, but do
-- not fail the migration if this connection lacks membership in that role.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin')
     and pg_has_role(current_user, 'supabase_admin', 'member') then
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from authenticated';
  end if;
exception
  when insufficient_privilege then null;
end $$;

commit;
