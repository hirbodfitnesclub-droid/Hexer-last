import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';
import { jsonResponse, requireWorkerSecret, safeErrorResponse } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'null',
  'Access-Control-Allow-Headers': 'content-type, x-worker-secret',
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    await requireWorkerSecret(req, 'PUSH_DISPATCH_SECRET');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Resolve VAPID Credentials from env
    const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@hexer.ai';

    if (!vapidPub || !vapidPriv) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured under Edge environment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    try {
      webpush.setVapidDetails(vapidSubject, vapidPub, vapidPriv);
    } catch (setVapidErr: any) {
      console.error("Vapid initialization error:", setVapidErr);
      return new Response(JSON.stringify({ error: `Vapid setting failed: ${setVapidErr.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const logs: string[] = [];
    let sentCountTotal = 0;
    let failedCountTotal = 0;
    let cleanedCountTotal = 0;

    // Resolve Tehran date for Daily Nudge uniqueness
    const tehranDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    // ==========================================
    // 1. Process Overdue Task Reminders
    // ==========================================
    const { data: pendingReminders, error: errReminders } = await supabase
      .from('pending_push_reminders')
      .select('*');

    if (errReminders) {
      throw new Error(`Failed to query pending_push_reminders view: ${errReminders.message}`);
    }

    if (pendingReminders && pendingReminders.length > 0) {
      const groupedTasks: Record<string, { task: any; subs: any[] }> = {};
      
      for (const row of pendingReminders) {
        if (!groupedTasks[row.task_id]) {
          groupedTasks[row.task_id] = {
            task: {
              id: row.task_id,
              user_id: row.user_id,
              title: row.title,
              description: row.description,
              due_date: row.due_date
            },
            subs: []
          };
        }
        groupedTasks[row.task_id].subs.push({
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        });
      }

      for (const taskId of Object.keys(groupedTasks)) {
        const item = groupedTasks[taskId];
        logs.push(`Task ${taskId}: "${item.task.title}" -> ${item.subs.length} registrations.`);
        
        let sentCount = 0;
        const dueEpoch = new Date(item.task.due_date).getTime();
        const taskMessageId = `task-${item.task.id}-${dueEpoch}`;

        for (const sub of item.subs) {
          try {
            await webpush.sendNotification(sub, JSON.stringify({
              title: item.task.title,
              body: item.task.description || 'سررسید این وظیفه فرا رسیده است.',
              tag: `task-${item.task.id}`,
              messageId: taskMessageId,
              data: { taskId: item.task.id }
            }));
            sentCount++;
            sentCountTotal++;
          } catch (pushErr: any) {
            console.error(`Task Web Push payload failed for sub: ${sub.endpoint}`, pushErr);
            // Self-cleaning expired or broken endpoints
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint);
              logs.push(`Removed expired client push subscription: ${sub.endpoint}`);
              cleanedCountTotal++;
            } else {
              failedCountTotal++;
            }
          }
        }

        if (sentCount > 0) {
          const { error: insErr } = await supabase
            .from('reminders')
            .insert({
              user_id: item.task.user_id,
              title: item.task.title,
              body: item.task.description || null,
              remind_at: item.task.due_date,
              type: 'task',
              related_entity_type: 'task',
              related_entity_id: item.task.id,
              is_sent: true,
              is_read: false
            });

          if (insErr) console.error(`Failed to record delivered task reminder ${taskId}:`, insErr);
          else logs.push(`Triggered ${sentCount} push notification(s) for task ${taskId}.`);
        } else {
          logs.push(`Task ${taskId} was not marked sent because every endpoint failed.`);
        }
      }
    } else {
      logs.push("No pending task reminders found.");
    }

    // ==========================================
    // 2. Noon digest: exactly one summary push per user per day, 12:00+ Tehran.
    // Date-only tasks never notify individually (the dispatch view excludes
    // them); this digest is their only server push. It shares its messageId,
    // tag and ledger row with the foreground mirror, so exactly one layer
    // ever shows. Users with no open work today are skipped entirely.
    // ==========================================
    const tehranHourNow = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: 'numeric',
      hour12: false
    }).format(new Date()), 10) || 0;

    if (tehranHourNow < 12) {
      logs.push("Before noon digest window; skipping.");
    } else {
      const { data: digestRows, error: errDigest } = await supabase
        .rpc('get_noon_digest_candidates');

      if (errDigest) {
        throw new Error(`Failed to query noon digest candidates via RPC: ${errDigest.message}`);
      }

      if (digestRows && digestRows.length > 0) {
        const groupedDigests: Record<string, { subs: any[]; openToday: number; overdue: number }> = {};

        for (const row of digestRows) {
          if (!groupedDigests[row.user_id]) {
            groupedDigests[row.user_id] = {
              subs: [],
              openToday: row.open_today ?? 0,
              overdue: row.overdue ?? 0
            };
          }
          groupedDigests[row.user_id].subs.push({
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth
            }
          });
        }

        for (const userId of Object.keys(groupedDigests)) {
          const item = groupedDigests[userId];
          const digestTitle = "🕛 یادآوری نیم‌روز";
          const overduePart = item.overdue > 0 ? ` (${item.overdue}‌تاش عقب‌افتاده‌ست)` : '';
          const digestBody = `نیم‌روز شد! ${item.openToday} کار امروزت مونده${overduePart}؛ یه سر به لیستت بزن و انجام‌شده‌ها رو تیک بزن! ✅`;
          // Shared identity with the foreground mirror (same id/tag/ledger).
          const digestMessageId = `noon-digest-${userId}-${tehranDateStr}`;

          logs.push(`Noon digest user ${userId} (${item.openToday} today, ${item.overdue} overdue) -> ${item.subs.length} registrations.`);

          let digestSentCount = 0;
          for (const sub of item.subs) {
            try {
              await webpush.sendNotification(sub, JSON.stringify({
                title: digestTitle,
                body: digestBody,
                tag: `noon-digest-${userId}`,
                messageId: digestMessageId,
                data: { type: 'noon_digest' }
              }));
              digestSentCount++;
              sentCountTotal++;
            } catch (pushErr: any) {
              console.error(`Noon digest push failed for sub: ${sub.endpoint}`, pushErr);
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                await supabase
                  .from('push_subscriptions')
                  .delete()
                  .eq('endpoint', sub.endpoint);
                logs.push(`Removed expired noon digest subscription: ${sub.endpoint}`);
                cleanedCountTotal++;
              } else {
                failedCountTotal++;
              }
            }
          }

          if (digestSentCount > 0) {
            const { error: insErr } = await supabase
              .from('reminders')
              .insert({
                user_id: userId,
                title: digestTitle,
                body: digestBody,
                remind_at: new Date().toISOString(),
                type: 'custom',
                related_entity_type: 'noon_digest',
                related_entity_id: null,
                is_sent: true,
                is_read: false
              });

            if (insErr) console.error(`Failed to record noon digest ${userId}:`, insErr);
            else logs.push(`Triggered ${digestSentCount} noon digest(s) for user ${userId}.`);
          } else {
            logs.push(`Noon digest for user ${userId} was not marked sent because every endpoint failed.`);
          }
        }
      } else {
        logs.push("No noon digest candidates found.");
      }
    }

    // Write execution log to push_dispatch_log table
    const { error: logError } = await supabase
      .from('push_dispatch_log')
      .insert({
        sent_count: sentCountTotal,
        failed_count: failedCountTotal,
        cleaned_count: cleanedCountTotal,
        notes: logs.join('\n')
      });

    if (logError) {
      console.error("Failed to write to push_dispatch_log table:", logError);
    }

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    console.error("Critical server error under push-dispatch:", err);
    
    // Attempt to log critical failure to the table before returning
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );
      await supabase
        .from('push_dispatch_log')
        .insert({
          sent_count: 0,
          failed_count: 1,
          cleaned_count: 0,
          notes: `CRITICAL ERROR: ${err.message || err}`
        });
    } catch (logErr) {
      console.error("Could not write critical failure to push_dispatch_log:", logErr);
    }

    return safeErrorResponse(err, corsHeaders);
  }
});
