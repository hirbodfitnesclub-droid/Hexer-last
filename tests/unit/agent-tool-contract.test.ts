import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/agent-tool-contract.json';
import { validateAiResponse } from '../../supabase/functions/ai-assistant/lib/ai-contract';
import { filterActionsByPolicy } from '../../supabase/functions/ai-assistant/lib/action-policy';

describe('agent tool parity contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const response = {
        transcription: '', reply: '', proposals: [],
        actions: [{ action: scenario.input, params: scenario.params }],
      };
      expect(validateAiResponse(response).ok).toBe(scenario.expected);
    });
  }

  it('allows explicit linking only for link intent', () => {
    expect(filterActionsByPolicy('link', [{ action: 'LINK_TASK_NOTE', params: {} }]).accepted).toHaveLength(1);
    expect(filterActionsByPolicy('chat', [{ action: 'LINK_TASK_NOTE', params: {} }]).accepted).toHaveLength(0);
  });

  it('treats reminder and habit completion as mutations', () => {
    expect(filterActionsByPolicy('create', [{ action: 'CREATE_REMINDER', params: {} }]).accepted).toHaveLength(1);
    expect(filterActionsByPolicy('mutate', [{ action: 'SET_HABIT_COMPLETION', params: {} }]).accepted).toHaveLength(1);
  });
});
