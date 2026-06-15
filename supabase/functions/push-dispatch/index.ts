import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
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

        // Insert reminder record as duplicate shield
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

        if (insErr) {
          console.error(`Failed to insert processed task reminder log for ${taskId}:`, insErr);
        } else {
          logs.push(`Triggered ${sentCount} push notification(s) for task ${taskId}.`);
        }
      }
    } else {
      logs.push("No pending task reminders found.");
    }

    // ==========================================
    // 2. Process daytime Daily Nudges
    // ==========================================
    const { data: nudgeUserRows, error: errNudge } = await supabase
      .rpc('get_daily_nudge_candidates');

    if (errNudge) {
      throw new Error(`Failed to query daily nudge candidates via RPC: ${errNudge.message}`);
    }

    if (nudgeUserRows && nudgeUserRows.length > 0) {
      const groupedNudges: Record<string, any[]> = {};
      
      for (const row of nudgeUserRows) {
        if (!groupedNudges[row.user_id]) {
          groupedNudges[row.user_id] = [];
        }
        groupedNudges[row.user_id].push({
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        });
      }

      const dailyNudgeTexts = [
        "سلااام! رفیق هکسر رو فراموش نکردی که؟ کارهایِ امروزت منتظرتن! 🚀",
        "هوی رفیق! بدو بیا هکسر رو چک کن، امروز کلی هدف داری که باید تیک بزنی! 😉",
        "امروز قراره بترکونی یا چی؟ کارهاتو ردیف کردی؟ یه سر به هکسر بزن. 🌟",
        "برنامه‌هات برای امروز چیه؟ هکسر آماده‌ست تا کمکت کنه تیکِ همه‌شون رو بزنی. ⚡",
        "سلام رفیق! نذار کارهات کوه بشن. همین الان بیا و یکی‌شون رو تموم کن. ✌️"
      ];

      for (const userId of Object.keys(groupedNudges)) {
        const subs = groupedNudges[userId];
        const randIndex = Math.floor(Math.random() * dailyNudgeTexts.length);
        const nudgeBody = dailyNudgeTexts[randIndex];
        const nudgeTitle = "👋 یادآوری روزانه";
        const nudgeMessageId = `nudge-${userId}-${tehranDateStr}`;

        logs.push(`Nudge user ${userId} -> ${subs.length} registrations.`);

        let nudgeSentCount = 0;
        for (const sub of subs) {
          try {
            await webpush.sendNotification(sub, JSON.stringify({
              title: nudgeTitle,
              body: nudgeBody,
              tag: `daily-nudge-${userId}`,
              messageId: nudgeMessageId,
              data: { type: 'daily_nudge' }
            }));
            nudgeSentCount++;
            sentCountTotal++;
          } catch (pushErr: any) {
            console.error(`Daily Nudge push failed for sub: ${sub.endpoint}`, pushErr);
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint);
              logs.push(`Removed expired daily nudge subscription: ${sub.endpoint}`);
              cleanedCountTotal++;
            } else {
              failedCountTotal++;
            }
          }
        }

        // Insert daily_nudge record in reminders table to lock further notifications today
        const { error: insErr } = await supabase
          .from('reminders')
          .insert({
            user_id: userId,
            title: nudgeTitle,
            body: nudgeBody,
            remind_at: new Date().toISOString(),
            type: 'custom',
            related_entity_type: 'daily_nudge',
            related_entity_id: null,
            is_sent: true,
            is_read: false
          });

        if (insErr) {
          console.error(`Failed to insert daily nudge log for ${userId}:`, insErr);
        } else {
          logs.push(`Triggered ${nudgeSentCount} friendly daily nudge(s) for user ${userId}.`);
        }
      }
    } else {
      logs.push("No daily nudge candidates found.");
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
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
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

    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
