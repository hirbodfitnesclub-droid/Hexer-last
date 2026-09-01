import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { enforceRateLimit, jsonResponse, safeErrorResponse } from '../_shared/security.ts';

declare const Deno: any;

type SmsHookPayload = {
  user?: { id?: string; phone?: string };
  sms?: { otp?: string };
  payload?: {
    user?: { id?: string; phone?: string };
    sms?: { otp?: string };
  };
};

function normalizeIranianPhone(phone: string): string {
  let cleaned = phone.trim().replace(/\D/g, '');
  if (cleaned.startsWith('98')) cleaned = `0${cleaned.slice(2)}`;
  if (!cleaned.startsWith('0')) cleaned = `0${cleaned}`;
  if (!/^09\d{9}$/.test(cleaned)) throw new Error('Unsupported phone number');
  return cleaned;
}

async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let deliveryKey: string | null = null;
  try {
    enforceRateLimit(req, 'sms-hook', 10, 60_000);
    const apiKey = Deno.env.get('KAVENEGAR_API_KEY');
    const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const signingSecret = Deno.env.get('SEND_SMS_HOOK_SECRET');
    if (!apiKey || !secretKey) throw new Error('SMS hook configuration is missing');
    // Fail closed (QA ISSUE_06-C): an accidentally deleted hook secret must never
    // silently reopen this endpoint to unsigned requests.
    if (!signingSecret) throw new Error('SEND_SMS_HOOK_SECRET is not configured');

    const rawBody = await req.text();
    if (rawBody.length === 0 || rawBody.length > 64_000) {
      return jsonResponse({ error: 'Invalid payload size' }, 413);
    }

    // Supabase invokes this hook BEFORE persisting a brand-new signup/OTP user, so
    // auth.admin.getUserById legitimately 404s there. A valid Standard Webhooks
    // signature proves the request came from Supabase itself, so it replaces the
    // ownership check for users that do not exist yet; caps and replay guard below
    // still apply. An existing user whose stored phone mismatches is rejected.
    let payload: SmsHookPayload;
    try {
      payload = new Webhook(signingSecret.replace('v1,whsec_', '')).verify(
        rawBody,
        Object.fromEntries(req.headers),
      ) as SmsHookPayload;
    } catch {
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }

    const user = payload.user || payload.payload?.user;
    const sms = payload.sms || payload.payload?.sms;
    if (!user?.id || !/^[0-9a-f-]{36}$/i.test(user.id) || !user.phone || !sms?.otp || !/^\d{6}$/.test(sms.otp)) {
      return jsonResponse({ error: 'Invalid SMS hook payload' }, 400);
    }

    const phone = normalizeIranianPhone(user.phone);
    const service = createClient(Deno.env.get('SUPABASE_URL') || '', secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authUser, error: userError } = await service.auth.admin.getUserById(user.id);
    const userExists = !userError && Boolean(authUser.user);
    // For an existing user the stored phone must match. For a not-yet-persisted
    // signup user the verified signature above is the ownership proof.
    if (userExists && (!authUser.user?.phone || normalizeIranianPhone(authUser.user.phone) !== phone)) {
      return jsonResponse({ error: 'SMS recipient does not match the Auth user' }, 403);
    }

    const phoneHash = await digest(`${user.id}:${phone}`);
    deliveryKey = await digest(rawBody);
    await service.from('sms_hook_deliveries').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString());

    const { count, error: countError } = await service
      .from('sms_hook_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('phone_hash', phoneHash)
      .gte('created_at', new Date(Date.now() - 600_000).toISOString());
    if (countError) throw countError;
    if ((count || 0) >= 3) return jsonResponse({ error: 'Too many SMS requests' }, 429);

    const { error: replayError } = await service.from('sms_hook_deliveries').insert({
      delivery_key: deliveryKey,
      phone_hash: phoneHash,
    });
    if (replayError?.code === '23505') return jsonResponse({ error: 'Duplicate SMS delivery' }, 409);
    if (replayError) throw replayError;

    const response = await fetch(`https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ receptor: phone, token: sms.otp, template: 'hexer-verify' }).toString(),
    });
    if (!response.ok) {
      await service.from('sms_hook_deliveries').delete().eq('delivery_key', deliveryKey);
      console.error('Kavenegar delivery failed', { status: response.status, userId: user.id });
      return jsonResponse({ error: { http_code: response.status, message: 'SMS delivery failed' } }, 502);
    }

    return jsonResponse({});
  } catch (error) {
    return safeErrorResponse(error);
  }
});
