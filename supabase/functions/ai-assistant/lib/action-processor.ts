import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { searchUserMemory } from '../../_shared/memory-retrieval.ts';
import type { AiAction, JsonObject } from './ai-contract.ts';
import { calculateRecurrenceCompletion } from '../../_shared/recurrence-calculator.ts';

export type ActionFailureReason = 'not_found' | 'ambiguous' | 'database_error' | 'invalid_action' | 'already_applied' | 'policy_rejected';

export interface ActionFailure {
  index: number;
  action: string;
  reason: ActionFailureReason;
}

export interface ProcessActionsResult {
  results: any[];
  failures: ActionFailure[];
}

type EntityType = 'task' | 'note' | 'project' | 'habit' | 'reminder' | 'link' | 'habit_completion';
type UndoKind = 'delete_created' | 'restore_updated' | 'delete_link' | 'restore_link' | 'delete_habit_completion' | 'restore_habit_completion';
type Resolution = { ok: true; row: any } | { ok: false; reason: 'not_found' | 'ambiguous' };

export async function processActions(
  actions: AiAction[],
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
  ai: any,
  userId: string,
  requestId: string
): Promise<ProcessActionsResult> {
  const results: any[] = [];
  const failures: ActionFailure[] = [];

  for (let index = 0; index < actions.length; index += 1) {
    const item = actions[index];
    try {
      const result = await executeAction(item, userClient, serviceClient, ai, userId, requestId, item.policyIndex ?? index);
      if ('failure' in result) {
        failures.push({ index, action: item.action, reason: result.failure });
      } else if (result.value?.operation === 'suggest_link' && Array.isArray(result.value.data)) {
        results.push(...result.value.data.map((doc: any) => ({
          type: doc.type, operation: 'suggest_link', data: doc,
        })));
      } else {
        results.push(result.value);
      }
    } catch (error) {
      console.error(`Failed to execute action ${item.action}:`, error);
      failures.push({ index, action: item.action, reason: 'database_error' });
    }
  }

  return { results, failures };
}

