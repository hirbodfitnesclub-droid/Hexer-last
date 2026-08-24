import { supabase } from './supabaseClient';
import type { Task } from '../types';

export interface RecurrenceCompletionResult {
  status: 'succeeded' | 'failed' | 'conflict' | 'blocked';
  operationId: string;
  current?: Task;
  next?: Task;
  errorCode?: string;
  server?: Task;
}

/** Server declined to handle this completion, so the caller keeps its own path. */
export const RECURRENCE_NOT_ENABLED = 'recurrence_not_enabled';

export type RecurrenceOutcome =
  | { kind: 'handled'; current: Task; next: Task | null }
  | { kind: 'not_enabled' }
  | { kind: 'conflict'; server?: Task }
  | { kind: 'unavailable'; reason: string };

export async function completeRecurringTask(input: {
  task: Task;
  opId: string;
  requestId: string;
  idempotencyKey: string;
}): Promise<RecurrenceOutcome> {
  if (typeof input.task.version !== 'number') return { kind: 'not_enabled' };

  let payload: any;
  try {
    const { data, error } = await supabase.functions.invoke('recurrence-api', {
      body: {
        operation: 'complete',
        taskId: input.task.id,
        expectedVersion: input.task.version,
        opId: input.opId,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (error) {
      // FunctionsHttpError keeps the body, which carries the machine-readable reason.
      const body = await (error as any)?.context?.json?.().catch(() => null);
      payload = body ?? { error: error.message };
    } else {
      payload = data;
    }
  } catch (error: any) {
    return { kind: 'unavailable', reason: error?.message ?? 'network_error' };
  }

  if (payload?.reason === 'feature_disabled') return { kind: 'not_enabled' };
  if (payload?.reason === 'version_conflict' || payload?.errorCode === 'version_conflict') {
    return { kind: 'conflict', server: payload?.server };
  }
  if (payload?.status === 'succeeded' && payload?.current) {
    return { kind: 'handled', current: payload.current as Task, next: (payload.next as Task) ?? null };
  }
  return { kind: 'unavailable', reason: payload?.errorCode ?? payload?.reason ?? payload?.error ?? 'unknown' };
}

export type RecurrenceScopeOperation = 'skip' | 'edit_current' | 'edit_future' | 'stop';

export interface RecurrenceScopeResult {
  status: 'succeeded';
  operationId?: string;
  task?: Task;
  seriesId?: string;
  clearedCount?: number;
  futureUpdated?: number;
  anchorRewritten?: boolean;
}

export type RecurrenceScopeOutcome =
  | { kind: 'handled'; result: RecurrenceScopeResult }
  | { kind: 'not_enabled' }
  | { kind: 'conflict'; server?: Task }
  | { kind: 'unavailable'; reason: string };

/**
 * Scope operations on a recurring series. The server derives every date and rule
 * transition, so the caller only names the intent and the fields to change.
 */
export async function runRecurrenceScopeOperation(input: {
  operation: RecurrenceScopeOperation;
  task: Task;
  opId: string;
  requestId: string;
  idempotencyKey: string;
  updates?: Record<string, unknown>;
  recurrence?: Record<string, unknown> | null;
  keepCurrent?: boolean;
}): Promise<RecurrenceScopeOutcome> {
  if (typeof input.task.version !== 'number') return { kind: 'not_enabled' };

  let payload: any;
  try {
    const { data, error } = await supabase.functions.invoke('recurrence-api', {
      body: {
        operation: input.operation,
        taskId: input.task.id,
        expectedVersion: input.task.version,
        opId: input.opId,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        ...(input.updates ? { updates: input.updates } : {}),
        ...(input.recurrence === undefined ? {} : { recurrence: input.recurrence }),
        ...(input.keepCurrent === undefined ? {} : { keepCurrent: input.keepCurrent }),
      },
    });
    payload = error
      ? (await (error as any)?.context?.json?.().catch(() => null)) ?? { error: error.message }
      : data;
  } catch (error: any) {
    return { kind: 'unavailable', reason: error?.message ?? 'network_error' };
  }

  if (payload?.reason === 'feature_disabled') return { kind: 'not_enabled' };
  if (payload?.reason === 'version_conflict' || payload?.errorCode === 'version_conflict') {
    return { kind: 'conflict', server: payload?.server };
  }
  if (payload?.status === 'succeeded') return { kind: 'handled', result: payload as RecurrenceScopeResult };
  return { kind: 'unavailable', reason: payload?.errorCode ?? payload?.reason ?? payload?.error ?? 'unknown' };
}
