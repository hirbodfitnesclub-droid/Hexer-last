import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser } from '../_shared/auth-guard.ts';
import { getGoogleGenAI } from '../_shared/gemini-client.ts';
import { buildSystemPrompt } from './lib/system-prompt.ts';
import { buildMetaContext } from './lib/meta-context.ts';
import { buildRagContext } from './lib/rag-context.ts';
import { downloadMediaParts } from './lib/media-handler.ts';
import { processActions } from './lib/action-processor.ts';
import { MODEL_KEYS, chooseThinkingEffort, resolveModel } from '../_shared/model-registry.ts';
import { parseAssistantRequest } from './lib/request-contract.ts';
import { AI_RESPONSE_JSON_SCHEMA, parseAiResponse } from './lib/ai-contract.ts';
import { classifyIntent, needsRag } from './lib/intent.ts';
import { filterActionsByPolicy, isMutationAction } from './lib/action-policy.ts';
import { applyHonesty, type HonestyFailureReason } from './lib/honesty.ts';
import { resolveFeatureDecision } from '../_shared/feature-flag-service.ts';
import { normalizeOpenRouterUsage } from '../_shared/ai-telemetry.ts';
import { finalizeAiFailure, finalizeAiSuccess, reserveAiQuota, startAiRequest } from '../_shared/ai-quota.ts';

declare const Deno: any;

function classifyFailure(error: any): string {
  const status = typeof error?.status === 'number' ? error.status : null;
  const message = String(error?.message ?? '').toLowerCase();
  if (status === 429) return 'provider_rate_limit';
  if (status !== null && status >= 500) return 'provider_5xx';
  if (message.includes('structured response') || message.includes('invalid ai response')) return 'schema_invalid';
  if (message.includes('quota')) return 'quota_error';
  return 'internal_error';
}

