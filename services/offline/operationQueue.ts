import type { ConflictResolution } from './conflicts';
import { deleteFromStore, getAllFromStore, getFromStore, putToStore } from './idb';

/**
 * Operation-based offline queue. The v2 store is keyed by `op_id` rather than entity
 * id, so two edits to the same task are two operations instead of one overwriting the
 * other. Rows are partitioned by user, carry explicit dependencies and a base version,
 * and record their own retry schedule.
 */

export type OperationStatus = 'pending' | 'processing' | 'blocked' | 'failed' | 'conflicted';

export type OperationAction = 'insert' | 'update' | 'delete' | 'set_completion' | 'toggle';

export interface OfflineOperation {
  opId: string;
  userId: string;
  deviceId: string;
  entity: string;
  entityId: string;
  /** Set when `entityId` is still a client-generated placeholder. */
  tempId?: string;
  action: OperationAction;
  payload: Record<string, unknown>;
  baseVersion?: number;
  dependsOn: string[];
  status: OperationStatus;
  attemptCount: number;
  nextAttemptAt: number;
  createdAt: number;
  lastError?: string;
  conflict?: {
    serverVersion?: number;
    resolution?: ConflictResolution;
  };
}

export interface TempIdMapping {
  tempId: string;
  realId: string;
  userId: string;
  mappedAt: number;
}

/** Ceiling so a permanently unhealthy operation stops consuming attempts. */
export const MAX_ATTEMPTS = 8;

export function createOperation(input: {
  opId: string;
  userId: string;
  deviceId: string;
  entity: string;
  entityId: string;
  action: OperationAction;
  payload?: Record<string, unknown>;
  baseVersion?: number;
  dependsOn?: string[];
  tempId?: string;
  now?: number;
}): OfflineOperation {
  if (!input.opId || !input.userId || !input.entityId) throw new Error('Invalid operation identity');
  const now = input.now ?? Date.now();
  const dependsOn = [...new Set(input.dependsOn ?? [])].filter(id => id !== input.opId);
  return {
    opId: input.opId,
    userId: input.userId,
    deviceId: input.deviceId,
    entity: input.entity,
    entityId: input.entityId,
    ...(input.tempId ? { tempId: input.tempId } : {}),
    action: input.action,
    payload: input.payload ?? {},
    ...(typeof input.baseVersion === 'number' ? { baseVersion: input.baseVersion } : {}),
    dependsOn,
    status: dependsOn.length > 0 ? 'blocked' : 'pending',
    attemptCount: 0,
    nextAttemptAt: now,
    createdAt: now,
  };
}

/**
 * Operations ready to flush, in dependency-safe order. An operation is held back while
 * any parent is still queued, so a child never reaches the server before its parent.
 */
export function selectRunnable(input: {
  operations: OfflineOperation[];
  userId: string;
  now: number;
}): OfflineOperation[] {
  const mine = input.operations.filter(op => op.userId === input.userId);
  const unresolved = new Set(mine.filter(op => op.status !== 'failed').map(op => op.opId));
  return mine
    .filter(op => op.status === 'pending' || op.status === 'blocked')
    .filter(op => op.nextAttemptAt <= input.now)
    .filter(op => op.dependsOn.every(parent => !unresolved.has(parent)))
    .sort((left, right) => left.createdAt - right.createdAt || left.opId.localeCompare(right.opId));
}

/** Operations whose parent failed permanently can never succeed; surface them instead of retrying. */
export function selectOrphaned(operations: OfflineOperation[]): OfflineOperation[] {
  const failed = new Set(operations.filter(op => op.status === 'failed').map(op => op.opId));
  if (failed.size === 0) return [];
  return operations.filter(op => op.status !== 'failed' && op.dependsOn.some(parent => failed.has(parent)));
}

export type FailureClass = 'retryable' | 'auth_refresh' | 'auth_pause' | 'permanent' | 'conflict';

/**
 * A 401 is worth exactly one refresh-and-retry. Without a session the queue pauses
 * rather than burning attempts, because the operations are still valid.
 */
export function classifyFailure(input: {
  status?: number | null;
  hasSession: boolean;
  message?: string;
}): FailureClass {
  const status = typeof input.status === 'number' ? input.status : null;
  if (status === 409) return 'conflict';
  if (status === 401) return input.hasSession ? 'auth_refresh' : 'auth_pause';
  if (status === 403) return 'permanent';
  if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) return 'permanent';
  if (status !== null && (status >= 500 || status === 408 || status === 429)) return 'retryable';
  if (/failed to fetch|networkerror|load failed/i.test(input.message ?? '')) return 'retryable';
  return 'retryable';
}

