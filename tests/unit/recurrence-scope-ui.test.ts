import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/recurrence-scope-ui.json';
import {
  countFutureOpenOccurrences,
  needsScopeChoice,
  resolveKeepCurrent,
  scopeUpdateKeys,
  sendsRecurrenceRule,
  type RecurrenceScopeChoice,
} from '../../features/tasks/recurrenceScopeDecisions';

describe('recurrence scope UI decisions', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const input = scenario.input as any;
      if (scenario.kind === 'needsScope') {
        expect(needsScopeChoice({ isNew: input.isNew, recurrence: input.recurrence, seriesId: input.seriesId }))
          .toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'updateKeys') {
        expect(scopeUpdateKeys({ hasDate: input.hasDate })).toEqual(scenario.expected);
        return;
      }
      if (scenario.kind === 'futureCount') {
        expect(countFutureOpenOccurrences({
          tasks: input.tasks,
          seriesId: input.seriesId,
          currentId: 'self',
          dueDate: input.dueDate,
        })).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'sendsRule') {
        expect(sendsRecurrenceRule(scenario.input as RecurrenceScopeChoice)).toBe(scenario.expected);
        return;
      }
      expect(resolveKeepCurrent(input.keepCurrent)).toBe(scenario.expected);
    });
  }

  it('never sends a field the server would reject', () => {
    const allowed = new Set(['title', 'description', 'priority', 'project_id', 'tags', 'checklist', 'due_date']);
    for (const key of scopeUpdateKeys({ hasDate: true })) {
      expect(allowed.has(key)).toBe(true);
    }
    expect(scopeUpdateKeys({ hasDate: true })).not.toContain('status');
    expect(scopeUpdateKeys({ hasDate: true })).not.toContain('recurrence');
  });

  it('counts only later open siblings, ignoring history and other series', () => {
    const tasks = [
      { id: 'past', recurrence_series_id: 's1', status: 'todo', due_date: '2026-08-19T08:00:00Z' },
      { id: 'done', recurrence_series_id: 's1', status: 'done', due_date: '2026-08-21T08:00:00Z' },
      { id: 'future', recurrence_series_id: 's1', status: 'todo', due_date: '2026-08-22T08:00:00Z' },
      { id: 'other', recurrence_series_id: 's2', status: 'todo', due_date: '2026-08-23T08:00:00Z' },
    ] as any;
    expect(countFutureOpenOccurrences({ tasks, seriesId: 's1', currentId: 'self', dueDate: '2026-08-20T08:00:00Z' }))
      .toBe(1);
  });

  it('treats a rule with no valid weekday as not repeating', () => {
    expect(needsScopeChoice({ isNew: false, seriesId: 's1', recurrence: { type: 'weekly', weekdays: [] } })).toBe(false);
  });
});