async function executeAction(
  item: AiAction,
  userClient: SupabaseClient,
  service: SupabaseClient,
  ai: any,
  userId: string,
  requestId: string,
  actionIndex: number
): Promise<{ value: any } | { failure: ActionFailureReason }> {
  if (item.action === 'CREATE_TASK') {
    const p = item.params;
    return createWithReceipt(service, userId, requestId, item.action, 'task', 'tasks', {
      user_id: userId, title: p.title, description: p.description || null, project_id: p.projectId || null,
      due_date: p.dueDate || null, priority: p.priority || 'medium', tags: p.tags || [], checklist: p.checklist || [],
    });
  }
  if (item.action === 'CREATE_NOTE') {
    const p = item.params;
    return createWithReceipt(service, userId, requestId, item.action, 'note', 'notes', {
      user_id: userId, title: p.title, content: p.content || null, project_id: p.projectId || null, tags: p.tags || [],
    });
  }
  if (item.action === 'CREATE_PROJECT') {
    const p = item.params;
    return createWithReceipt(service, userId, requestId, item.action, 'project', 'projects', {
      user_id: userId, title: p.title, description: p.description || null, color: p.color || 'sky', priority: p.priority || 'medium',
    });
  }
  if (item.action === 'CREATE_HABIT') {
    const p = item.params;
    return createWithReceipt(service, userId, requestId, item.action, 'habit', 'habits', {
      user_id: userId, name: p.name, description: p.description || null, frequency: p.frequency || 'daily', target_count: p.target_count || 1,
    });
  }
  if (item.action === 'CREATE_REMINDER') {
    const p = item.params;
    if (!isFutureDate(p.remindAt)) return { failure: 'invalid_action' };
    if (p.relatedEntityId && !(await ownsRelatedEntity(service, userId, p.relatedEntityType, p.relatedEntityId))) return { failure: 'not_found' };
    return createWithReceipt(service, userId, requestId, item.action, 'reminder', 'reminders', {
      user_id: userId, title: p.title, body: p.body || null, remind_at: p.remindAt, type: p.type || 'custom',
      related_entity_type: p.relatedEntityType || null, related_entity_id: p.relatedEntityId || null,
    });
  }
  if (item.action === 'UPDATE_TASK' || item.action === 'COMPLETE_TASK' || item.action === 'REOPEN_TASK' || item.action === 'UPDATE_TASK_CHECKLIST') {
    const p = item.params;
    const found = await resolveOwned(
      service,
      'tasks',
      userId,
      p.taskId,
      p.taskTitle || p.title,
      'title',
      item.action === 'COMPLETE_TASK'
    );
    if (!found.ok) return { failure: found.reason };
    // Recurring completion owns its successor and receipt in one database transaction.
    if (item.action === 'COMPLETE_TASK' && found.row.recurrence != null) {
      if (typeof found.row.version !== 'number') return { failure: 'policy_rejected' };
      const plan = calculateRecurrenceCompletion({
        fromDue: found.row.due_date,
        recurrence: found.row.recurrence,
      });
      if (plan.kind === 'invalid') return { failure: 'invalid_action' };
      const { data, error } = await service.rpc('complete_recurring_task_v3', {
        p_user_id: userId,
        p_task_id: found.row.id,
        p_expected_version: found.row.version,
        p_op_id: operationIdForAction(requestId, actionIndex),
        p_idempotency_key: `agent:${requestId}:action:${actionIndex}`,
        p_next_due: plan.kind === 'advance' ? plan.nextDue : null,
        p_next_recurrence: plan.kind === 'advance' ? plan.nextRecurrence : null,
        p_occurrence_key: plan.kind === 'advance' ? plan.occurrenceKey : null,
        p_calculator_version: plan.calculatorVersion,
        p_is_terminal: plan.kind === 'terminal',
        p_provenance: 'ai',
        p_request_id: requestId,
      });
      if (error) throw error;
      if (data?.status !== 'succeeded' || !data.current) {
        return { failure: data?.errorCode === 'already_applied' ? 'already_applied' : 'policy_rejected' };
      }
      return {
        value: {
          type: 'task',
          operation: 'complete',
          data: data.current,
          receiptId: data.receiptId ?? undefined,
          undoExpiresAt: data.undoExpiresAt ?? undefined,
          compound: {
            kind: 'recurring_completion',
            upsert: data.next ? [data.current, data.next] : [data.current],
            removeIds: [],
            terminal: data.terminal === true,
          },
        },
      };
    }
    const patch = item.action === 'COMPLETE_TASK'
      ? { status: 'done', completed_at: new Date().toISOString() }
      : item.action === 'REOPEN_TASK'
        ? { status: 'todo', completed_at: null }
        : item.action === 'UPDATE_TASK_CHECKLIST'
          ? { checklist: p.updates.checklist }
          : mapTaskUpdates(p.updates);
    return updateWithReceipt(service, userId, requestId, item.action, 'task', 'tasks', found.row, patch);
  }
  if (item.action === 'UPDATE_NOTE') {
    const p = item.params;
    const found = await resolveOwned(service, 'notes', userId, p.noteId, p.noteTitle, 'title');
    if (!found.ok) return { failure: found.reason };
    return updateWithReceipt(service, userId, requestId, item.action, 'note', 'notes', found.row, mapUpdates(p.updates, { projectId: 'project_id' }));
  }
  if (item.action === 'UPDATE_PROJECT') {
    const p = item.params;
    const found = await resolveOwned(service, 'projects', userId, p.projectId, p.projectTitle, 'title');
    if (!found.ok) return { failure: found.reason };
    return updateWithReceipt(service, userId, requestId, item.action, 'project', 'projects', found.row, p.updates);
  }
  if (item.action === 'UPDATE_HABIT') {
    const p = item.params;
    const found = await resolveOwned(service, 'habits', userId, p.habitId, p.habitName, 'name');
    if (!found.ok) return { failure: found.reason };
    return updateWithReceipt(service, userId, requestId, item.action, 'habit', 'habits', found.row, p.updates);
  }
  if (item.action === 'UPDATE_REMINDER' || item.action === 'SNOOZE_REMINDER' || item.action === 'MARK_REMINDER_READ') {
    const p = item.params;
    const found = await resolveOwned(service, 'reminders', userId, p.reminderId, p.reminderTitle, 'title');
    if (!found.ok) return { failure: found.reason };
    const patch = item.action === 'SNOOZE_REMINDER'
      ? { remind_at: p.remindAt, is_sent: false }
      : item.action === 'MARK_REMINDER_READ'
        ? { is_read: p.isRead }
        : mapUpdates(p.updates, { remindAt: 'remind_at', isRead: 'is_read' });
    if (patch.remind_at && !isFutureDate(String(patch.remind_at))) return { failure: 'invalid_action' };
    return updateWithReceipt(service, userId, requestId, item.action, 'reminder', 'reminders', found.row, patch);
  }
  if (item.action === 'SET_HABIT_COMPLETION') {
    const p = item.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.completionDate)) return { failure: 'invalid_action' };
    const found = await resolveOwned(service, 'habits', userId, p.habitId, p.habitName, 'name');
    if (!found.ok) return { failure: found.reason };
    const state = { habit_id: found.row.id, completion_date: p.completionDate };
    const { data: existing, error: selectError } = await service.from('habit_completions').select('*')
      .eq('user_id', userId).eq('habit_id', found.row.id).eq('completion_date', p.completionDate).maybeSingle();
    if (selectError) throw selectError;
    if (p.completed && existing) return { failure: 'already_applied' };
    if (!p.completed && !existing) return { failure: 'already_applied' };
    if (p.completed) {
      const { data, error } = await service.from('habit_completions').insert({ user_id: userId, ...state }).select().single();
      if (error) throw error;
      const receipt = await insertReceipt(service, userId, requestId, item.action, 'habit_completion', data.id, null, state, 'delete_habit_completion');
      return { value: actionResult('habit_completion', 'complete', data, receipt) };
    }
    const { error } = await service.from('habit_completions').delete().eq('id', existing.id).eq('user_id', userId);
    if (error) throw error;
    const receipt = await insertReceipt(service, userId, requestId, item.action, 'habit_completion', existing.id, state, null, 'restore_habit_completion');
    return { value: actionResult('habit_completion', 'update', state, receipt) };
  }
  if (item.action === 'LINK_TASK_NOTE' || item.action === 'UNLINK_TASK_NOTE') {
    const p = item.params;
    const [task, note] = await Promise.all([
      resolveOwned(service, 'tasks', userId, p.taskId, p.taskTitle, 'title'),
      resolveOwned(service, 'notes', userId, p.noteId, p.noteTitle, 'title'),
    ]);
    if (!task.ok) return { failure: task.reason };
    if (!note.ok) return { failure: note.reason };
    const state = { task_id: task.row.id, task_title: task.row.title, note_id: note.row.id, note_title: note.row.title };
    const { data: existing, error: selectError } = await service.from('task_note_links').select('*')
      .eq('user_id', userId).eq('task_id', task.row.id).eq('note_id', note.row.id).maybeSingle();
    if (selectError) throw selectError;
    if (item.action === 'LINK_TASK_NOTE') {
      if (existing) return { failure: 'already_applied' };
      const { data, error } = await service.from('task_note_links').insert({ user_id: userId, task_id: task.row.id, note_id: note.row.id }).select().single();
      if (error) throw error;
      const receipt = await insertReceipt(service, userId, requestId, item.action, 'link', data.id, null, state, 'delete_link');
      return { value: actionResult('link', 'link', state, receipt) };
    }
    if (!existing) return { failure: 'not_found' };
    const { error } = await service.from('task_note_links').delete().eq('id', existing.id).eq('user_id', userId);
    if (error) throw error;
    const receipt = await insertReceipt(service, userId, requestId, item.action, 'link', existing.id, state, null, 'restore_link');
    return { value: actionResult('link', 'unlink', state, receipt) };
  }
  if (item.action === 'SUGGEST_LINK') {
    const { hits } = await searchUserMemory({
      userClient, serviceClient: service, userId, ai,
      message: item.params.queryText, matchCount: 5,
    });
    return { value: {
      type: 'link', operation: 'suggest_link',
      data: hits.map((doc) => ({ type: doc.type, id: doc.id, title: doc.title, snippet: doc.snippet, score: doc.score })),
    } };
  }
  return { failure: 'invalid_action' };
}

