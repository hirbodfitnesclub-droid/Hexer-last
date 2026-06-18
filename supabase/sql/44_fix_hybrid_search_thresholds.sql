-- =========================================================================
-- Migration: 44_fix_hybrid_search_thresholds.sql
-- Goal: Overwrite hybrid_search with Gemini embedding distance thresholds (>= 0.50)
--       to filter out non-relevant vector matches while keeping tsvector for Exact Match.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.hybrid_search(
    p_query_embedding vector(768),
    p_query_text text,
    p_match_count int,
    p_filter_type text DEFAULT NULL,
    p_date_from timestamptz DEFAULT NULL,
    p_date_to timestamptz DEFAULT NULL,
    p_tags text[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    snippet TEXT,
    score FLOAT8
) AS $$
DECLARE
    v_user_id UUID;
    v_tsquery tsquery;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Standardize and extract tsquery ONLY if query is non-empty
    IF p_query_text IS NOT NULL AND trim(p_query_text) <> '' THEN
        v_tsquery := websearch_to_tsquery('simple'::regconfig, hexer_fa_normalize(p_query_text));
    END IF;

    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            sub.id, sub.type, sub.title, sub.snippet, sub.val_vector,
            ROW_NUMBER() OVER (ORDER BY sub.val_vector DESC) AS rank_val
        FROM (
            SELECT 
                t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                (1 - (t.embedding <=> p_query_embedding))::float8 AS val_vector
            FROM public.tasks t
            WHERE t.user_id = v_user_id
              AND (p_filter_type IS NULL OR p_filter_type = 'task')
              AND (p_date_from IS NULL OR t.created_at >= p_date_from)
              AND (p_date_to IS NULL OR t.created_at <= p_date_to)
              AND (p_tags IS NULL OR (t.tags IS NOT NULL AND t.tags && p_tags))
              AND t.embedding IS NOT NULL
              AND (1 - (t.embedding <=> p_query_embedding)) >= 0.50
            UNION ALL
            SELECT 
                n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                (1 - (n.embedding <=> p_query_embedding))::float8 AS val_vector
            FROM public.notes n
            WHERE n.user_id = v_user_id
              AND (p_filter_type IS NULL OR p_filter_type = 'note')
              AND (p_date_from IS NULL OR n.created_at >= p_date_from)
              AND (p_date_to IS NULL OR n.created_at <= p_date_to)
              AND (p_tags IS NULL OR (n.tags IS NOT NULL AND n.tags && p_tags))
              AND n.embedding IS NOT NULL
              AND (1 - (n.embedding <=> p_query_embedding)) >= 0.50
            UNION ALL
            SELECT 
                p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                (1 - (p.embedding <=> p_query_embedding))::float8 AS val_vector
            FROM public.projects p
            WHERE p.user_id = v_user_id
              AND (p_filter_type IS NULL OR p_filter_type = 'project')
              AND (p_date_from IS NULL OR p.created_at >= p_date_from)
              AND (p_date_to IS NULL OR p.created_at <= p_date_to)
              AND (p_tags IS NULL)
              AND p.embedding IS NOT NULL
              AND (1 - (p.embedding <=> p_query_embedding)) >= 0.50
        ) sub
        ORDER BY sub.val_vector DESC
        LIMIT 100
    ),
    text_results AS (
        SELECT 
            sub.id, sub.type, sub.title, sub.snippet, sub.val_text,
            ROW_NUMBER() OVER (ORDER BY sub.val_text DESC) AS rank_val
        FROM (
            SELECT 
                t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                ts_rank_cd(t.search_vector, v_tsquery)::float8 AS val_text
            FROM public.tasks t
            WHERE t.user_id = v_user_id
              AND (p_filter_type IS NULL OR p_filter_type = 'task')
              AND (p_date_from IS NULL OR t.created_at >= p_date_from)
              AND (p_date_to IS NULL OR t.created_at <= p_date_to)
              AND (p_tags IS NULL OR (t.tags IS NOT NULL AND t.tags && p_tags))
              AND v_tsquery IS NOT NULL
              AND t.search_vector @@ v_tsquery
            UNION ALL
            SELECT 
                n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                ts_rank_cd(n.search_vector, v_tsquery)::float8 AS val_text
            FROM public.notes n
            WHERE n.user_id = v_user_id
              AND (p_filter_type IS NULL OR p_filter_type = 'note')
              AND (p_date_from IS NULL OR n.created_at >= p_date_from)
              AND (p_date_to IS NULL OR n.created_at <= p_date_to)
              AND (p_tags IS NULL OR (n.tags IS NOT NULL AND n.tags && p_tags))
              AND v_tsquery IS NOT NULL
              AND n.search_vector @@ v_tsquery
            UNION ALL
            SELECT 
                p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                ts_rank_cd(p.search_vector, v_tsquery)::float8 AS val_text
            FROM public.projects p
            WHERE p.user_id = v_user_id
              AND (p_filter_type IS NULL OR p_filter_type = 'project')
              AND (p_date_from IS NULL OR p.created_at >= p_date_from)
              AND (p_date_to IS NULL OR p.created_at <= p_date_to)
              AND (p_tags IS NULL)
              AND v_tsquery IS NOT NULL
              AND p.search_vector @@ v_tsquery
        ) sub
        ORDER BY sub.val_text DESC
        LIMIT 100
    )
    SELECT 
        COALESCE(v.id, t.id) AS id,
        COALESCE(v.type, t.type) AS type,
        COALESCE(v.title, t.title) AS title,
        COALESCE(v.snippet, t.snippet) AS snippet,
        (
            COALESCE(1.0 / (60.0 + v.rank_val), 0.0) + 
            COALESCE(1.0 / (60.0 + t.rank_val), 0.0)
        )::float8 AS score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id AND v.type = t.type
    ORDER BY score DESC
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Notify schema reloading
NOTIFY pgrst, 'reload schema';
