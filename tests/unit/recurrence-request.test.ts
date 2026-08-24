import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/recurrence-request.json';
import { parseRecurrenceRequest } from '../../supabase/functions/recurrence-api/request-contract';

describe('recurrence API request contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if (scenario.expected) {
        expect(parseRecurrenceRequest(scenario.input)).toMatchObject({ operation: 'complete' });
      } else {
        expect(() => parseRecurrenceRequest(scenario.input)).toThrow();
      }
    });
  }
});
