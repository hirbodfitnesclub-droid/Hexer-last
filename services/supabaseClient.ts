
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z2lpZGVzZWh1YXFxbmNxaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTc0NDQsImV4cCI6MjA5NTYzMzQ0NH0.Ko5juJCP76hDXMWIKsvv1AIQlyTztH0Zh0m1KN1gPSo';

// Guard against crash on initial Javascript module loading if env vars are unset
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder');

