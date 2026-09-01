begin;

-- Memory recall fixes (fix-cycle 2):
--  1. Persian-aware normalization/tokenization helpers with colloquial stop words.
--  2. hybrid_search lexical side reworked: token matching instead of whole-string
--     trigram similarity ("خب برام پیداش کن" previously matched nothing). Keyword-poor
--     queries are enriched from the user's recent chat messages, so "پیداش کن" can
--     resolve to the topic of the conversation ("یادداشت تقویت مغز").
--  3. kick_legacy_vectorize: operator tool that backfills missing per-entity
--     embeddings by calling the vectorize worker for every NULL row.

-- ---------------------------------------------------------------------------
-- 1. Shared text normalization (both query and document sides use it).
-- ---------------------------------------------------------------------------
create or replace function public.memory_norm(p_text text)
returns text
language sql
immutable
as $function$
  select trim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(p_text, '')),
          'يىك' || chr(8204) || chr(8205) || chr(8206) || chr(8207) || chr(65279),
          'ییک'
        ),
        '[' || chr(1) || '-' || chr(31) || chr(127) || ']', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$function$;

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
      'نیستم','بودن','دارن','داره','هرچی','همهش','کل','توی','باید','نباید','ممکن','شاید',
      'را','همو','خودم','خودت','خودش','ما','شما','من','تو','او','انها','ها','هایی'
    );
$function$;

create or replace function public.token_match_count(p_tokens text[], p_haystack text)
returns integer
language sql
immutable
as $function$
  with t as (select unnest(p_tokens) as tok)
  select count(*)::int from t
  where strpos(public.memory_norm(p_haystack), tok) > 0;
$function$;

-- ---------------------------------------------------------------------------
-- 2. hybrid_search: token-aware lexical side + chat-context enrichment.
--    Signature and return shape unchanged; callers need no update.
-- ---------------------------------------------------------------------------
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
                x.id, x.type, x.title, x.snippet, x.matched, x.sim,
                (x.matched::float8 / v_token_total + 0.3 * x.sim)::float8 AS val_text
            FROM (
                SELECT
                    t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                    public.token_match_count(v_tokens, coalesce(t.title, '') || ' ' || coalesce(t.description, '')) AS matched,
                    similarity(public.memory_norm(coalesce(t.title, '')), public.memory_norm(v_effective_text))::float8 AS sim
                FROM public.tasks t
                WHERE t.user_id = v_user_id
                UNION ALL
                SELECT
                    n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                    public.token_match_count(v_tokens, coalesce(n.title, '') || ' ' || coalesce(n.content, '')) AS matched,
                    similarity(public.memory_norm(coalesce(n.title, '')), public.memory_norm(v_effective_text))::float8 AS sim
                FROM public.notes n
                WHERE n.user_id = v_user_id
                UNION ALL
                SELECT
                    p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                    public.token_match_count(v_tokens, coalesce(p.title, '') || ' ' || coalesce(p.description, '')) AS matched,
                    similarity(public.memory_norm(coalesce(p.title, '')), public.memory_norm(v_effective_text))::float8 AS sim
                FROM public.projects p
                WHERE p.user_id = v_user_id
            ) x
            WHERE x.matched > 0
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

-- ---------------------------------------------------------------------------
-- 3. Embedding backfill kicker: posts one vectorize request per NULL row.
--    Call repeatedly (it is async via pg_net) until 0 rows remain.
-- ---------------------------------------------------------------------------
create or replace function public.kick_legacy_vectorize(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, vault
as $function$
declare
  v_url text := 'https://rvgiidesehuaqqncqilu.supabase.co/functions/v1/vectorize';
  v_secret text;
  v_count integer := 0;
  r record;
  v_type text;
  v_table text;
begin
  if p_limit < 1 or p_limit > 1000 then raise exception 'invalid_limit'; end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'vectorize_worker_secret'
  limit 1;
  if v_secret is null then raise exception 'vectorize_worker_secret missing from vault'; end if;

  foreach v_type in array array['task', 'note', 'project'] loop
    v_table := case v_type when 'task' then 'tasks' when 'note' then 'notes' else 'projects' end;
    for r in
      execute format('select id from public.%I where embedding is null order by created_at limit $1', v_table)
      using (p_limit - v_count)
    loop
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-worker-secret', v_secret
        ),
        body := jsonb_build_object('type', v_type, 'id', r.id)
      );
      v_count := v_count + 1;
      exit when v_count >= p_limit;
    end loop;
    exit when v_count >= p_limit;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.kick_legacy_vectorize(integer) from public, anon, authenticated;
grant execute on function public.kick_legacy_vectorize(integer) to service_role;
revoke all on function public.memory_norm(text) from public, anon, authenticated;
revoke all on function public.content_tokens(text) from public, anon, authenticated;
revoke all on function public.token_match_count(text[], text) from public, anon, authenticated;

commit;
