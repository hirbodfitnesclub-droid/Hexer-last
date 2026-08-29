begin;

-- Schedules the Memory V2 indexer next to the other workers. The queue is empty until
-- a user edits something or the backfill is run, so this claims nothing today; it exists
-- so that when jobs do appear they are drained without a manual step.

select cron.unschedule(jobid)
from cron.job
where jobname = 'memory-indexer-cron';

select cron.schedule(
  'memory-indexer-cron',
  '*/2 * * * *',
  $cron$
    select net.http_post(
      url := 'https://rvgiidesehuaqqncqilu.supabase.co/functions/v1/memory-indexer',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-worker-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'vectorize_worker_secret'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$
);

commit;
