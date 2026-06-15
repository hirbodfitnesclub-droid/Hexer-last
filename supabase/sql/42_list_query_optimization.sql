-- =========================================================================
-- Migration: 42_list_query_optimization.sql
-- Goal: Query performance improvements with composite indexes on critical paths
-- This SQL is idempotent and can be run safely multiple times.
-- =========================================================================

-- 1. Index on tasks for user-specific listing ordered by creation time
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_created_at_desc 
ON public.tasks (user_id, created_at DESC);

-- 2. Index on notes for user-specific listing ordered by creation time 
CREATE INDEX IF NOT EXISTS idx_notes_user_id_created_at_desc 
ON public.notes (user_id, created_at DESC);

-- 3. Index on tasks for user-specific due date lookups (reminders logic)
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_due_date 
ON public.tasks (user_id, due_date);

-- 4. Index on habit completions to fast query recent completions
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_id_completion_date 
ON public.habit_completions (habit_id, completion_date);
