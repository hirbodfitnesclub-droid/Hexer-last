// supabase/functions/sms-hook/index.ts
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: any;

Deno.serve(async (req: Request) => {
  // CORS Preflight Request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log('Received SMS hook payload:', JSON.stringify(body));

    // Supabase Send SMS Webhook passes params in custom structure:
    // payload: { user: { phone: ... }, sms: { otp: ... } } (or direct or record)
    const phone = body?.payload?.user?.phone || body?.user?.phone || body?.phone;
    const otp = body?.payload?.sms?.otp || body?.sms?.otp || body?.otp;

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن یا کد تایید دریافت نشد.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalized phone format (e.g. +989123456789 -> 09123456789)
    let cleanedPhone = phone.trim().replace(/\D/g, '');
    if (cleanedPhone.startsWith('98')) {
      cleanedPhone = '0' + cleanedPhone.slice(2);
    }
    if (!cleanedPhone.startsWith('0')) {
      cleanedPhone = '0' + cleanedPhone;
    }

    const apiKey = Deno.env.get('KAVENEGAR_API_KEY');
    if (!apiKey) {
      console.error('KAVENEGAR_API_KEY is not set in Deno env.');
      return new Response(
        JSON.stringify({ error: 'تنظیمات پنل پیامک روی سرور ست نشده است.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Kavenegar verify/lookup.json (using application/x-www-form-urlencoded)
    const kavenegarUrl = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`;
    const params = new URLSearchParams();
    params.set('receptor', cleanedPhone);
    params.set('token', otp);
    params.set('template', 'hexer-verify');

    console.log(`Sending SMS to ${cleanedPhone} with template hexer-verify`);

    const kavenegarResponse = await fetch(kavenegarUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const resultText = await kavenegarResponse.text();
    console.log('Kavenegar response status:', kavenegarResponse.status);
    console.log('Kavenegar response:', resultText);

    if (!kavenegarResponse.ok) {
      throw new Error(`خطا از سمت سرور پیامک: ${resultText}`);
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch {
      parsedResult = { raw: resultText };
    }

    return new Response(
      JSON.stringify({ success: true, data: parsedResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'خطای غیرمنتظره در ارسال پیامک' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
