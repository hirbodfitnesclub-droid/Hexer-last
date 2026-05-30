import { supabase } from './supabaseClient';
import { Subscription, UsageStatus } from '../types';

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

export async function startCheckout(planCode: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('zibal-request', {
    body: { plan_code: planCode }
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
