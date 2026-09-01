/**
 * Shared notification-outbox helpers. The delivery classification and occurrence-key
 * derivation live here so the dispatcher, the enqueue path, and the tests all agree
 * on what counts as a permanent failure and what a message's identity is.
 */

export type DeliveryOutcome = 'succeeded' | 'failed' | 'expired';

export interface DeliveryTally {
  succeeded: number;
  /** Retryable failures: worth another attempt with backoff. */
  failed: number;
  /** Permanent failures: the endpoint is gone, so retrying can never help. */
  permanent: number;
  lastErrorCode: string | null;
}

/** Web Push status codes that mean the subscription no longer exists. */
const GONE_STATUSES = new Set([404, 410]);

export function classifyPushFailure(statusCode: unknown): {
  outcome: Extract<DeliveryOutcome, 'failed' | 'expired'>;
  permanent: boolean;
  errorCode: string;
} {
  const status = typeof statusCode === 'number' && Number.isFinite(statusCode) ? statusCode : null;
  if (status !== null && GONE_STATUSES.has(status)) {
    return { outcome: 'expired', permanent: true, errorCode: `push_${status}` };
  }
  if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    // A malformed or rejected request will be rejected identically next time.
    return { outcome: 'failed', permanent: true, errorCode: `push_${status}` };
  }
  if (status !== null) return { outcome: 'failed', permanent: false, errorCode: `push_${status}` };
  return { outcome: 'failed', permanent: false, errorCode: 'push_unknown' };
}

export function emptyTally(): DeliveryTally {
  return { succeeded: 0, failed: 0, permanent: 0, lastErrorCode: null };
}

export function tallyDelivery(tally: DeliveryTally, result: {
  outcome: DeliveryOutcome;
  permanent?: boolean;
  errorCode?: string | null;
}): DeliveryTally {
  if (result.outcome === 'succeeded') return { ...tally, succeeded: tally.succeeded + 1 };
  const permanent = result.permanent === true;
  return {
    succeeded: tally.succeeded,
    failed: permanent ? tally.failed : tally.failed + 1,
    permanent: permanent ? tally.permanent + 1 : tally.permanent,
    lastErrorCode: result.errorCode ?? tally.lastErrorCode,
  };
}

/**
 * The occurrence key is the identity of a notification. Two enqueue attempts for the
 * same moment must produce the same key so the unique index collapses them.
 */
export function taskOccurrenceKey(taskId: string, dueDate: string): string {
  const epoch = Date.parse(dueDate);
  if (!Number.isFinite(epoch)) throw new Error('Invalid due date for occurrence key');
  return `task:${taskId}:${epoch}`;
}

export function reminderOccurrenceKey(reminderId: string, remindAt: string): string {
  const epoch = Date.parse(remindAt);
  if (!Number.isFinite(epoch)) throw new Error('Invalid remind_at for occurrence key');
  return `reminder:${reminderId}:${epoch}`;
}

export function dailyNudgeOccurrenceKey(tehranDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tehranDate)) throw new Error('Invalid Tehran date for occurrence key');
  return `nudge:${tehranDate}`;
}
