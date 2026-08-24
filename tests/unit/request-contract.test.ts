import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/assistant-request.json';
import {
  AI_HISTORY_LIMIT,
  AI_HISTORY_TEXT_LIMIT,
  AI_MESSAGE_LIMIT,
  parseAssistantRequest,
} from '../../supabase/functions/ai-assistant/lib/request-contract';

describe('assistant request contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if ('error' in scenario) {
        expect(() => parseAssistantRequest(scenario.input)).toThrow(scenario.error);
      } else {
        expect(parseAssistantRequest(scenario.input).mode).toBe(scenario.expected);
      }
    });
  }

  it('caps history count and per-item text', () => {
    const history = Array.from({ length: AI_HISTORY_LIMIT + 3 }, (_, index) => ({
      sender: index % 2 ? 'ai' as const : 'user' as const,
      text: 'x'.repeat(AI_HISTORY_TEXT_LIMIT + 20),
    }));
    const parsed = parseAssistantRequest({ message: 'سلام', history });
    expect(parsed.history).toHaveLength(AI_HISTORY_LIMIT);
    expect(parsed.history.every((item) => item.text.length === AI_HISTORY_TEXT_LIMIT)).toBe(true);
  });

  it('rejects an oversized message', () => {
    expect(() => parseAssistantRequest({ message: 'x'.repeat(AI_MESSAGE_LIMIT + 1) }))
      .toThrow('Message is too long');
  });
});
