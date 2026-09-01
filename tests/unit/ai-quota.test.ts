import { describe, expect, it, vi } from 'vitest';
import { finalizeAiFailure, finalizeAiSuccess, reserveAiQuota, startAiRequest } from '../../supabase/functions/_shared/ai-quota';

function client(result: { data?: unknown; error?: unknown }) {
  return { rpc: vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null }) };
}

describe('AI quota RPC adapter', () => {
  it('normalizes a reservation row', async () => {
    const userClient = client({ data: [{ allowed: true, reservation_id: 'r1', request_id: 'q1', model: 'm1', remaining: 4, reason: 'quota_reserved' }] });
    await expect(reserveAiQuota({ userClient, feature: 'assistant', idempotencyKey: 'chat:12345678', requestedModelKey: 'gemini' }))
      .resolves.toEqual({ allowed: true, reservationId: 'r1', requestId: 'q1', model: 'm1', remaining: 4, reason: 'quota_reserved' });
  });

  it('rejects reservation RPC errors', async () => {
    await expect(reserveAiQuota({ userClient: client({ error: { message: 'boom' } }), feature: 'assistant', idempotencyKey: 'chat:12345678', requestedModelKey: 'gemini' }))
      .rejects.toThrow('Quota reservation failed: boom');
  });

  it('requires a reservation result', async () => {
    await expect(reserveAiQuota({ userClient: client({ data: [] }), feature: 'assistant', idempotencyKey: 'chat:12345678', requestedModelKey: 'gemini' }))
      .rejects.toThrow('returned no result');
  });

  it('starts an owned reservation', async () => {
    const serviceClient = client({ data: true });
    await expect(startAiRequest({ serviceClient, reservationId: 'r1', userId: 'u1' })).resolves.toBe(true);
    expect(serviceClient.rpc).toHaveBeenCalledWith('start_ai_request', { p_reservation_id: 'r1', p_user_id: 'u1' });
  });

  it('reports a reservation that cannot be started', async () => {
    await expect(startAiRequest({ serviceClient: client({ data: false }), reservationId: 'r1', userId: 'u1' })).resolves.toBe(false);
  });

  it('rejects a start RPC error', async () => {
    await expect(startAiRequest({ serviceClient: client({ error: { message: 'denied' } }), reservationId: 'r1', userId: 'u1' }))
      .rejects.toThrow('denied');
  });

  it('finalizes provider usage without raw content', async () => {
    const serviceClient = client({ data: true });
    await finalizeAiSuccess({
      serviceClient, reservationId: 'r1', userId: 'u1', latencyMs: 12.9,
      usage: { providerRequestId: 'p1', actualModel: 'm1', actualProvider: 'google', inputTokens: 2, outputTokens: 3, reasoningTokens: 1, cachedTokens: 0, costMicrounits: 4, currency: 'USD', usageSource: 'provider' },
      metadata: { schemaVersion: 'v1' },
    });
    expect(serviceClient.rpc).toHaveBeenCalledWith('finalize_ai_request_success', expect.objectContaining({ p_latency_ms: 12, p_input_tokens: 2, p_metadata: { schemaVersion: 'v1' } }));
  });

  it('rejects failed success finalization', async () => {
    await expect(finalizeAiSuccess({
      serviceClient: client({ data: false }), reservationId: 'r1', userId: 'u1', latencyMs: 1,
      usage: { providerRequestId: null, actualModel: null, actualProvider: null, inputTokens: null, outputTokens: null, reasoningTokens: null, cachedTokens: null, costMicrounits: null, currency: null, usageSource: 'unknown' },
    })).rejects.toThrow('not finalized');
  });

  it('releases a failed request', async () => {
    const serviceClient = client({ data: true });
    await finalizeAiFailure({ serviceClient, reservationId: 'r1', userId: 'u1', failureClass: 'provider_5xx', httpStatus: 503, latencyMs: 4.8 });
    expect(serviceClient.rpc).toHaveBeenCalledWith('finalize_ai_request_failure', expect.objectContaining({ p_failure_class: 'provider_5xx', p_http_status: 503, p_latency_ms: 4 }));
  });

  it('rejects failed release', async () => {
    await expect(finalizeAiFailure({ serviceClient: client({ error: { message: 'denied' } }), reservationId: 'r1', userId: 'u1', failureClass: 'provider', latencyMs: 1 }))
      .rejects.toThrow('denied');
  });
});
