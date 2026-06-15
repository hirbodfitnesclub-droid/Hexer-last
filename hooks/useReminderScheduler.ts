// hooks/useReminderScheduler.ts
import { useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { showViaSW, checkIfShownAndRegister } from '../services/reminderService';
import { getRandomDailyNudge } from '../utils/notificationCopy';
import { getTehranDateString, isSameTehranDay } from '../utils/dateUtils';

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
        const nowMs = Date.now();
        const todayStr = getTehranDateString();

        // ------------------------------------------
        // A. Filter and evaluate tasks due today
        // ------------------------------------------
        const todayTasks = tasks.filter(
          (task) =>
            !task.completed &&
            task.due_date &&
            isSameTehranDay(task.due_date, new Date())
        );

        for (const task of todayTasks) {
          if (!task.due_date) continue;
          const dueMs = new Date(task.due_date).getTime();
          const taskMessageId = `task-${task.id}-${dueMs}`;

          // CASE 1: Task is already overdue (Catch-up / Recovery)
          if (dueMs <= nowMs) {
            if (!notifiedTaskIdsRef.current.has(taskMessageId)) {
              notifiedTaskIdsRef.current.add(taskMessageId);
              const isShown = await checkIfShownAndRegister(taskMessageId);
              if (!isShown) {
                console.log(`[Scheduler] Firing overdue catch-up task: "${task.title}"`);
                await showViaSW(task.title, task.description || 'زمان انجام این کار فرا رسیده است.', {
                  tag: `task-${task.id}`,
                  messageId: taskMessageId,
                  data: { taskId: task.id }
                });
              }
            }
          }
          // CASE 2: Task is upcoming within the next 60 seconds (Dynamic exact margin Reservation)
          else if (dueMs > nowMs && dueMs <= nowMs + 60000) {
            if (!notifiedTaskIdsRef.current.has(taskMessageId)) {
              notifiedTaskIdsRef.current.add(taskMessageId);
              const delay = dueMs - nowMs;
              console.log(`[Scheduler] Reserving task "${task.title}" to fire exactly in ${Math.round(delay / 1000)}s`);

              const tId = window.setTimeout(async () => {
                const isShown = await checkIfShownAndRegister(taskMessageId);
                if (!isShown) {
                  await showViaSW(task.title, task.description || 'زمان انجام این کار فرا رسیده است.', {
                    tag: `task-${task.id}`,
                    messageId: taskMessageId,
                    data: { taskId: task.id }
                  });
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
                console.log('[Scheduler] Dispatching daily nudge.');
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
