import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/agent-reversible-tools.json';
import { validateAiResponse } from '../../supabase/functions/ai-assistant/lib/ai-contract';
import { filterActionsByPolicy } from '../../supabase/functions/ai-assistant/lib/action-policy';
import { classifyIntent } from '../../supabase/functions/ai-assistant/lib/intent';

describe('reversible task and reminder tools', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const response = {
        transcription: '', reply: '', proposals: [],
        actions: [{ action: scenario.input, params: scenario.params }],
      };
      expect(validateAiResponse(response).ok).toBe(scenario.expected);
    });
  }

  it('allows all reversible tools only for mutation intent', () => {
    const actions = ['REOPEN_TASK', 'UPDATE_TASK_CHECKLIST', 'SNOOZE_REMINDER', 'MARK_REMINDER_READ']
      .map((action) => ({ action, params: {} }));
    expect(filterActionsByPolicy('mutate', actions).accepted).toHaveLength(4);
    expect(filterActionsByPolicy('chat', actions).accepted).toHaveLength(0);
  });

  it.each([
    'یادآور جلسه را عقب بنداز',
    'یادآور دارو را خوانده کن',
    'تسک گزارش را دوباره باز کن',
    'چک‌لیست کار خرید را آپدیت کن',
  ])('classifies domain mutation phrase: %s', (message) => {
    expect(classifyIntent({ message, mode: 'auto' })).toBe('mutate');
  });
});
