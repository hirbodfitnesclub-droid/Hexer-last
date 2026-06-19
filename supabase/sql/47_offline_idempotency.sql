-- supabase/sql/47_offline_idempotency.sql — این بلاکها را عیناً کپی کن.
-- DROP لازم است تا overloadِ قدیمی حذف و فراخوانیِ named-arg مبهم نشود.
DROP FUNCTION IF EXISTS public.create_task_with_tags(text, text, uuid, timestamptz, text, text[], jsonb);
CREATE OR REPLACE FUNCTION public.create_task_with_tags(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_due_date TIMESTAMPTZ DEFAULT NULL,
    p_priority TEXT DEFAULT 'medium',
    p_tags TEXT[] DEFAULT '{}',
    p_checklist JSONB DEFAULT '[]'::jsonb,
    p_id UUID DEFAULT NULL            -- ← آخرین پارامتر، با DEFAULT
)
RETURNS SETOF public.tasks AS $$
DECLARE
    v_id UUID := COALESCE(p_id, gen_random_uuid());
BEGIN
    INSERT INTO public.tasks (
        id, user_id, project_id, title, description, priority, due_date, tags, checklist, created_at, updated_at
    )
    VALUES (
        v_id, auth.uid(), p_project_id, p_title, p_description, p_priority, p_due_date, p_tags, p_checklist, now(), now()
    )
    ON CONFLICT (id) DO NOTHING;
    -- همیشه ردیفِ خودِ کاربر را برگردان (هم insertِ تازه، هم وجودِ قبلی). scope به auth.uid() = امنیت.
    RETURN QUERY
        SELECT * FROM public.tasks WHERE id = v_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.create_note_with_tags(text, text, uuid, text[]);
CREATE OR REPLACE FUNCTION public.create_note_with_tags(
    p_title TEXT,
    p_content TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_tags TEXT[] DEFAULT '{}',
    p_id UUID DEFAULT NULL            -- ← آخرین پارامتر، با DEFAULT
)
RETURNS SETOF public.notes AS $$
DECLARE
    v_id UUID := COALESCE(p_id, gen_random_uuid());
BEGIN
    INSERT INTO public.notes (
        id, user_id, project_id, title, content, tags, created_at, updated_at
    )
    VALUES (
        v_id, auth.uid(), p_project_id, p_title, p_content, p_tags, now(), now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN QUERY
        SELECT * FROM public.notes WHERE id = v_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
