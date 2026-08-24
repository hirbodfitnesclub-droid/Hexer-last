import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/notification-outbox.json';
import {
  classifyPushFailure,
  dailyNudgeOccurrenceKey,
  emptyTally,
  reminderOccurrenceKey,
  taskOccurrenceKey,
  tallyDelivery,
  type DeliveryOutcome,
} from '../../supabase/functions/_shared/notification-outbox';

describe('notification outbox delivery contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if (scenario.kind === 'classify') {
        expect(classifyPushFailure(scenario.input)).toEqual(scenario.expected);
        return;
      }
      if (scenario.kind === 'tally') {
        const tally = (scenario.input as any[]).reduce(
          (acc, result) => tallyDelivery(acc, result as { outcome: DeliveryOutcome; permanent?: boolean; errorCode?: string | null }),
          emptyTally()
        );
        expect(tally).toMatchObject(scenario.expected as Record<string, unknown>);
        return;
      }
      if (scenario.kind === 'taskKey') {
        const input = scenario.input as { taskId: string; dueDate: string };
        expect(taskOccurrenceKey(input.taskId, input.dueDate)).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'reminderKey') {
        const input = scenario.input as { reminderId: string; remindAt: string };
        expect(reminderOccurrenceKey(input.reminderId, input.remindAt)).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'nudgeKey') {
        expect(dailyNudgeOccurrenceKey(scenario.input as string)).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'taskKeyInvalid') {
        const input = scenario.input as { taskId: string; dueDate: string };
        expect(() => taskOccurrenceKey(input.taskId, input.dueDate)).toThrow();
        return;
      }
      expect(() => dailyNudgeOccurrenceKey(scenario.input as string)).toThrow();
    });
  }

  it('gives the same key for the same moment written differently', () => {
    expect(taskOccurrenceKey('t', '2026-08-21T08:30:00Z'))
      .toBe(taskOccurrenceKey('t', '2026-08-21T12:00:00+03:30'));
  });

  it('keeps a partially delivered message out of the retry path', () => {
    const tally = [{ outcome: 'succeeded' as const }, { outcome: 'expired' as const, permanent: true, errorCode: 'push_410' }]
      .reduce((acc, result) => tallyDelivery(acc, result), emptyTally());
    expect(tally.succeeded).toBe(1);
    expect(tally.failed).toBe(0);
  });
});
