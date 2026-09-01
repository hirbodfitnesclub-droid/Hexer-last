import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/recurrence-cutover.json';
import { hasMeaningfulEdit } from '../../utils/taskPatch';
import type { Task } from '../../types';

/**
 * Mirrors the outcome mapping in services/recurrenceService.ts. Kept here so the
 * decision table is asserted without standing up the Supabase functions client.
 */
function classifyPayload(payload: any): 'not_enabled' | 'conflict' | 'handled' | 'unavailable' {
  if (payload?.reason === 'feature_disabled') return 'not_enabled';
  if (payload?.reason === 'version_conflict' || payload?.errorCode === 'version_conflict') return 'conflict';
  if (payload?.status === 'succeeded' && payload?.current) return 'handled';
  return 'unavailable';
}

describe('recurrence completion cutover', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if (scenario.kind === 'edit') {
        expect(hasMeaningfulEdit(scenario.input as Partial<Task>)).toBe(scenario.expected);
      } else {
        expect(classifyPayload(scenario.input)).toBe(scenario.expected);
      }
    });
  }

  it('treats an empty patch as a plain completion', () => {
    expect(hasMeaningfulEdit({})).toBe(false);
  });

  it('never routes a partial recurrence edit to the completion RPC', () => {
    expect(hasMeaningfulEdit({ id: 't', status: 'done', recurrence_series_id: 's' })).toBe(true);
  });
});
