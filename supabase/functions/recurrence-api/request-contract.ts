export type RecurrenceOperation = 'complete' | 'skip' | 'edit_current' | 'edit_future' | 'stop';

const EDITABLE_FIELDS = new Set([
  'title', 'description', 'priority', 'project_id', 'tags', 'checklist', 'due_date',
]);

export interface RecurrenceApiRequest {
  operation: RecurrenceOperation;
  taskId: string;
  expectedVersion: number;
  opId: string;
  requestId: string;
  idempotencyKey: string;
  /** Present for edit_current and edit_future. Only allowlisted fields survive. */
  updates?: Record<string, unknown>;
  /** Present only for edit_future when the rule itself changes. */
  recurrence?: Record<string, unknown> | null;
  /** Present for stop: keep the current occurrence as a one-off, or cancel it. */
  keepCurrent?: boolean;
}

export function parseRecurrenceRequest(value: unknown): RecurrenceApiRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest('Invalid request body');
  const input = value as Record<string, unknown>;

  const operation = input.operation as RecurrenceOperation;
  if (operation !== 'complete' && operation !== 'skip' && operation !== 'edit_current'
    && operation !== 'edit_future' && operation !== 'stop') {
    throw badRequest('Invalid recurrence operation');
  }

  const taskId = requiredUuid(input.taskId, 'taskId');
  const opId = requiredUuid(input.opId, 'opId');
  const requestId = requiredUuid(input.requestId, 'requestId');
  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw badRequest('Invalid expectedVersion');
  if (typeof input.idempotencyKey !== 'string') throw badRequest('Invalid idempotencyKey');
  const idempotencyKey = input.idempotencyKey;
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
    throw badRequest('Invalid idempotencyKey');
  }

  const base = { operation, taskId, expectedVersion, opId, requestId, idempotencyKey };

  if (operation === 'edit_current' || operation === 'edit_future') {
    const updates = input.updates;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw badRequest('Invalid updates');
    const keys = Object.keys(updates as Record<string, unknown>);
    if (keys.length === 0) throw badRequest('Invalid updates');
    for (const key of keys) {
      if (!EDITABLE_FIELDS.has(key)) throw badRequest(`Field not editable: ${key}`);
    }
    if (operation === 'edit_current') {
      if (input.recurrence !== undefined) throw badRequest('Recurrence cannot change for a single occurrence');
      return { ...base, updates: updates as Record<string, unknown> };
    }
    const recurrence = input.recurrence;
    if (recurrence !== undefined && recurrence !== null
      && (typeof recurrence !== 'object' || Array.isArray(recurrence))) {
      throw badRequest('Invalid recurrence');
    }
    return {
      ...base,
      updates: updates as Record<string, unknown>,
      ...(recurrence === undefined ? {} : { recurrence: recurrence as Record<string, unknown> | null }),
    };
  }

  if (operation === 'stop') {
    if (input.keepCurrent !== undefined && typeof input.keepCurrent !== 'boolean') {
      throw badRequest('Invalid keepCurrent');
    }
    return { ...base, keepCurrent: input.keepCurrent === undefined ? true : input.keepCurrent as boolean };
  }

  return base;
}

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw badRequest(`Invalid ${field}`);
  }
  return value;
}

function badRequest(message: string): Error {
  const error: any = new Error(message);
  error.status = 400;
  return error;
}
