import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/undo-request.json';
import { parseAssistantRequest } from '../../supabase/functions/ai-assistant/lib/request-contract';

describe('persistent undo request contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const invoke = () => parseAssistantRequest({ undoReceiptId: scenario.input, message: '', history: [], mode: 'auto' });
      if (scenario.expected) expect(invoke().undoReceiptId).toBe(scenario.input);
      else expect(invoke).toThrow();
    });
  }
});
