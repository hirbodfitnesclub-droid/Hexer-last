import { describe, expect, it } from 'vitest';
import { filterActionsByPolicy } from '../../supabase/functions/ai-assistant/lib/action-policy';

describe('AI recurrence completion identity', () => {
  it('preserves the original action index after policy filtering', () => {
    const result = filterActionsByPolicy('mutate', [
      { action: 'NOPE', params: {} },
      { action: 'COMPLETE_TASK', params: { taskId: 'x' } },
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].policyIndex).toBe(1);
  });
});
