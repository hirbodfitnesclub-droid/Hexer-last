-- =========================================================================
-- Migration: 49_related_knowledge.sql
-- Goal: Create global security definer RPC for zero-cost semantic search
--       pairing today's active tasks with similar user notes.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_related_knowledge_today()
RETURNS TABLE (
    task_id UUID,
    task_title TEXT,
    note_id UUID,
    note_title TEXT,
    note_snippet TEXT,
    similarity FLOAT8
) AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    WITH matches AS (
        SELECT 
            t.id AS m_task_id,
            t.title AS m_task_title,
            n_matches.id AS m_note_id,
            n_matches.title AS m_note_title,
            left(n_matches.content, 120) AS m_note_snippet,
            n_matches.sim::float8 AS m_similarity
        FROM (
            SELECT id, title, embedding
            FROM public.tasks
            WHERE user_id = v_user_id
              AND status != 'done'
              AND embedding IS NOT NULL
              -- Match tasks where due_date is today or belongs to today under Asia/Tehran timezone
              AND (due_date AT TIME ZONE 'Asia/Tehran')::date = (now() AT TIME ZONE 'Asia/Tehran')::date
        ) t
        CROSS JOIN LATERAL (
            SELECT n.id, n.title, n.content,
                   (1 - (n.embedding <=> t.embedding))::float8 AS sim
            FROM public.notes n
            WHERE n.user_id = v_user_id
              AND n.embedding IS NOT NULL
              AND (1 - (n.embedding <=> t.embedding)) >= 0.5
            ORDER BY n.embedding <=> t.embedding
            LIMIT 2
        ) n_matches
    ),
    deduped AS (
        SELECT 
            m.m_task_id, m.m_task_title, m.m_note_id, m.m_note_title, m.m_note_snippet, m.m_similarity,
            ROW_NUMBER() OVER (PARTITION BY m.m_note_id ORDER BY m.m_similarity DESC) as rn
        FROM matches m
    )
    SELECT 
        d.m_task_id AS task_id, 
        d.m_task_title AS task_title, 
        d.m_note_id AS note_id, 
        d.m_note_title AS note_title, 
        d.m_note_snippet AS note_snippet, 
        d.m_similarity AS similarity
    FROM deduped d
    WHERE d.rn = 1
    ORDER BY d.m_similarity DESC
    LIMIT 8;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Notify schema reloading
NOTIFY pgrst, 'reload schema';
