import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/ai-response-contract.json';
import { AI_RESPONSE_JSON_SCHEMA, parseAiResponse, validateAiResponse } from '../../supabase/functions/ai-assistant/lib/ai-contract';

describe('strict AI response contract scenarios', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const result = validateAiResponse(scenario.input);
      expect(result.ok).toBe(scenario.expected);
      if (!scenario.expected) expect(result.ok === false ? result.errors : []).not.toHaveLength(0);
    });
  }

  it('exports a strict schema aligned with the top-level contract', () => {
    expect(AI_RESPONSE_JSON_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['transcription', 'reply', 'actions', 'proposals'],
    });
  });

  it('throws from the strict parser for invalid model output', () => {
    expect(() => parseAiResponse({ reply: 'سلام' })).toThrow('Invalid AI response');
  });
});
