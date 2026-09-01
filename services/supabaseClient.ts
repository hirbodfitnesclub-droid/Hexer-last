
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z2lpZGVzZWh1YXFxbmNxaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTc0NDQsImV4cCI6MjA5NTYzMzQ0NH0.Ko5juJCP76hDXMWIKsvv1AIQlyTztH0Zh0m1KN1gPSo';

// Fail-safe: a missing env var must never crash the app at module load
// (a throw here produces a blank white screen after deploy).
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.error('[supabaseClient] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — falling back to baked-in defaults.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