export function applyFailure(op: OfflineOperation, input: {
  failure: FailureClass;
  now: number;
  message?: string;
  serverVersion?: number;
}): OfflineOperation {
  const attemptCount = op.attemptCount + 1;
  const base = { ...op, attemptCount, lastError: input.message ?? op.lastError };

  if (input.failure === 'conflict') {
    return { ...base, status: 'conflicted', conflict: { serverVersion: input.serverVersion } };
  }
  if (input.failure === 'permanent') return { ...base, status: 'failed' };
  if (input.failure === 'auth_pause') {
    // Not the operation's fault: keep it pending and do not count the attempt.
    return { ...op, status: 'pending', lastError: input.message ?? op.lastError };
  }
  if (attemptCount >= MAX_ATTEMPTS) return { ...base, status: 'failed' };

  return { ...base, status: 'pending', nextAttemptAt: input.now + backoffMs(attemptCount) };
}

export function backoffMs(attemptCount: number): number {
  const seconds = Math.min(300, 2 ** Math.max(1, attemptCount));
  return seconds * 1000;
}

/**
 * Rewrites a placeholder id into the server id across queued operations. Only identity
 * fields and declared reference fields are touched; payload text is never string-replaced,
 * so a note whose body happens to contain the placeholder is left alone.
 */
export const REFERENCE_FIELDS = ['project_id', 'task_id', 'note_id', 'habit_id', 'related_entity_id', 'recurrence_series_id'];

export function applyTempIdMapping(operations: OfflineOperation[], mapping: {
  tempId: string;
  realId: string;
  userId: string;
}): OfflineOperation[] {
  return operations.map(op => {
    if (op.userId !== mapping.userId) return op;

    const nextEntityId = op.entityId === mapping.tempId ? mapping.realId : op.entityId;
    let payloadChanged = false;
    const nextPayload: Record<string, unknown> = { ...op.payload };
    for (const field of REFERENCE_FIELDS) {
      if (nextPayload[field] === mapping.tempId) {
        nextPayload[field] = mapping.realId;
        payloadChanged = true;
      }
    }
    if (nextEntityId === op.entityId && !payloadChanged) return op;

    return {
      ...op,
      entityId: nextEntityId,
      ...(op.tempId === mapping.tempId ? { tempId: undefined } : {}),
      payload: payloadChanged ? nextPayload : op.payload,
    };
  });
}

// --- Persistence -----------------------------------------------------------
// The IndexedDB stores backing this queue were added in schema v3.

const OPERATIONS_STORE = 'operations';
const TEMP_ID_STORE = 'tempIdMap';

export async function enqueueOperation(operation: OfflineOperation): Promise<void> {
  await putToStore(OPERATIONS_STORE, operation);
}

export async function listOperations(userId: string): Promise<OfflineOperation[]> {
  const all = (await getAllFromStore(OPERATIONS_STORE)) as OfflineOperation[];
  return all.filter(op => op.userId === userId);
}

export async function saveOperation(operation: OfflineOperation): Promise<void> {
  await putToStore(OPERATIONS_STORE, operation);
}

export async function removeOperation(opId: string): Promise<void> {
  await deleteFromStore(OPERATIONS_STORE, opId);
}

export async function getOperation(opId: string): Promise<OfflineOperation | undefined> {
  return (await getFromStore(OPERATIONS_STORE, opId)) as OfflineOperation | undefined;
}

/**
 * Persists a placeholder-to-server id mapping and rewrites every queued operation
 * that references it, so a child operation created offline finds its parent.
 */
export async function recordTempIdMapping(input: {
  tempId: string;
  realId: string;
  userId: string;
}): Promise<void> {
  const mapping: TempIdMapping = { ...input, mappedAt: Date.now() };
  await putToStore(TEMP_ID_STORE, mapping);

  const operations = await listOperations(input.userId);
  const remapped = applyTempIdMapping(operations, input);
  for (let index = 0; index < operations.length; index += 1) {
    if (remapped[index] !== operations[index]) await putToStore(OPERATIONS_STORE, remapped[index]);
  }
}

export async function resolveTempId(tempId: string): Promise<string | null> {
  const mapping = (await getFromStore(TEMP_ID_STORE, tempId)) as TempIdMapping | undefined;
  return mapping?.realId ?? null;
}

/** Drops every operation belonging to a user, used when that user signs out. */
export async function clearOperationsForUser(userId: string): Promise<number> {
  const mine = await listOperations(userId);
  for (const op of mine) await deleteFromStore(OPERATIONS_STORE, op.opId);
  return mine.length;
}

export interface QueueSummary {
  pending: number;
  blocked: number;
  conflicted: number;
  failed: number;
  orphaned: number;
}

export async function summarizeQueue(userId: string): Promise<QueueSummary> {
  const mine = await listOperations(userId);
  return {
    pending: mine.filter(op => op.status === 'pending' || op.status === 'processing').length,
    blocked: mine.filter(op => op.status === 'blocked').length,
    conflicted: mine.filter(op => op.status === 'conflicted').length,
    failed: mine.filter(op => op.status === 'failed').length,
    orphaned: selectOrphaned(mine).length,
  };
}
