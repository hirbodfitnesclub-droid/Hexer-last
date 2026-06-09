// hooks/useReminderScheduler.ts
import { useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { showViaSW } from '../services/reminderService';
import { getRandomDailyNudge } from '../utils/notificationCopy';
import { getTehranDateString, isSameTehranDay } from '../utils/dateUtils';

/**
 * React hook to schedule foreground (Layer A) reminders:
 * 1. Timed tasks due today: setTimeout scheduling with deduplication support via useRef.
 * 2. Daily nudge: Trigger if Tehran hour >= 9 and not yet sent today.
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

    clearScheduledReminders();

    const todayStr = getTehranDateString();
    const nowMs = Date.now();

    // ------------------------------------------
    // A. Schedule Timed Task Reminders for Today
    // ------------------------------------------
    const todayTasks = tasks.filter(
      (task) =>
        !task.completed &&
        task.due_date &&
        isSameTehranDay(task.due_date, new Date())
    );

    todayTasks.forEach((task) => {
      if (!task.due_date) return;
      const dueMs = new Date(task.due_date).getTime();
      
      // If task has a specific hour/time parts (due date is in the future today)
      if (dueMs > nowMs && !notifiedTaskIdsRef.current.has(task.id)) {
        const delay = dueMs - nowMs;
        
        console.log(`[Scheduler] Scheduling reminder for task: "${task.title}" in ${Math.round(delay / 1000)}s`);

        const tId = window.setTimeout(async () => {
          if (notifiedTaskIdsRef.current.has(task.id)) return;
          notifiedTaskIdsRef.current.add(task.id);
          
          await showViaSW(task.title, task.description || 'زمان انجام این کار فرا رسیده است.', {
            tag: `task-${task.id}`,
            data: { taskId: task.id }
          });
        }, delay);

        timeoutsRef.current.push(tId);
      }
    });

    // ------------------------------------------
    // B. Calculate and Trigger Tehran-aware Daily Nudge
    // ------------------------------------------
    const triggerDailyNudgeText = async () => {
      try {
        const lastNudgeDate = localStorage.getItem('hexer_last_daily_nudge_date');
        if (lastNudgeDate === todayStr) {
          return; // Already nudged today
        }

        // Get current Tehran hour
        const nowTehranString = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Tehran',
          hour: 'numeric',
          hour12: false
        }).format(new Date());
        
        const tehranHour = parseInt(nowTehranString, 10) || 0;

        if (tehranHour >= 9) {
          // If daylight hour is met, showcase instantly
          const nudgeCopy = getRandomDailyNudge();
          await showViaSW("👋 یادآوری روزانه", nudgeCopy, {
            tag: `daily-nudge-${user.id}`,
            data: { type: 'daily_nudge' }
          });
          localStorage.setItem('hexer_last_daily_nudge_date', todayStr);
          console.log('[Scheduler] Direct Daily nudge triggered successfully.');
        } else {
          // Calculate delay until 9:00 AM Tehran today
          const nowInTehran = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
          const targetInTehran = new Date(nowInTehran);
          targetInTehran.setHours(9, 0, 0, 0);
          
          const targetDelay = targetInTehran.getTime() - nowInTehran.getTime();
          if (targetDelay > 0) {
            console.log(`[Scheduler] Nudge scheduled for later today (Tehran 9:00 AM) in ${Math.round(targetDelay / 1000)}s`);
            
            const nudgeTId = window.setTimeout(async () => {
              const currentTodayStr = getTehranDateString();
              const doubleCheckLastNudge = localStorage.getItem('hexer_last_daily_nudge_date');
              if (doubleCheckLastNudge === currentTodayStr) return;

              const nudgeCopy = getRandomDailyNudge();
              await showViaSW("👋 یادآوری روزانه", nudgeCopy, {
                tag: `daily-nudge-${user.id}`,
                data: { type: 'daily_nudge' }
              });
              localStorage.setItem('hexer_last_daily_nudge_date', currentTodayStr);
              console.log('[Scheduler] Timeout Daily nudge triggered.');
            }, targetDelay);

            timeoutsRef.current.push(nudgeTId);
          }
        }
      } catch (err) {
        console.warn('Error scheduling/triggering daily nudge:', err);
      }
    };

    triggerDailyNudgeText();

    // ------------------------------------------
    // C. Re-sync listeners on screen visibility / internet offline recovery
    // ------------------------------------------
    const handleSyncReset = () => {
      console.log('[Scheduler] System sync trigger (online/visible) - re-evaluating reminders.');
      // Re-triggering useEffect closure
      clearScheduledReminders();
    };

    window.addEventListener('visibilitychange', handleSyncReset);
    window.addEventListener('online', handleSyncReset);

    return () => {
      clearScheduledReminders();
      window.removeEventListener('visibilitychange', handleSyncReset);
      window.removeEventListener('online', handleSyncReset);
    };
  }, [user, tasks]);
}
