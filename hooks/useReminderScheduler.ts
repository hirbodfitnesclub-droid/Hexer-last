// hooks/useReminderScheduler.ts
import { useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { showViaSW, checkIfShownAndRegister } from '../services/reminderService';
import {
  getEntrySummaryCopy,
  getNoonDigestCopy,
  getCombinedSummaryCopy,
} from '../utils/notificationCopy';
import {
  ENTRY_SUMMARY_GUARD_KEY,
  NOON_DIGEST_GUARD_KEY,
  entrySummaryId,
  noonDigestId,
  entrySummaryTag,
  noonDigestTag,
  isNoonDigestWindow,
} from '../utils/notificationPolicy';
import { getTehranDateString, isSameTehranDay, compareTehranDates } from '../utils/dateUtils';
import { isRecurring, normalizeRecurrence, hasExplicitDueTime } from '../utils/recurrenceUtils';

/** Max age for overdue catch-up (prevents storm of old due tasks on open). */
const CATCH_UP_MS = 15 * 60 * 1000;

/**
 * Returns true when a noon-digest ledger row already exists for the user today
 * (Tehran). Fail-closed: on query error we assume it was sent, so a flaky
 * network can never turn the digest into a duplicate — the guard simply stays
 * unset and a later tick retries.
 */
async function hasNoonDigestLedgerToday(userId: string, todayStr: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('reminders')
      .select('id,created_at')
      .eq('user_id', userId)
      .eq('related_entity_type', 'noon_digest')
      .gte('created_at', since)
      .limit(5);
    if (error) return true;
    return (data ?? []).some((r: any) => {
      try {
        return getTehranDateString(new Date(r.created_at)) === todayStr;
      } catch {
        return false;
      }
    });
  } catch {
    return true;
  }
}

/**
 * React hook to schedule foreground (Layer A) reminders:
 * 1. Timed tasks due today (explicit hour only): exact setTimeout + catch-up.
 *    Date-only tasks (Tehran 12:00 convention) NEVER notify individually —
 *    they are covered by the entry summary + the noon digest.
 * 2. Entry summary: once per device per day, on first app open.
 * 3. Noon digest mirror: once per day after 12:00 Tehran when the server
 *    digest has not been delivered yet (same id/tag/ledger, so exactly one
 *    of the two layers ever shows).
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
        // A. Timed tasks due today (explicit hour ONLY).
        // Date-only tasks (Tehran 12:00) are digest-covered, never individual.
        // ------------------------------------------
        const todayTasks = tasks.filter(
          (task) =>
            task.status !== 'done' &&
            task.due_date &&
            isSameTehranDay(task.due_date, new Date()) &&
            hasExplicitDueTime(task.due_date)
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
        // B. Entry summary (first open of the day) + noon digest mirror.
        // At most ONE notification leaves this block per day per device:
        // when both are due in the same pass they merge into a single
        // combined summary. Nothing fires when there is no open work.
        // ------------------------------------------
        const openTasks = tasks.filter(
          (task) => task.status !== 'done' && task.due_date
        );
        const openToday = openTasks.filter((task) =>
          isSameTehranDay(task.due_date as string, new Date())
        );
        const overdueCount = openTasks.filter(
          (task) => compareTehranDates(task.due_date as string, new Date()) < 0
        ).length;
        const hasOpenWork = openToday.length + overdueCount > 0;

        const wantEntry =
          hasOpenWork &&
          localStorage.getItem(ENTRY_SUMMARY_GUARD_KEY) !== todayStr;

        let wantDigest = false;
        if (
          hasOpenWork &&
          localStorage.getItem(NOON_DIGEST_GUARD_KEY) !== todayStr &&
          isNoonDigestWindow(new Date())
        ) {
          const alreadySent = await hasNoonDigestLedgerToday(user.id, todayStr);
          if (alreadySent) {
            // Server (or another tick) already delivered it — remember quietly.
            localStorage.setItem(NOON_DIGEST_GUARD_KEY, todayStr);
          } else {
            wantDigest = true;
          }
        }

        if (wantEntry && wantDigest) {
          const copy = getCombinedSummaryCopy(openToday.length, overdueCount);
          const entryId = entrySummaryId(user.id, todayStr);
          const digestId = noonDigestId(user.id, todayStr);
          const entryShown = await checkIfShownAndRegister(entryId);
          const digestShown = await checkIfShownAndRegister(digestId);
          if (!entryShown || !digestShown) {
            await showViaSW(copy.title, copy.body, {
              tag: entrySummaryTag(user.id),
              messageId: entryId,
              data: { type: 'entry_summary' },
            });
          }
          localStorage.setItem(ENTRY_SUMMARY_GUARD_KEY, todayStr);
          localStorage.setItem(NOON_DIGEST_GUARD_KEY, todayStr);
        } else if (wantEntry) {
          const copy = getEntrySummaryCopy(openToday.length, overdueCount);
          const entryId = entrySummaryId(user.id, todayStr);
          const isShown = await checkIfShownAndRegister(entryId);
          if (!isShown) {
            await showViaSW(copy.title, copy.body, {
              tag: entrySummaryTag(user.id),
              messageId: entryId,
              data: { type: 'entry_summary' },
            });
          }
          localStorage.setItem(ENTRY_SUMMARY_GUARD_KEY, todayStr);
        } else if (wantDigest) {
          const copy = getNoonDigestCopy(openToday.length, overdueCount);
          const digestId = noonDigestId(user.id, todayStr);
          const isShown = await checkIfShownAndRegister(digestId);
          if (!isShown) {
            await showViaSW(copy.title, copy.body, {
              tag: noonDigestTag(user.id),
              messageId: digestId,
              data: { type: 'noon_digest' },
            });
          }
          localStorage.setItem(NOON_DIGEST_GUARD_KEY, todayStr);
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