function mergeConsecutiveRoles(messages: any[]) {
  if (!messages || messages.length === 0) return [];
  const merged: any[] = [];
  for (const item of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
      const prev = merged[merged.length - 1];
      if (typeof prev.content === 'string' && typeof item.content === 'string') {
        prev.content += "\n" + item.content;
      } else if (Array.isArray(prev.content) && Array.isArray(item.content)) {
        prev.content.push(...item.content);
      } else {
        prev.content = String(prev.content) + "\n" + String(item.content);
      }
    } else {
      merged.push({ role: item.role, content: item.content });
    }
  }
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestStartedAt = Date.now();
  let quotaReservation: { id: string; userId: string; serviceClient: any } | null = null;
  let quotaFinalized = false;
  try {
    const authHeader = req.headers.get('Authorization');
    const { user, supabaseClient } = await getAuthUser(authHeader);

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', Allow: 'POST' },
      });
    }

    let requestBody;
    try {
      requestBody = parseAssistantRequest(await req.json());
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Invalid request body',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { message, history, mode, audioPath, imagePath, undoReceiptId, filters } = requestBody;
    const requestId = requestBody.requestId ?? crypto.randomUUID();
    const idempotencyKey = requestBody.idempotencyKey ?? `server:${requestId}`;
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    if (undoReceiptId) {
      const { data, error } = await supabaseService.rpc('undo_agent_action', {
        p_receipt_id: undoReceiptId,
        p_user_id: user.id,
      });
      if (error) {
        const message = error.message.includes('expired') ? 'مهلت بازگردانی تمام شده است.'
          : error.message.includes('already used') ? 'این تغییر قبلاً بازگردانی شده است.'
            : 'بازگردانی این تغییر ممکن نبود.';
        return new Response(JSON.stringify({ error: message }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        reply: 'تغییر با موفقیت بازگردانی شد.', citations: [], proposals: [], transcription: '',
        actionResults: [{
          type: data.entityType,
          operation: 'undo',
          data: data.data?.current ?? data.data,
          undoKind: data.undoKind,
          compound: data.undoKind === 'restore_recurring_completion'
            ? {
              kind: 'recurring_completion',
              upsert: data.data?.current ? [data.data.current] : [],
              removeIds: data.data?.deletedNextId ? [data.data.deletedNextId] : [],
              terminal: !data.data?.deletedNextId,
            }
            : undefined,
        }],
        meta: { intent: 'mutate', honesty: 'none', requestId },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const intent = classifyIntent({
      message,
      mode,
      hasMedia: Boolean(audioPath || imagePath),
    });

    // ۱. بررسی اعتبار و سهمیه هوش مصنوعی (Quota Gateway)
    let useQuotaReservations = false;
    try {
      const quotaDecision = await resolveFeatureDecision({
        serviceClient: supabaseService,
        key: 'ai_quota_reservations',
        userId: user.id,
        requestId,
      });
      useQuotaReservations = quotaDecision.enabled;
    } catch (error) {
      console.warn('Quota reservation flag unavailable; using legacy quota path.', error);
    }

    let quota: any;
    if (useQuotaReservations) {
      const reservation = await reserveAiQuota({
        userClient: supabaseClient,
        feature: 'ai-assistant',
        idempotencyKey,
        requestedModelKey: MODEL_KEYS.PRIMARY,
      });
      quota = { allowed: reservation.allowed, model: reservation.model, remaining: reservation.remaining, reason: reservation.reason };
      // An idempotent replay of a finished request must not re-run the model or
      // charge again; the caller is retrying a turn we already answered.
      if (reservation.reason === 'idempotent_replay') {
        return new Response(JSON.stringify({
          error: 'This request was already processed',
          reason: 'idempotent_replay',
          meta: { requestId },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        });
      }
      if (reservation.allowed && reservation.reservationId) {
        const started = await startAiRequest({ serviceClient: supabaseService, reservationId: reservation.reservationId, userId: user.id });
        if (!started) {
          return new Response(JSON.stringify({
            error: 'This request is already in progress',
            reason: 'reservation_in_progress',
            meta: { requestId },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          });
        }
        quotaReservation = { id: reservation.reservationId, userId: user.id, serviceClient: supabaseService };
      }
    } else {
      const { data: quotaResult, error: quotaError } = await supabaseClient.rpc('consume_ai_quota');
      if (quotaError) {
        console.error("Quota Check Error from RPC:", quotaError);
        throw new Error(`Quota restriction check failed: ${quotaError.message}`);
      }
      quota = Array.isArray(quotaResult) ? quotaResult[0] : quotaResult;
    }

    if (!quota) throw new Error("Unable to retrieve quota information");
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: "Quota exceeded or subscription expired",
        reason: quota.reason || "quota_exceeded"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402
      });
    }

    const configuredModel = typeof quota.model === 'string' && quota.model.trim()
      ? quota.model
      : MODEL_KEYS.PRIMARY;
    const modelConfig = resolveModel(configuredModel);
    const modelName = modelConfig.providerSlug;
    const thinkingEffort = chooseThinkingEffort({
      mode,
      hasMedia: Boolean(audioPath || imagePath),
      message,
    });
    const ai = getGoogleGenAI();

    // ۲. پردازش تاریخ‌های امروزی شمسی و میلادی
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const dayName = today.toLocaleDateString('fa-IR', { weekday: 'long' });
    const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(today);

    // ۳. همزمانی کوئری‌ها جهت جلوگیری از Waterfall Latency
    const isProposalMode = !!(audioPath || imagePath);

    const [metaContext, ragData] = await Promise.all([
      buildMetaContext(supabaseClient, mode, isProposalMode, todayStr),
      needsRag(intent)
        ? buildRagContext(supabaseClient, ai, message, filters)
        : Promise.resolve({ contextString: '', citations: [] })
    ]);

    const context = `${metaContext}${ragData.contextString}`;
    const systemPrompt = buildSystemPrompt({
      context,
      isProposalMode,
      todayStr,
      dayName,
      persianDate
    });

    // ۴. دانلود و الحاق فایل‌های چندرسانه‌ای
    const userMessageParts: any[] = [];
    if (message) userMessageParts.push({ type: 'text', text: message });
 
    if (audioPath || imagePath) {
      const mediaParts = await downloadMediaParts(supabaseService, { audioPath, imagePath }, user.id);
      userMessageParts.push(...mediaParts);
    }
 
    const userContent = (audioPath || imagePath) ? userMessageParts : (message || '');
 
    // ۵. فرمت‌بندی تاریخچه تعاملی کاربر
    const modelHistoryRaw = history.map((h) => ({
      role: h.sender === 'user' ? 'user' : 'assistant',
      content: h.text || ''
    }));
 
    const modelHistory = mergeConsecutiveRoles(modelHistoryRaw);
 
    const messages = [
      { role: 'system', content: systemPrompt },
      ...modelHistory,
      { role: 'user', content: userContent }
    ];
 
    // ۶. استعلام پاسخ از مدل هوشمند با استاندارد OpenAI / OpenRouter
    const response = await ai.chat.completions.create({
      model: modelName,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'hexer_assistant_response_v1',
          strict: true,
          schema: AI_RESPONSE_JSON_SCHEMA,
        },
      },
      provider: { require_parameters: true },
      max_tokens: modelConfig.maxOutputTokens,
      reasoning: { effort: thinkingEffort },
    });
 
    const rawText = response.choices[0].message.content;
    let aiResult;
    try {
      const cleanText = rawText?.replace(/```json\n?|\n?```/g, '').trim() || '{}';
      aiResult = parseAiResponse(JSON.parse(cleanText));
    } catch (error) {
      console.error('AI response contract violation:', error);
      throw new Error('The AI provider returned an invalid structured response.');
    }

    const policy = filterActionsByPolicy(intent, aiResult.actions);
    let actionResults: any[] = [];
    let executionFailures: Array<{ reason: string }> = [];
    const acceptedMutationCount = policy.accepted.filter((action) => isMutationAction(action.action)).length;
    let writesEnabled = true;

    if (acceptedMutationCount > 0) {
      const writeDecision = await resolveFeatureDecision({
        serviceClient: supabaseService,
        key: 'agent_writes',
        userId: user.id,
        requestId,
      });
      writesEnabled = writeDecision.enabled;
      if (!writesEnabled) executionFailures.push({ reason: 'policy_rejected' });
    }

    if (isProposalMode) {
      if (aiResult.actions.length > 0) {
        console.warn('Zero-write enforcement removed model actions from extraction mode.');
      }
    } else if (writesEnabled && policy.accepted.length > 0) {
      const execution = await processActions(
        policy.accepted, supabaseClient, supabaseService, ai, user.id, requestId
      );
      actionResults = execution.results;
      executionFailures.push(...execution.failures);
    }

    const mutationCount = acceptedMutationCount;
    const failureHints = [
      ...executionFailures.map((failure) => failure.reason),
      ...(policy.rejected.length > 0 ? ['policy_rejected'] : []),
    ].filter((reason): reason is HonestyFailureReason =>
      ['ambiguous', 'not_found', 'policy_rejected', 'all_failed', 'no_actions'].includes(reason)
    );
    const honest = applyHonesty({
      intent,
      reply: aiResult.reply,
      actionResults,
      acceptedMutationCount: mutationCount,
      failureHints,
    });

    const { error: auditError } = await supabaseService
      .from('agent_execution_audit')
      .insert({
        user_id: user.id,
        request_id: requestId,
        intent,
        model: modelName,
        thinking_effort: thinkingEffort,
        accepted_action_count: policy.accepted.length,
        rejected_action_count: policy.rejected.length,
        successful_action_count: actionResults.length,
        failed_action_count: executionFailures.length,
        honesty_mode: honest.mode,
        latency_ms: Date.now() - requestStartedAt,
      });
    if (auditError) console.error('Agent audit insert failed:', auditError);

    if (quotaReservation) {
      await finalizeAiSuccess({
        serviceClient: quotaReservation.serviceClient,
        reservationId: quotaReservation.id,
        userId: quotaReservation.userId,
        usage: normalizeOpenRouterUsage(response),
        latencyMs: Date.now() - requestStartedAt,
        metadata: {
          schemaName: 'hexer_assistant_response_v1',
          schemaVersion: '1',
          promptVersion: 'agent-core-v2',
          thinkingEffort,
          intent,
          successfulActionCount: actionResults.length,
          failedActionCount: executionFailures.length,
        },
      });
      quotaFinalized = true;
    }

    return new Response(JSON.stringify({
      reply: honest.reply,
      citations: ragData.citations,
      actionResults,
      proposals: isProposalMode ? aiResult.proposals : [],
      transcription: aiResult.transcription,
      meta: {
        intent,
        model: modelName,
        thinkingEffort,
        honesty: honest.mode,
        rejectedActionCount: policy.rejected.length,
        failedActionCount: executionFailures.length,
        requestId,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("AI Assistant Orchestrator General Error:", error);
    if (quotaReservation && !quotaFinalized) {
      try {
        await finalizeAiFailure({
          serviceClient: quotaReservation.serviceClient,
          reservationId: quotaReservation.id,
          userId: quotaReservation.userId,
          failureClass: classifyFailure(error),
          httpStatus: typeof error?.status === 'number' ? error.status : null,
          latencyMs: Date.now() - requestStartedAt,
        });
        quotaFinalized = true;
      } catch (finalizeError) {
        console.error('Quota failure finalization failed:', finalizeError);
      }
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.status || 500,
    });
  }
});
