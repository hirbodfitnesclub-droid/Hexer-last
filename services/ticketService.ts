import { supabase } from './supabaseClient';

export interface SupportTicket {
  id?: string;
  user_id?: string;
  subject: string;
  message: string;
  status?: 'open' | 'closed';
  created_at?: string;
}

export async function submitTicket(subject: string, message: string): Promise<SupportTicket> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('کاربر وارد نشده است.');
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.id,
      subject,
      message,
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting support ticket:', error);
    throw error;
  }

  return data as SupportTicket;
}

export async function getMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching support tickets:', error);
    throw error;
  }

  return data as SupportTicket[];
}