function operationIdForAction(requestId: string, actionIndex: number): string {
  const bytes = new Uint8Array(requestId.replace(/-/g, '').match(/.{2}/g)!.map(value => Number.parseInt(value, 16)));
  bytes[15] ^= actionIndex & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function createWithReceipt(service: SupabaseClient, userId: string, requestId: string, action: string, entityType: EntityType, table: string, row: JsonObject) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw error;
  try {
    const receipt = await insertReceipt(service, userId, requestId, action, entityType, data.id, null, data, 'delete_created');
    return { value: actionResult(entityType, 'create', data, receipt) };
  } catch (error) {
    await service.from(table).delete().eq('id', data.id).eq('user_id', userId);
    throw error;
  }
}

async function updateWithReceipt(service: SupabaseClient, userId: string, requestId: string, action: string, entityType: EntityType, table: string, before: any, patch: JsonObject) {
  const { data, error } = await service.from(table).update(patch).eq('id', before.id).eq('user_id', userId).select().single();
  if (error) throw error;
  try {
    const receipt = await insertReceipt(service, userId, requestId, action, entityType, data.id, before, data, 'restore_updated');
    return { value: actionResult(entityType, 'update', data, receipt) };
  } catch (error) {
    const restore = stripManagedFields(before);
    await service.from(table).update(restore).eq('id', before.id).eq('user_id', userId);
    throw error;
  }
}

