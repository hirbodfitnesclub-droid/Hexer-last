import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAllowedCorsHeaders, jsonResponse, requireUser, safeErrorResponse } from '../_shared/security.ts';

declare const Deno: any;

Deno.serve(async (req: Request) => {
  const corsHeaders = getAllowedCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);

  try {
    const { user } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const trackId = typeof body.trackId === 'string' || typeof body.trackId === 'number'
      ? String(body.trackId)
      : '';
    if (!/^(free_bypass_[0-9a-f-]{36}|\d{1,30})$/.test(trackId)) {
      return jsonResponse({ error: 'Invalid trackId' }, 400, corsHeaders);
    }

    const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secretKey) throw new Error('Privileged database configuration is missing');
    const service = createClient(Deno.env.get('SUPABASE_URL') || '', secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: payment, error: lookupError } = await service
      .from('payments')
      .select('id,user_id,plan_code,status,gateway,track_id,amount_irr,final_amount_irr,ref_number')
      .eq('track_id', trackId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!payment) return jsonResponse({ error: 'Payment not found' }, 404, corsHeaders);

    if (payment.status === 'paid') {
      return jsonResponse({
        status: 'success',
        message: 'Already processed',
        plan_code: payment.plan_code,
        refNumber: payment.ref_number,
      }, 200, corsHeaders);
    }
    if (payment.status !== 'pending') {
      return jsonResponse({ status: 'failed', error: 'Payment is not verifiable' }, 409, corsHeaders);
    }

    let refNumber: string;
    if (payment.gateway === 'bypass') {
      if (Number(payment.final_amount_irr) !== 0 || !trackId.startsWith('free_bypass_')) {
        throw new Error('Invalid bypass payment');
      }
      refNumber = `bypass_${payment.id}`;
    } else {
      if (payment.gateway !== 'zibal' || !/^\d{1,30}$/.test(trackId)) {
        return jsonResponse({ status: 'failed', error: 'Unsupported payment gateway' }, 400, corsHeaders);
      }

      const merchant = Deno.env.get('ZIBAL_MERCHANT');
      if (!merchant) throw new Error('Zibal merchant is not configured');
      const gatewayResponse = await fetch('https://gateway.zibal.ir/v1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant, trackId: Number(trackId) }),
      });
      if (!gatewayResponse.ok) throw new Error(`Zibal verify returned HTTP ${gatewayResponse.status}`);
      const result = await gatewayResponse.json();
      const success = result.result === 100 || result.result === 201;
      if (!success || Number(result.status) !== 1) {
        return jsonResponse({ status: 'failed', message: result.message || 'Payment was not verified' }, 400, corsHeaders);
      }
      if (String(result.orderId || '') !== String(payment.id)) {
        throw new Error('Gateway order mismatch');
      }
      if (Number(result.amount) !== Number(payment.final_amount_irr)) {
        throw new Error('Gateway amount mismatch');
      }
      refNumber = String(result.refNumber || '');
      if (!refNumber) throw new Error('Gateway reference number is missing');
    }

    const { error: activationError } = await service.rpc('activate_subscription', {
      p_user_id: user.id,
      p_plan_code: payment.plan_code,
      p_payment_id: payment.id,
    });
    if (activationError) throw activationError;

    const { error: updateError } = await service
      .from('payments')
      .update({ ref_number: refNumber })
      .eq('id', payment.id)
      .eq('user_id', user.id)
      .eq('status', 'paid');
    if (updateError) throw updateError;

    return jsonResponse({ status: 'success', plan_code: payment.plan_code, refNumber }, 200, corsHeaders);
  } catch (error) {
    return safeErrorResponse(error, corsHeaders);
  }
});
