import type { Task } from '../types';

/** Fields a plain completion is allowed to carry; anything else is a real edit. */
export const COMPLETION_ONLY_KEYS = new Set(['id', 'status', 'completed_at', 'version']);

/**
 * True when a patch changes anything beyond marking a task done. Plain completions
 * are routed to the server recurrence RPC; real edits keep the legacy path so the
 * edited fields are never dropped.
 */
export function hasMeaningfulEdit(patch: Task | Partial<Task>): boolean {
  return Object.keys(patch).some(key => !COMPLETION_ONLY_KEYS.has(key));
}
