import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/recurrence-scope.json';
import { parseRecurrenceRequest } from '../../supabase/functions/recurrence-api/request-contract';

describe('recurrence scope operation contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if (scenario.expected) {
        expect(parseRecurrenceRequest(scenario.input).operation).toBe((scenario.input as any).operation);
      } else {
        expect(() => parseRecurrenceRequest(scenario.input)).toThrow();
      }
    });
  }

  it('defaults stop to keeping the current occurrence', () => {
    const parsed = parseRecurrenceRequest({
      operation: 'stop',
      taskId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      opId: '22222222-2222-4222-8222-222222222222',
      requestId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'recurrence:stop:1',
    });
    expect(parsed.keepCurrent).toBe(true);
  });

  it('never forwards a recurrence rule for a single-occurrence edit', () => {
    expect(() => parseRecurrenceRequest({
      operation: 'edit_current',
      taskId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      opId: '22222222-2222-4222-8222-222222222222',
      requestId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'recurrence:edit:1',
      updates: { title: 'x' },
      recurrence: null,
    })).toThrow('Recurrence cannot change for a single occurrence');
  });
});
