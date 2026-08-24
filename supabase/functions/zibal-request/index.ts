import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  enforceRateLimit,
  getAllowedCorsHeaders,
  jsonResponse,
  requireUser,
  safeErrorResponse,
} from '../_shared/security.ts';

declare const Deno: any;

type Discount = {
  id: string;
  discount_percent: number | null;
  discount_amount_irr: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

Deno.serve(async (req: Request) => {
  const corsHeaders = getAllowedCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);

  try {
    enforceRateLimit(req, 'zibal-request', 10, 60_000);
    const { user } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const planCode = typeof body.plan_code === 'string' ? body.plan_code : '';
    const discountCode = typeof body.discount_code === 'string' ? body.discount_code.trim().toUpperCase() : '';
    if (!/^[a-z0-9_-]{1,40}$/i.test(planCode)) {
      return jsonResponse({ error: 'Invalid plan code' }, 400, corsHeaders);
    }

    const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const callbackUrl = Deno.env.get('ZIBAL_CALLBACK_URL');
    const merchant = Deno.env.get('ZIBAL_MERCHANT');
    if (!secretKey || !callbackUrl || !merchant) throw new Error('Payment configuration is missing');
    const callback = new URL(callbackUrl);
    if (callback.protocol !== 'https:') throw new Error('Payment callback must use HTTPS');

    const service = createClient(Deno.env.get('SUPABASE_URL') || '', secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: plan, error: planError } = await service
      .from('plans')
      .select('price_irr,display_name')
      .eq('plan_code', planCode)
      .single();
    if (planError || !plan) return jsonResponse({ error: 'Selected plan not found' }, 404, corsHeaders);

    const planPrice = Number(plan.price_irr);
    if (!Number.isSafeInteger(planPrice) || planPrice < 0) throw new Error('Plan price is invalid');
    let discount: Discount | null = null;
    let discountAmount = 0;

    if (discountCode) {
      const { data, error } = await service
        .from('discount_codes')
        .select('id,discount_percent,discount_amount_irr,max_uses,used_count,expires_at,is_active')
        .eq('code', discountCode)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return jsonResponse({ error: 'کد تخفیف وارد شده معتبر نیست.' }, 400, corsHeaders);
      discount = data as Discount;
      if ((discount.expires_at && new Date(discount.expires_at).getTime() < Date.now()) ||
          (discount.max_uses !== null && discount.used_count >= discount.max_uses)) {
        return jsonResponse({ error: 'کد تخفیف وارد شده معتبر نیست.' }, 400, corsHeaders);
      }
      discountAmount = discount.discount_percent !== null
        ? Math.floor(planPrice * discount.discount_percent / 100)
        : Number(discount.discount_amount_irr || 0);
      discountAmount = Math.min(planPrice, Math.max(0, discountAmount));
    }

    const finalAmount = planPrice - discountAmount;
    if (finalAmount > 0 && finalAmount < 10_000) {
      return jsonResponse({ error: 'مبلغ نهایی کمتر از حداقل مجاز شبکه بانکی است.' }, 400, corsHeaders);
    }

    const gateway = finalAmount === 0 ? 'bypass' : 'zibal';
    const initialTrackId = gateway === 'bypass' ? `free_bypass_${crypto.randomUUID()}` : null;
    const { data: payment, error: paymentError } = await service.from('payments').insert({
      user_id: user.id,
      plan_code: planCode,
      amount_irr: planPrice,
      discount_code_id: discount?.id || null,
      discount_amount_irr: discountAmount,
      final_amount_irr: finalAmount,
      status: 'pending',
      gateway,
      track_id: initialTrackId,
    }).select('id').single();
    if (paymentError || !payment) throw new Error('Payment initialization failed');

    if (gateway === 'bypass') {
      callback.searchParams.set('trackId', initialTrackId!);
      return jsonResponse({ payUrl: callback.toString() }, 200, corsHeaders);
    }

    const gatewayResponse = await fetch('https://gateway.zibal.ir/v1/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant,
        amount: finalAmount,
        callbackUrl: callback.toString(),
        description: `خرید اشتراک هکسر طرح ${plan.display_name}`,
        orderId: payment.id,
      }),
    });
    if (!gatewayResponse.ok) throw new Error(`Zibal request returned HTTP ${gatewayResponse.status}`);
    const result = await gatewayResponse.json();
    if (result.result !== 100 || !/^\d{1,30}$/.test(String(result.trackId || ''))) {
      await service.from('payments').update({ status: 'failed' }).eq('id', payment.id).eq('status', 'pending');
      return jsonResponse({ error: 'Payment gateway rejected the request' }, 502, corsHeaders);
    }

    const trackId = String(result.trackId);
    const { error: updateError } = await service
      .from('payments')
      .update({ track_id: trackId })
      .eq('id', payment.id)
      .eq('user_id', user.id)
      .eq('status', 'pending');
    if (updateError) throw new Error('Payment synchronization failed');

    return jsonResponse({ payUrl: `https://gateway.zibal.ir/start/${trackId}` }, 200, corsHeaders);
  } catch (error) {
    return safeErrorResponse(error, corsHeaders);
  }
});
