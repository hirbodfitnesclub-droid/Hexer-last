begin;

-- Fix-cycle 1 infrastructure hardening:
--  1. Extensions the memory/billing migrations depend on, so a fresh environment
--     can replay the migration history without the local-only bootstrap script.
--  2. Retention for feature_flag_exposures: client-supplied request ids made the
--     table append-only; cap it with a daily purge.

-- 1. Self-contained extensions (no-ops where already installed, e.g. production).
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- 2. Exposure retention. Unique (request_id, flag_key) keeps rows bounded per
--    request, but request ids accumulate over time; 30 days is ample for QA.
select cron.unschedule(jobid) from cron.job where jobname = 'feature-exposure-retention';

select cron.schedule(
  'feature-exposure-retention',
  '17 3 * * *',
  $cron$
    delete from public.feature_flag_exposures
    where created_at < now() - interval '30 days';
  $cron$
);

commit;
