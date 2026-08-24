import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser } from '../_shared/auth-guard.ts';
import { resolveFeatureDecision } from '../_shared/feature-flag-service.ts';
import { calculateNextOccurrence } from '../_shared/recurrence-calculator.ts';
import { parseRecurrenceRequest } from './request-contract.ts';

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { user, supabaseClient } = await getAuthUser(req.headers.get('Authorization'));
    const body = parseRecurrenceRequest(await req.json());
    const service = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const decision = await resolveFeatureDecision({
      serviceClient: service,
      key: 'recurrence_rpc_v2',
      userId: user.id,
      requestId: body.requestId,
    });
    if (!decision.enabled) return json({ error: 'Recurrence API is not enabled', reason: 'feature_disabled' }, 409);

    const { data: task, error: taskError } = await supabaseClient
      .from('tasks')
      .select('id,user_id,due_date,recurrence,version,status')
      .eq('id', body.taskId)
      .maybeSingle();
    if (taskError) throw new Error(`Task lookup failed: ${taskError.message}`);
    if (!task) return json({ error: 'Task not found', reason: 'not_found' }, 404);
    if (task.version !== body.expectedVersion) {
      return json({ error: 'Task changed on another device', reason: 'version_conflict', server: task }, 409);
    }
    // Completing or skipping a finished occurrence is a no-op; editing or stopping a
    // series from a completed row is still legitimate.
    if (task.status === 'done' && (body.operation === 'complete' || body.operation === 'skip')) {
      return json({ error: 'Task is already complete', reason: 'already_applied' }, 409);
    }

    const { data, error } = await dispatch({ service, userId: user.id, task, body });
    if (error) throw new Error(`Recurrence transaction failed: ${error.message}`);
    return json(data, 200);
  } catch (error: any) {
    console.error('Recurrence API error:', error);
    return json({ error: error?.message ?? 'Unexpected error' }, error?.status || 500);
  }
});

/**
 * Advances the rule server-side for occurrence-moving operations. The client never
 * supplies a due date, so it cannot inject an arbitrary occurrence.
 */
async function dispatch(input: {
  service: any;
  userId: string;
  task: any;
  body: ReturnType<typeof parseRecurrenceRequest>;
}): Promise<{ data: unknown; error: { message: string } | null }> {
  const { service, userId, task, body } = input;

  if (body.operation === 'complete' || body.operation === 'skip') {
    const next = calculateNextOccurrence({ fromDue: task.due_date, recurrence: task.recurrence });
    if (!next) {
      const finished: any = new Error('No next occurrence');
      finished.status = 409;
      throw finished;
    }
    const shared = {
      p_user_id: userId,
      p_task_id: task.id,
      p_expected_version: body.expectedVersion,
      p_op_id: body.opId,
      p_idempotency_key: body.idempotencyKey,
      p_next_due: next.nextDue,
      p_next_recurrence: next.nextRecurrence,
      p_occurrence_key: next.occurrenceKey,
      p_calculator_version: next.calculatorVersion,
    };
    return body.operation === 'complete'
      ? service.rpc('complete_recurring_task_v2', shared)
      : service.rpc('skip_recurring_occurrence_v2', shared);
  }

  if (body.operation === 'stop') {
    return service.rpc('stop_recurring_series_v2', {
      p_user_id: userId,
      p_task_id: task.id,
      p_expected_version: body.expectedVersion,
      p_op_id: body.opId,
      p_idempotency_key: body.idempotencyKey,
      p_keep_current: body.keepCurrent ?? true,
    });
  }

  return service.rpc('edit_recurring_series_v2', {
    p_user_id: userId,
    p_task_id: task.id,
    p_expected_version: body.expectedVersion,
    p_op_id: body.opId,
    p_idempotency_key: body.idempotencyKey,
    p_scope: body.operation === 'edit_future' ? 'future' : 'current',
    p_updates: body.updates ?? {},
    p_recurrence: body.recurrence ?? null,
    p_calculator_version: 'tehran-jalali-v1',
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
