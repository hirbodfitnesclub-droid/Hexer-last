import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/recurrence-calculator.json';
import { calculateNextOccurrence } from '../../supabase/functions/_shared/recurrence-calculator';
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
});
