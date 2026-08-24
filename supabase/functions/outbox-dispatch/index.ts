import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';
import { jsonResponse, requireWorkerSecret, safeErrorResponse } from '../_shared/security.ts';
import {
  classifyPushFailure,
  emptyTally,
  tallyDelivery,
} from '../_shared/notification-outbox.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'null',
  'Access-Control-Allow-Headers': 'content-type, x-worker-secret',
};

declare const Deno: any;

/**
 * Outbox dispatcher. Runs alongside the legacy view-driven worker: this one only
 * touches rows in `notification_messages`, which nothing enqueues into until
 * `reminder_outbox_v2` is switched on. Until then every invocation claims an empty
 * batch and exits, so it is inert in production.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    await requireWorkerSecret(req, 'PUSH_DISPATCH_SECRET');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@hexer.ai';
    if (!vapidPub || !vapidPriv) {
      return jsonResponse({ error: 'VAPID keys not configured' }, 500, corsHeaders);
    }
    webpush.setVapidDetails(vapidSubject, vapidPub, vapidPriv);

    // The legacy push-dispatch worker still owns delivery today. Until reminder_outbox_v2
    // is on, this worker must neither materialize nor send, otherwise a user would get
    // the same notification twice: once from each worker.
    const { data: flag, error: flagError } = await supabase
      .from('feature_flags')
      .select('stage,enabled,rollout_percent')
      .eq('key', 'reminder_outbox_v2')
      .maybeSingle();
    if (flagError) throw new Error(`Flag lookup failed: ${flagError.message}`);

    const outboxActive = !!flag
      && flag.enabled === true
      && flag.stage !== 'off'
      && Number(flag.rollout_percent) > 0;

    if (!outboxActive) {
      return jsonResponse({ skipped: 'feature_disabled', claimed: 0 }, 200, corsHeaders);
    }

    // Task due dates are a time condition, not a row change, so they are materialized
    // here rather than by a trigger. Enqueueing is idempotent on the occurrence key.
    const { error: materializeError } = await supabase.rpc('enqueue_due_task_reminders', {
      p_horizon_minutes: 5,
    });
    if (materializeError) throw new Error(`Materialize failed: ${materializeError.message}`);

    // A distinct owner per invocation, so an expired lease is always reclaimed by a
    // different owner and never silently re-taken by a duplicate of the same worker.
    const leaseOwner = `outbox-${crypto.randomUUID()}`;
    const { data: claimed, error: claimError } = await supabase.rpc('claim_notification_messages', {
      p_lease_owner: leaseOwner,
      p_batch_size: 25,
      p_lease_seconds: 60,
    });
    if (claimError) throw new Error(`Claim failed: ${claimError.message}`);

    const messages = Array.isArray(claimed) ? claimed : [];
    if (messages.length === 0) {
      return jsonResponse({ claimed: 0, sent: 0, retried: 0, dead: 0 }, 200, corsHeaders);
    }

    let sent = 0;
    let retried = 0;
    let dead = 0;
    let partial = 0;

    for (const message of messages) {
      const { data: subs, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('endpoint,p256dh,auth')
        .eq('user_id', message.user_id);
      if (subsError) throw new Error(`Subscription lookup failed: ${subsError.message}`);

      let tally = emptyTally();
      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: message.title,
              body: message.body ?? '',
              tag: `${message.channel_purpose}-${message.entity_id ?? message.user_id}`,
              // The one identity shared by database, push payload, service worker,
              // local shown-store, and inbox.
              messageId: message.message_id,
              data: {
                messageId: message.message_id,
                purpose: message.channel_purpose,
                entityType: message.entity_type,
                entityId: message.entity_id,
              },
            })
          );
          tally = tallyDelivery(tally, { outcome: 'succeeded' });
          await supabase.rpc('record_notification_delivery', {
            p_message_id: message.message_id,
            p_user_id: message.user_id,
            p_channel: 'web_push',
            p_endpoint: sub.endpoint,
            p_status: 'succeeded',
            p_provider_status: 201,
            p_error_code: null,
          });
        } catch (pushError: any) {
          const failure = classifyPushFailure(pushError?.statusCode);
          tally = tallyDelivery(tally, {
            outcome: failure.outcome,
            permanent: failure.permanent,
            errorCode: failure.errorCode,
          });
          await supabase.rpc('record_notification_delivery', {
            p_message_id: message.message_id,
            p_user_id: message.user_id,
            p_channel: 'web_push',
            p_endpoint: sub.endpoint,
            p_status: failure.outcome === 'expired' ? 'expired' : 'failed',
            p_provider_status: typeof pushError?.statusCode === 'number' ? pushError.statusCode : null,
            p_error_code: failure.errorCode,
          });
          if (failure.outcome === 'expired') {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }

      const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_notification_message', {
        p_message_id: message.message_id,
        p_user_id: message.user_id,
        p_succeeded: tally.succeeded,
        p_failed: tally.failed,
        p_permanent: tally.permanent,
        p_max_attempts: 5,
        p_error_code: tally.lastErrorCode,
      });
      if (finalizeError) throw new Error(`Finalize failed: ${finalizeError.message}`);

      const state = (finalized as any)?.state;
      if (state === 'sent') sent += 1;
      else if (state === 'partial') partial += 1;
      else if (state === 'retry') retried += 1;
      else if (state === 'dead') dead += 1;
    }

    return jsonResponse({ claimed: messages.length, sent, partial, retried, dead }, 200, corsHeaders);
  } catch (error: any) {
    console.error('Outbox dispatch error:', error);
    return safeErrorResponse(error, corsHeaders);
  }
});
