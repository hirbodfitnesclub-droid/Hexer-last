import type { Task, TaskRecurrence } from '../../types';
import { normalizeRecurrence } from '../../utils/recurrenceUtils';

/**
 * Decisions the recurrence scope UI makes, kept out of the component so they can be
 * asserted directly. Nothing here touches React or the network.
 */

export type RecurrenceScopeChoice = 'skip' | 'edit_current' | 'edit_future' | 'stop';

/** Fields the recurrence RPC accepts. Anything else is rejected server-side. */
export const SCOPE_UPDATE_FIELDS = [
  'title', 'description', 'priority', 'project_id', 'tags', 'checklist',
] as const;

/**
 * Saving a repeating task is ambiguous, so the editor must ask which occurrences the
 * change applies to. A brand-new task or one without a real series has no ambiguity.
 */
export function needsScopeChoice(input: {
  isNew: boolean;
  recurrence: unknown;
  seriesId?: string | null;
}): boolean {
  if (input.isNew) return false;
  if (!input.seriesId) return false;
  return normalizeRecurrence(input.recurrence as TaskRecurrence | null) !== null;
}

/** Only `edit_future` may change the rule itself; the others must never send one. */
export function sendsRecurrenceRule(choice: RecurrenceScopeChoice): boolean {
  return choice === 'edit_future';
}

/** Stopping keeps the current occupied slot open unless the user says otherwise. */
export function resolveKeepCurrent(keepCurrent: boolean | null | undefined): boolean {
  return keepCurrent !== false;
}

/**
 * Open occurrences strictly after this one. Shown before a destructive choice so the
 * user knows the blast radius, and it deliberately excludes completed history.
 */
export function countFutureOpenOccurrences(input: {
  tasks: Array<Pick<Task, 'id' | 'recurrence_series_id' | 'status' | 'due_date'>>;
  seriesId?: string | null;
  currentId?: string;
  dueDate?: string | null;
}): number {
  if (!input.seriesId || !input.dueDate) return 0;
  return input.tasks.filter(task =>
    task.recurrence_series_id === input.seriesId &&
    task.id !== input.currentId &&
    task.status !== 'done' &&
    !!task.due_date &&
    task.due_date > input.dueDate!
  ).length;
}

/** Field list for the scope payload; `due_date` only when the task actually has one. */
export function scopeUpdateKeys(input: { hasDate: boolean }): string[] {
  return input.hasDate ? [...SCOPE_UPDATE_FIELDS, 'due_date'] : [...SCOPE_UPDATE_FIELDS];
}