async function insertReceipt(service: SupabaseClient, userId: string, requestId: string, action: string, entityType: EntityType, entityId: string | null, beforeState: unknown, afterState: unknown, undoKind: UndoKind) {
  const { data, error } = await service.from('agent_action_receipts').insert({
    user_id: userId, request_id: requestId, action, entity_type: entityType, entity_id: entityId,
    before_state: beforeState, after_state: afterState, undo_kind: undoKind,
  }).select('id, expires_at').single();
  if (error) throw error;
  return data;
}

function actionResult(type: EntityType, operation: string, data: unknown, receipt: { id: string; expires_at: string }) {
  return { type, operation, data, receiptId: receipt.id, undoExpiresAt: receipt.expires_at };
}

async function resolveOwned(service: SupabaseClient, table: string, userId: string, id: string | null | undefined, title: string | null | undefined, titleColumn: string, excludeDone = false): Promise<Resolution> {
  if (id) {
    let query = service.from(table).select('*').eq('id', id).eq('user_id', userId);
    if (excludeDone) query = query.neq('status', 'done');
    const { data, error } = await query.maybeSingle();
    if (error || !data) return { ok: false, reason: 'not_found' };
    return { ok: true, row: data };
  }
  const exact = String(title || '').trim();
  if (!exact) return { ok: false, reason: 'not_found' };
  let query = service.from(table).select('*').eq('user_id', userId).ilike(titleColumn, exact).limit(2);
  if (excludeDone) query = query.neq('status', 'done');
  const { data, error } = await query;
  if (error || !data?.length) return { ok: false, reason: 'not_found' };
  if (data.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: true, row: data[0] };
}

function mapTaskUpdates(updates: JsonObject): JsonObject {
  const patch = mapUpdates(updates, { dueDate: 'due_date', projectId: 'project_id' });
  if ('status' in updates) patch.completed_at = updates.status === 'done' ? new Date().toISOString() : null;
  return patch;
}

function mapUpdates(updates: JsonObject, aliases: Record<string, string>): JsonObject {
  return Object.fromEntries(Object.entries(updates).map(([key, value]) => [aliases[key] || key, value]));
}

function stripManagedFields(row: JsonObject): JsonObject {
  const { id: _id, user_id: _user, created_at: _created, updated_at: _updated, embedding: _embedding, search_vector: _search, ...safe } = row;
  return safe;
}

function isFutureDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

async function ownsRelatedEntity(service: SupabaseClient, userId: string, type: string | null | undefined, id: string): Promise<boolean> {
  const table = type === 'task' ? 'tasks' : type === 'habit' ? 'habits' : type === 'note' ? 'notes' : type === 'project' ? 'projects' : null;
  if (!table) return false;
  const { data, error } = await service.from(table).select('id').eq('id', id).eq('user_id', userId).maybeSingle();
  return !error && Boolean(data);
}
