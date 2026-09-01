import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/action-policy.json';
import { allowedActionsFor, filterActionsByPolicy, isMutationAction } from '../../supabase/functions/ai-assistant/lib/action-policy';

describe('action policy scenarios', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const result = filterActionsByPolicy(scenario.input.intent as never, scenario.input.actions);
      expect({
        accepted: result.accepted.map((item) => item.action),
        rejected: result.rejected.map((item) => item.reason),
      }).toEqual(scenario.expected);
    });
  }

  it('keeps allowlists immutable by convention and fail-closed', () => {
    expect(allowedActionsFor('chat')).toEqual([]);
    expect(allowedActionsFor('mutate')).toEqual([
      'UPDATE_TASK', 'COMPLETE_TASK', 'REOPEN_TASK', 'UPDATE_TASK_CHECKLIST',
      'UPDATE_NOTE', 'UPDATE_PROJECT', 'UPDATE_HABIT', 'SET_HABIT_COMPLETION',
      'UPDATE_REMINDER', 'SNOOZE_REMINDER', 'MARK_REMINDER_READ', 'LINK_TASK_NOTE', 'UNLINK_TASK_NOTE',
    ]);
    expect(isMutationAction('SUGGEST_LINK')).toBe(false);
    expect(isMutationAction('CREATE_TASK')).toBe(true);
  });
});
