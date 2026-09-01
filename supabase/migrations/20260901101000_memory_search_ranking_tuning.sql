begin;

-- Ranking tuning for hybrid_search (fix-cycle 2b):
--  - Title matches weigh 2x content matches: a note whose TITLE contains the
--    query topic must outrank one that merely mentions the word in passing.
--  - A few more conversational stop words ("توش", "گفته", "راجع", ...).

create or replace function public.content_tokens(p_text text)
returns text[]
language sql
immutable
as $function$
  with raw as (
    select unnest(string_to_array(public.memory_norm(p_text), ' ')) as tok
  )
  select coalesce(array_agg(distinct tok), '{}')
  from raw
  where char_length(tok) >= 2
    and tok ~ '[آ-ی0-9A-Za-z]'
    and tok not in (
      'خب','برام','برات','برای','که','رو','توی','تو','در','به','از','با','کن','کنم','کنید','کنه',
      'پیدا','پیداش','شو','بده','بدو','میخوام','میخوای','میخوایم','لطفا','لطفا','هم','یا','و',
      'این','اون','یه','یک','بودم','داشتم','دارم','هست','است','بود','شد','شده','بگو','بیار',
      'بزن','بکن','درباره','مورد','چی','چیزی','کجا','کی','چطور','چند','همه','هیچ','خواستم',
      'باشه','اوکی','مرسی','ممنون','سلام','هستی','هستم','بگیر','نشون','نمایش','نشان','لیست',
      'فهرست','مرور','هر','چندتا','دوباره','الان','امروز','دیروز','فردا','داشت','داری','آره',
      'نه','یعنی','البته','فقط','خیلی','کمی','مال','مثلا','ولی','پس','چرا','کمک','میشه','نمیشه',
      'بشه','کردم','کردی','کرده','میکنم','میکنی','خوب','اونو','اینو','اونم','اینم','نیست',
      'نیستم','بودن','دارن','داره','هرچی','همهش','کل','باید','نباید','ممکن','شاید',
      'را','همو','خودم','خودت','خودش','ما','شما','من','او','انها','ها','هایی',
      'توش','گفته','گفتم','میگم','راجع','راستش','بتونم','تونم','بذارم','گذاشتم','بودیم'
    );
$function$;

CREATE OR REPLACE FUNCTION public.hybrid_search(p_query_embedding vector, p_query_text text, p_match_count integer)
 RETURNS TABLE(id uuid, type text, title text, snippet text, score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_tokens text[];
    v_token_total integer;
    v_effective_text text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_effective_text := p_query_text;
    v_tokens := public.content_tokens(p_query_text);

    -- Keyword-poor queries ("خب برام پیداش کن") carry their real topic in the
    -- conversation, not the message. Mine the user's recent chat messages for
    -- content words so anaphoric requests can resolve.
    IF coalesce(array_length(v_tokens, 1), 0) = 0 THEN
        v_effective_text := p_query_text || ' ' || coalesce((
            SELECT string_agg(m.text, ' ')
            FROM (
                SELECT text FROM public.chat_messages
                WHERE user_id = v_user_id AND sender = 'user'
                ORDER BY created_at DESC
                LIMIT 3
            ) m
        ), '');
        v_tokens := public.content_tokens(v_effective_text);
    END IF;
    v_token_total := GREATEST(coalesce(array_length(v_tokens, 1), 1), 1);

    RETURN QUERY
    WITH vector_results AS (
        SELECT
            sub.id, sub.type, sub.title, sub.snippet, sub.val_vector,
            ROW_NUMBER() OVER (ORDER BY sub.val_vector DESC) AS rank_val
        FROM (
            SELECT
                t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                CASE WHEN t.embedding IS NULL THEN 0.0::float8 ELSE (1 - (t.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.tasks t
            WHERE t.user_id = v_user_id
            UNION ALL
            SELECT
                n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                CASE WHEN n.embedding IS NULL THEN 0.0::float8 ELSE (1 - (n.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.notes n
            WHERE n.user_id = v_user_id
            UNION ALL
            SELECT
                p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                CASE WHEN p.embedding IS NULL THEN 0.0::float8 ELSE (1 - (p.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.projects p
            WHERE p.user_id = v_user_id
        ) sub
        WHERE sub.val_vector >= 0.25
    ),
    text_results AS (
        SELECT
            sub.id, sub.type, sub.title, sub.snippet, sub.val_text,
            ROW_NUMBER() OVER (ORDER BY sub.val_text DESC) AS rank_val
        FROM (
            SELECT
                x.id, x.type, x.title, x.snippet,
                ((x.title_matched * 2.0 + x.content_matched * 1.0) / v_token_total
                 + 0.3 * x.sim)::float8 AS val_text
            FROM (
                SELECT
                    t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                    public.token_match_count(v_tokens, coalesce(t.title, '')) AS title_matched,
                    public.token_match_count(v_tokens, coalesce(t.description, '')) AS content_matched,
                    similarity(public.memory_norm(coalesce(t.title, '')), public.memory_norm(v_effective_text))::float8 AS sim
                FROM public.tasks t
                WHERE t.user_id = v_user_id
                UNION ALL
                SELECT
                    n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                    public.token_match_count(v_tokens, coalesce(n.title, '')) AS title_matched,
                    public.token_match_count(v_tokens, coalesce(n.content, '')) AS content_matched,
                    similarity(public.memory_norm(coalesce(n.title, '')), public.memory_norm(v_effective_text))::float8 AS sim
                FROM public.notes n
                WHERE n.user_id = v_user_id
                UNION ALL
                SELECT
                    p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                    public.token_match_count(v_tokens, coalesce(p.title, '')) AS title_matched,
                    public.token_match_count(v_tokens, coalesce(p.description, '')) AS content_matched,
                    similarity(public.memory_norm(coalesce(p.title, '')), public.memory_norm(v_effective_text))::float8 AS sim
                FROM public.projects p
                WHERE p.user_id = v_user_id
            ) x
            WHERE x.title_matched + x.content_matched > 0
        ) sub
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
    FULL OUTER JOIN text_results t ON t.id = v.id AND t.type = v.type
    ORDER BY score DESC
    LIMIT p_match_count;
END;
$function$;

commit;
