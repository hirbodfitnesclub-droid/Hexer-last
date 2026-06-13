import { supabase } from './supabaseClient';

export const completeOnboarding = async (fullName: string): Promise<void> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw userError || new Error('کاربر یافت نشد. لطفا مجددا وارد شوید.');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName.trim(),
      onboarding_completed: true
    })
    .eq('id', user.id);

  if (error) {
    throw error;
  }
};
