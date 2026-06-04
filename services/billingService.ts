import { supabase } from './supabaseClient';
import { Subscription, UsageStatus, ManualPaymentState } from '../types';
import { compressImage, dataURLtoBlob } from '../utils/imageUtils';

export async function getSubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
  return data as Subscription;
}

export async function getUsage(): Promise<UsageStatus | null> {
  const { data, error } = await supabase
    .from('usage_counters')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error fetching usage counters:', error);
    throw error;
  }
  return data as UsageStatus;
}

export async function startCheckout(planCode: string, discountCode?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('zibal-request', {
    body: { plan_code: planCode, discount_code: discountCode }
  });

  if (error) {
    console.error('Error starting checkout:', error);
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const payUrl = data?.payUrl;
  if (!payUrl) {
    throw new Error('سیستم پرداخت پاسخ معتبری بازنگرداند.');
  }

  // Redirect client to Zibal gateway
  window.location.href = payUrl;
  return payUrl;
}

export async function previewDiscount(planCode: string, code: string): Promise<any> {
  const { data, error } = await supabase.rpc('preview_discount', {
    p_plan_code: planCode,
    p_code: code
  });

  if (error) {
    console.error('Error in previewDiscount RPC:', error);
    throw error;
  }
  return data;
}

export async function getManualPaymentState(): Promise<ManualPaymentState> {
  const { data, error } = await supabase
    .from('payments')
    .select('status, manual_decline_reason')
    .eq('gateway', 'card_to_card')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching manual payment state:', error);
    throw error;
  }

  if (!data) return { state: 'none' };

  if (data.status === 'pending_manual') {
    return { state: 'pending' };
  } else if (data.status === 'failed' && data.manual_decline_reason) {
    return { state: 'rejected', reason: data.manual_decline_reason };
  }

  return { state: 'none' };
}

export async function submitManualPayment(planCode: string, code: string | null, file: File): Promise<string> {
  // 1. Initial size check
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("حجم فایل انتخاب شده بیش از ۲ مگابایت است. لطفاً تصویر کوچک‌تری انتخاب کنید.");
  }

  // 2. Client-side compression loop under 500KB
  let quality = 0.8;
  let maxWidth = 1200;
  let maxHeight = 1200;
  let currentBlob: Blob = file;

  if (file.size > 500 * 1024) {
    try {
      let base64 = await compressImage(file, maxWidth, maxHeight, quality);
      currentBlob = dataURLtoBlob(base64);

      while (currentBlob.size > 500 * 1024 && quality > 0.2) {
        quality -= 0.15;
        maxWidth = Math.floor(maxWidth * 0.8);
        maxHeight = Math.floor(maxHeight * 0.8);
        const base64Iter = await compressImage(file, maxWidth, maxHeight, quality);
        currentBlob = dataURLtoBlob(base64Iter);
      }
    } catch (compressionError: any) {
      console.error('Image compression failed:', compressionError);
      throw new Error("خطا در فشرده‌سازی تصویر رسید. لطفاً مجدداً تلاش کنید.");
    }
  }

  // 3. User verification
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("کاربر وارد نشده است.");
  }

  const userId = user.id;
  const randomUuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  const filePath = `${userId}/${randomUuid}.jpg`;

  // 4. Upload to receipts storage bucket
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, currentBlob, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (uploadError) {
    console.error('Storage Upload Error:', uploadError);
    throw new Error("خطا در آپلود رسید بانکی. لطفاً مجدداً تلاش کنید.");
  }

  // 5. Database RPC submission
  const { data: paymentId, error: rpcError } = await supabase.rpc('submit_manual_payment', {
    p_plan_code: planCode,
    p_code: code || null,
    p_receipt_path: filePath
  });

  if (rpcError) {
    console.error('submit_manual_payment RPC Error:', rpcError);
    throw rpcError;
  }

  return paymentId as string;
}

export async function verifyPayment(trackId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('zibal-verify', {
    body: { trackId }
  });

  if (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
