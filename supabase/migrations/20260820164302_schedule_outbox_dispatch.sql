begin;

-- Schedules the outbox dispatcher next to the legacy push worker. It is inert until
-- reminder_outbox_v2 is enabled, because nothing enqueues into notification_messages
-- yet, so each run claims an empty batch. Both jobs use the same Vault secret.

select cron.unschedule(jobid)
from cron.job
where jobname = 'outbox-dispatch-cron';

select cron.schedule(
  'outbox-dispatch-cron',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://rvgiidesehuaqqncqilu.supabase.co/functions/v1/outbox-dispatch',
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
