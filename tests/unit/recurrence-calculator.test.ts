import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/recurrence-calculator.json';
import { calculateNextOccurrence, calculateRecurrenceCompletion } from '../../supabase/functions/_shared/recurrence-calculator';
import { buildNextRecurrence, canContinueRecurrence, computeNextDueDate, normalizeRecurrence } from '../../utils/recurrenceUtils';

describe('server recurrence calculator parity', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const now = new Date(scenario.input.now);
      const recurrence = normalizeRecurrence(scenario.input.recurrence);
      const clientNextDue = computeNextDueDate(scenario.input.fromDue, recurrence, now);
      const clientResult = recurrence && clientNextDue && canContinueRecurrence(recurrence, clientNextDue)
        ? { nextDue: clientNextDue, nextRecurrence: buildNextRecurrence(recurrence) }
        : null;
      const serverResult = calculateNextOccurrence({
        fromDue: scenario.input.fromDue,
        recurrence: scenario.input.recurrence,
        now,
      });
      expect(serverResult?.nextDue ?? null).toBe(clientResult?.nextDue ?? null);
      expect(serverResult?.nextRecurrence ?? null).toEqual(clientResult?.nextRecurrence ?? null);
      if (serverResult) {
        expect(serverResult.calculatorVersion).toBe('tehran-jalali-v1');
        expect(serverResult.occurrenceKey).toMatch(/^\d{4}-\d{2}-\d{2}:\d{2}:\d{2}:\d{2}$/);
      }
    });
  }

  it('marks exhausted valid rules as terminal instead of invalid', () => {
    const terminal = calculateRecurrenceCompletion({
      fromDue: '2026-08-20T08:30:00Z',
      recurrence: { type: 'daily', end: { kind: 'after_n', remaining: 0 } },
    });
    expect(terminal.kind).toBe('terminal');

    const invalid = calculateRecurrenceCompletion({
      fromDue: '2026-08-20T08:30:00Z',
      recurrence: { type: 'weekly', weekdays: [] },
    });
    expect(invalid.kind).toBe('invalid');
  });
});
