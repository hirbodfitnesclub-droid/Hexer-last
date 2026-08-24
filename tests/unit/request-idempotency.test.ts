import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/request-idempotency.json';
import { parseAssistantRequest } from '../../supabase/functions/ai-assistant/lib/request-contract';

describe('assistant request idempotency contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const invoke = () => parseAssistantRequest({
        message: 'سلام',
        requestId: scenario.input.requestId,
        idempotencyKey: scenario.input.idempotencyKey,
      });
      if (scenario.expected) {
        const parsed = invoke();
        if (scenario.input.requestId) expect(parsed.requestId).toBe(scenario.input.requestId);
        if (scenario.input.idempotencyKey) expect(parsed.idempotencyKey).toBe(scenario.input.idempotencyKey);
      } else {
        expect(invoke).toThrow();
      }
    });
  }
});
