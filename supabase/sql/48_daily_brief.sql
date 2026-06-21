-- =========================================================================
-- Migration: 48_daily_brief.sql
-- Goal: Create global table public.daily_briefs for caching daily AI summaries.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.daily_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brief_date DATE NOT NULL,
    content TEXT NOT NULL,
    tasks_signature TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'deepseek/deepseek-v4-flash',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT daily_briefs_user_id_brief_date_key UNIQUE (user_id, brief_date)
);

-- Index for speedy queries on user and specific day
CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date ON public.daily_briefs (user_id, brief_date);

-- Enable RLS
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

-- Owner can read their daily briefs
DROP POLICY IF EXISTS "Users can read their own daily briefs" ON public.daily_briefs;
CREATE POLICY "Users can read their own daily briefs"
    ON public.daily_briefs FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Notify schema reloading
NOTIFY pgrst, 'reload schema';
