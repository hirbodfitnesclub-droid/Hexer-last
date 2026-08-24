import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/operation-queue.json';
import {
  applyFailure,
  applyTempIdMapping,
  backoffMs,
  classifyFailure,
  createOperation,
  MAX_ATTEMPTS,
  selectOrphaned,
  selectRunnable,
  type FailureClass,
  type OfflineOperation,
} from '../../services/offline/operationQueue';

function op(overrides: Partial<OfflineOperation> = {}): OfflineOperation {
  return {
    opId: 'o1', userId: 'u1', deviceId: 'd1', entity: 'tasks', entityId: 't1',
    action: 'update', payload: {}, dependsOn: [], status: 'pending',
    attemptCount: 0, nextAttemptAt: 0, createdAt: 0,
    ...overrides,
  };
}

describe('offline operation queue', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const input = scenario.input as any;
      if (scenario.kind === 'create') {
        expect(createOperation({ ...input, now: 1000 })).toMatchObject(scenario.expected as object);
        return;
      }
      if (scenario.kind === 'classify') {
        expect(classifyFailure(input)).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'apply') {
        const result = applyFailure(op({ attemptCount: input.attemptCount }), {
          failure: input.failure as FailureClass,
          now: 5000,
        });
        expect(result).toMatchObject(scenario.expected as object);
        return;
      }
      const [mapped] = applyTempIdMapping(
        [op({ payload: input.payload, entityId: input.entityId, tempId: input.tempId })],
        { tempId: input.tempId, realId: input.realId, userId: 'u1' }
      );
      expect(mapped.payload).toMatchObject(scenario.expected as object);
    });
  }

  it('holds a child until its parent leaves the queue', () => {
    const parent = op({ opId: 'p1', entityId: 'proj', action: 'insert' });
    const child = op({ opId: 'c1', dependsOn: ['p1'], status: 'blocked' });
    expect(selectRunnable({ operations: [parent, child], userId: 'u1', now: 10 }).map(o => o.opId)).toEqual(['p1']);
    expect(selectRunnable({ operations: [child], userId: 'u1', now: 10 }).map(o => o.opId)).toEqual(['c1']);
  });

  it('never returns another user’s operations', () => {
    const mine = op({ opId: 'mine' });
    const theirs = op({ opId: 'theirs', userId: 'u2' });
    expect(selectRunnable({ operations: [mine, theirs], userId: 'u1', now: 10 }).map(o => o.opId)).toEqual(['mine']);
  });

  it('withholds an operation whose retry time has not arrived', () => {
    const waiting = op({ nextAttemptAt: 9_999 });
    expect(selectRunnable({ operations: [waiting], userId: 'u1', now: 10 })).toHaveLength(0);
  });

  it('surfaces children of a permanently failed parent instead of retrying them', () => {
    const parent = op({ opId: 'p1', status: 'failed' });
    const child = op({ opId: 'c1', dependsOn: ['p1'], status: 'blocked' });
    expect(selectOrphaned([parent, child]).map(o => o.opId)).toEqual(['c1']);
    expect(selectRunnable({ operations: [parent, child], userId: 'u1', now: 10 }).map(o => o.opId)).toEqual(['c1']);
  });

  it('grows backoff and caps it', () => {
    expect(backoffMs(1)).toBeLessThan(backoffMs(4));
    expect(backoffMs(50)).toBe(300_000);
  });

  it('fails an operation once attempts are exhausted', () => {
    const result = applyFailure(op({ attemptCount: MAX_ATTEMPTS - 1 }), { failure: 'retryable', now: 1 });
    expect(result.status).toBe('failed');
  });

  it('leaves another user’s operation untouched when remapping', () => {
    const theirs = op({ userId: 'u2', payload: { project_id: 'temp-1' } });
    expect(applyTempIdMapping([theirs], { tempId: 'temp-1', realId: 'real-1', userId: 'u1' })[0].payload)
      .toEqual({ project_id: 'temp-1' });
  });

  it('clears the placeholder marker once mapped', () => {
    const [mapped] = applyTempIdMapping(
      [op({ entityId: 'temp-1', tempId: 'temp-1' })],
      { tempId: 'temp-1', realId: 'real-1', userId: 'u1' }
    );
    expect(mapped.entityId).toBe('real-1');
    expect(mapped.tempId).toBeUndefined();
  });
});
