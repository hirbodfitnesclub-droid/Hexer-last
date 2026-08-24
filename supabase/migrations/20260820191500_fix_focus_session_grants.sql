begin;

-- Security fix. This project's default ACL grants anon and authenticated every
-- privilege on newly created tables, so `focus_sessions` silently received TRUNCATE
-- and TRIGGER for both roles. TRUNCATE is not subject to row level security, which
-- means anon could have emptied the table despite the RLS policies. Every other user
-- table was already narrowed by the earlier least-privilege work; this one was the
-- regression.

revoke all on public.focus_sessions from anon, authenticated;
grant select, insert, update, delete on public.focus_sessions to authenticated;

commit;
