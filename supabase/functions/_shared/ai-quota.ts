import type { NormalizedAiUsage } from './ai-telemetry.ts';

export interface QuotaReservation {
  allowed: boolean;
  reservationId: string | null;
  requestId: string | null;
  model: string | null;
  remaining: number;
  reason: string;
}

export async function reserveAiQuota(input: {
  userClient: any;
  feature: string;
  idempotencyKey: string;
  requestedModelKey: string;
}): Promise<QuotaReservation> {
  const { data, error } = await input.userClient.rpc('reserve_ai_quota', {
    p_feature: input.feature,
    p_idempotency_key: input.idempotencyKey,
    p_requested_model_key: input.requestedModelKey,
  });
  if (error) throw new Error(`Quota reservation failed: ${error.message}`);
  const value = Array.isArray(data) ? data[0] : data;
  if (!value) throw new Error('Quota reservation returned no result');
  return {
    allowed: Boolean(value.allowed),
    reservationId: stringOrNull(value.reservation_id),
    requestId: stringOrNull(value.request_id),
    model: stringOrNull(value.model),
    remaining: nonNegativeInteger(value.remaining) ?? 0,
    reason: String(value.reason ?? 'unknown'),
  };
}

export async function startAiRequest(input: {
  serviceClient: any;
  reservationId: string;
  userId: string;
}): Promise<boolean> {
  const { data, error } = await input.serviceClient.rpc('start_ai_request', {
    p_reservation_id: input.reservationId,
    p_user_id: input.userId,
  });
  if (error) throw new Error(`AI request start failed: ${error.message}`);
  return data === true;
}

export async function finalizeAiSuccess(input: {
  serviceClient: any;
  reservationId: string;
  userId: string;
  usage: NormalizedAiUsage;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { data, error } = await input.serviceClient.rpc('finalize_ai_request_success', {
    p_reservation_id: input.reservationId,
    p_user_id: input.userId,
    p_actual_model: input.usage.actualModel,
    p_actual_provider: input.usage.actualProvider,
    p_provider_request_id: input.usage.providerRequestId,
    p_input_tokens: input.usage.inputTokens,
    p_output_tokens: input.usage.outputTokens,
    p_reasoning_tokens: input.usage.reasoningTokens,
    p_cached_tokens: input.usage.cachedTokens,
    p_cost_microunits: input.usage.costMicrounits,
    p_usage_source: input.usage.usageSource,
    p_latency_ms: Math.max(0, Math.floor(input.latencyMs)),
    p_metadata: input.metadata ?? {},
  });
  if (error || data !== true) throw new Error(`AI success finalization failed: ${error?.message ?? 'not finalized'}`);
}

export async function finalizeAiFailure(input: {
  serviceClient: any;
  reservationId: string;
  userId: string;
  failureClass: string;
  httpStatus?: number | null;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { data, error } = await input.serviceClient.rpc('finalize_ai_request_failure', {
    p_reservation_id: input.reservationId,
    p_user_id: input.userId,
    p_failure_class: input.failureClass,
    p_http_status: input.httpStatus ?? null,
    p_latency_ms: Math.max(0, Math.floor(input.latencyMs)),
    p_metadata: input.metadata ?? {},
  });
  if (error || data !== true) throw new Error(`AI failure finalization failed: ${error?.message ?? 'not finalized'}`);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : null;
}
