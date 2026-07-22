// hooks/useReminderScheduler.ts
import { useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { showViaSW, checkIfShownAndRegister } from '../services/reminderService';
import { getRandomDailyNudge } from '../utils/notificationCopy';
import { getTehranDateString, isSameTehranDay } from '../utils/dateUtils';
import { isRecurring, normalizeRecurrence } from '../utils/recurrenceUtils';

/** Max age for overdue catch-up (prevents storm of old due tasks on open). */
const CATCH_UP_MS = 15 * 60 * 1000;

/**
 * React hook to schedule foreground (Layer A) reminders:
 * 1. Timed tasks due today: setInterval periodic polling with exact margin setup and catch-up.
 * 2. Daily nudge: Check hourly daylight threshold on Tehran time.
 */
export function useReminderScheduler() {
  const { user } = useAuth();
  const { tasks } = useData();
  
  const timeoutsRef = useRef<number[]>([]);
  const notifiedTaskIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !tasks) return;

    // Helper: Clear all pending timeout timers
    const clearScheduledReminders = () => {
      timeoutsRef.current.forEach((tId) => clearTimeout(tId));
      timeoutsRef.current = [];
    };

    const evaluate = async () => {
      try {
        // Quiet no-op when permission is missing — never auto-prompt.
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
          return;
        }

        const nowMs = Date.now();
        const todayStr = getTehranDateString();

        // ------------------------------------------
        // A. Filter and evaluate tasks due today
        // ------------------------------------------
        const todayTasks = tasks.filter(
          (task) =>
            task.status !== 'done' &&
            task.due_date &&
            isSameTehranDay(task.due_date, new Date())
        );

        for (const task of todayTasks) {
          if (!task.due_date) continue;
          const dueMs = new Date(task.due_date).getTime();
          const taskMessageId = `task-${task.id}-${dueMs}`;
          // Phase U: recurring label only — filter (due today + !done) unchanged so new series occurrences notify via new id+dueMs.
          const body =
            task.description ||
            (isRecurring(normalizeRecurrence(task.recurrence))
              ? 'زمان انجام این کار تکراری فرا رسیده است.'
              : 'زمان انجام این کار فرا رسیده است.');

          // CASE 1: Recent overdue only (catch-up window — no full-day storm)
          if (dueMs <= nowMs && nowMs - dueMs <= CATCH_UP_MS) {
            if (!notifiedTaskIdsRef.current.has(taskMessageId)) {
              notifiedTaskIdsRef.current.add(taskMessageId); // claim to avoid parallel double-fire
              try {
                const isShown = await checkIfShownAndRegister(taskMessageId);
                if (!isShown) {
                  await showViaSW(task.title, body, {
                    tag: `task-${task.id}`,
                    messageId: taskMessageId,
                    data: { taskId: task.id }
                  });
                }
              } catch {
                // Roll back claim only when notification was not successfully handled.
                notifiedTaskIdsRef.current.delete(taskMessageId);
              }
            }
          }
          // CASE 2: Task is upcoming within the next 60 seconds (Dynamic exact margin Reservation)
          else if (dueMs > nowMs && dueMs <= nowMs + 60000) {
            if (!notifiedTaskIdsRef.current.has(taskMessageId)) {
              notifiedTaskIdsRef.current.add(taskMessageId); // claim reservation
              const delay = dueMs - nowMs;

              const tId = window.setTimeout(async () => {
                try {
                  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
                    notifiedTaskIdsRef.current.delete(taskMessageId);
                    return;
                  }
                  const isShown = await checkIfShownAndRegister(taskMessageId);
                  if (!isShown) {
                    await showViaSW(task.title, body, {
                      tag: `task-${task.id}`,
                      messageId: taskMessageId,
                      data: { taskId: task.id }
                    });
                  }
                } catch {
                  notifiedTaskIdsRef.current.delete(taskMessageId);
                }
              }, delay);

              timeoutsRef.current.push(tId);
            }
          }
        }

        // ------------------------------------------
        // B. Evaluate and Trigger Tehran-aware Daily Nudge
        // ------------------------------------------
        const lastNudgeDate = localStorage.getItem('hexer_last_daily_nudge_date');
        if (lastNudgeDate !== todayStr) {
          // Get current Tehran hour
          const nowTehranString = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Tehran',
            hour: 'numeric',
            hour12: false
          }).format(new Date());
          
          const tehranHour = parseInt(nowTehranString, 10) || 0;

          if (tehranHour >= 9) {
            const nudgeMessageId = `nudge-${user.id}-${todayStr}`;
            if (!notifiedTaskIdsRef.current.has(nudgeMessageId)) {
              notifiedTaskIdsRef.current.add(nudgeMessageId);
              const isShown = await checkIfShownAndRegister(nudgeMessageId);
              if (!isShown) {
                const nudgeCopy = getRandomDailyNudge();
                await showViaSW("👋 یادآوری روزانه", nudgeCopy, {
                  tag: `daily-nudge-${user.id}`,
                  messageId: nudgeMessageId,
                  data: { type: 'daily_nudge' }
                });
              }
              localStorage.setItem('hexer_last_daily_nudge_date', todayStr);
            }
          }
        }
      } catch (err) {
        console.warn('[Scheduler] Evaluation error cycle bypassed:', err);
      }
    };

    // Run evaluation immediately upon startup
    evaluate();

    const intervalId = window.setInterval(evaluate, 60000);

    // Re-sync listeners on screen visibility / internet offline recovery
    const handleSyncReset = () => {
      console.log('[Scheduler] System sync trigger (online/visible) - evaluating reminders.');
      evaluate();
    };

    window.addEventListener('visibilitychange', handleSyncReset);
    window.addEventListener('online', handleSyncReset);

    return () => {
      clearScheduledReminders();
      window.clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleSyncReset);
      window.removeEventListener('online', handleSyncReset);
    };
  }, [user, tasks]);
}
