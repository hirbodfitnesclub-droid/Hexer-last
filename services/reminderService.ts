import { supabase } from './supabaseClient';

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
