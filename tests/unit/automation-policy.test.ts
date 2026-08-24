import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/automation-policy.json';
import {
  AUTOMATIC_ALLOWLIST,
  conditionsMet,
  evaluateRule,
  isFactUsable,
  isQuietHour,
  type AutomationEvent,
  type AutomationRule,
} from '../../supabase/functions/_shared/automation-policy';

describe('automation policy evaluation', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const input = scenario.input as any;
      if (scenario.kind === 'evaluate') {
        const decision = evaluateRule(input.rule as AutomationRule, input.event as AutomationEvent);
        const actual = decision.outcome === 'skip' ? `skip:${decision.reason}` : decision.outcome;
        expect(actual).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'quiet') {
        expect(isQuietHour(input.quietHours ?? undefined, input.hour)).toBe(scenario.expected);
        return;
      }
      expect(isFactUsable(input)).toBe(scenario.expected);
    });
  }

  it('never lets a mutating action run without confirmation', () => {
    expect(AUTOMATIC_ALLOWLIST.has('suggest_task')).toBe(false);
    expect(AUTOMATIC_ALLOWLIST.has('suggest_reschedule')).toBe(false);
  });

  it('produces a stable idempotency key that changes with the rule version', () => {
    const rule: AutomationRule = {
      id: 'r1', userId: 'u1', triggerType: 'task_overdue', actionType: 'notify',
      mode: 'suggest', enabled: true, version: 1,
    };
    const event: AutomationEvent = { type: 'task_overdue', userId: 'u1', occurrenceKey: 'occ1', tehranHour: 10, payload: {} };
    const first = evaluateRule(rule, event);
    const replay = evaluateRule(rule, event);
    const bumped = evaluateRule({ ...rule, version: 2 }, event);
    expect(first).toEqual(replay);
    expect(first.outcome === 'suggest' && bumped.outcome === 'suggest'
      && first.idempotencyKey !== bumped.idempotencyKey).toBe(true);
  });

  it('treats an empty condition list as satisfied', () => {
    expect(conditionsMet([], {})).toBe(true);
  });

  it('evaluates each operator against real payload shapes', () => {
    const payload = { count: 5, title: 'گزارش هفتگی', status: 'open', missing: null };
    expect(conditionsMet([{ field: 'count', operator: 'gt', value: 3 }], payload)).toBe(true);
    expect(conditionsMet([{ field: 'count', operator: 'lt', value: 3 }], payload)).toBe(false);
    expect(conditionsMet([{ field: 'title', operator: 'contains', value: 'گزارش' }], payload)).toBe(true);
    expect(conditionsMet([{ field: 'status', operator: 'not_equals', value: 'done' }], payload)).toBe(true);
    expect(conditionsMet([{ field: 'missing', operator: 'exists' }], payload)).toBe(false);
    expect(conditionsMet([{ field: 'count', operator: 'exists' }], payload)).toBe(true);
  });

  it('rejects a numeric comparison against a non-numeric payload', () => {
    expect(conditionsMet([{ field: 'title', operator: 'gt', value: 3 }], { title: 'x' })).toBe(false);
  });

  it('requires every condition, not just one', () => {
    const conditions = [
      { field: 'count', operator: 'gt' as const, value: 3 },
      { field: 'status', operator: 'equals' as const, value: 'done' },
    ];
    expect(conditionsMet(conditions, { count: 5, status: 'open' })).toBe(false);
  });
});
