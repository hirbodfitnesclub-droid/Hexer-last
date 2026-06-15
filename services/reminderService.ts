import { supabase } from './supabaseClient';
import { getDB, pruneShown as pruneOfflineShown } from './offline/idb';

export interface DBReminder {
  id: string;
  user_id: string;
  title: string;
  body: string;
  remind_at: string;
  type: 'task' | 'habit' | 'custom';
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_sent: boolean;
  is_read: boolean;
  created_at: string;
}

export async function getReminders(): Promise<DBReminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('remind_at', { ascending: false });

  if (error) {
    console.error('Error fetching reminders:', error);
    throw error;
  }
  return data as DBReminder[];
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({ is_read: true })
    .eq('id', id);

  if (error) {
    console.error('Error marking reminder as read:', error);
    throw error;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

export function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        dir: 'rtl',
        tag: 'hexer-reminder'
      });
    } catch (err) {
      console.warn('Could not spawn browser notification:', err);
    }
  }
}

// Help convert VAPID base64 key to Uint8Array for PushManager subscription
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers user's browser with the Service Worker push manager
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    console.warn('Push Notifications are not supported in this browser environment.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }
    
    return subscription;
  } catch (err) {
    console.error('Error during Push subscription setup:', err);
    throw err;
  }
}

/**
 * Invokes the database RPC to store the Web Push endpoint details
 */
export async function saveSubscription(
  subscription: PushSubscription,
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
): Promise<void> {
  const subscriptionJson = subscription.toJSON();
  
  if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
    throw new Error('مشخصات اشتراک نوتیفیکیشن ناقص است.');
  }

  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_endpoint: subscriptionJson.endpoint,
    p_p256dh: subscriptionJson.keys.p256dh,
    p_auth: subscriptionJson.keys.auth,
    p_user_agent: userAgent
  });

  if (error) {
    console.error('Failed to save push subscription in database:', error);
    throw new Error('خطا در ذخیره‌سازی اشتراک نوتیفیکیشن: ' + error.message);
  }
}

/**
 * Direct delivery of a visible notification via the Service Worker registration
 */
export async function showViaSW(title: string, body: string, options: any = {}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const messageId = options.messageId || options.data?.messageId || options.tag;
  if (messageId) {
    const isShown = await checkIfShownAndRegister(messageId);
    if (isShown) {
      console.log(`[Scheduler/Direct] Notification with messageId ${messageId} already shown. Skipping.`);
      return;
    }
  }

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        dir: 'rtl',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options
      });
      return;
    } catch (err) {
      console.warn('showNotification through register failed, dropping back to direct Notification:', err);
    }
  }
  sendBrowserNotification(title, body);
}

export async function checkIfShownAndRegister(messageId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return false;
  }
  try {
    const db = await getDB();
    const tx = db.transaction('shown', 'readwrite');
    const store = tx.objectStore('shown');
    const existing = await store.get(messageId);
    if (existing !== undefined) {
      await tx.done;
      return true; // Already shown
    }
    await store.put({ messageId, timestamp: Date.now() });
    await tx.done;
    return false; // First time, registered now
  } catch (err) {
    console.warn('[OfflineDB] Error in checkIfShownAndRegister:', err);
    return false;
  }
}

export async function pruneShown(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return;
  }
  try {
    await pruneOfflineShown();
  } catch (err) {
    console.warn('[OfflineDB] Error in pruneShown:', err);
  }
}

