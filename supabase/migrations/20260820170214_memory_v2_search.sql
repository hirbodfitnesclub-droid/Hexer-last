begin;

-- Retrieval for Memory V2. Candidates come from four independent signals, fused with
-- reciprocal rank, and every filter is applied inside SQL before the limit so a type or
-- time filter can never be defeated by ranking. Returns spans, so a citation can point
-- at the exact text that was retrieved.

create or replace function public.search_memory_v2(
  p_user_id uuid,
  p_query_embedding vector,
  p_query_text text,
  p_query_tokens text[] default '{}'::text[],
  p_source_types text[] default null,
  p_updated_after timestamptz default null,
  p_project_ids uuid[] default null,
  p_match_count integer default 20
)
returns table(
  document_id uuid,
  chunk_id uuid,
  source_type text,
  source_id uuid,
  title text,
  content text,
  span_start integer,
  span_end integer,
  dense_rank integer,
  lexical_rank integer,
  trigram_rank integer,
  exact_rank integer,
  fusion_score double precision,
  dense_similarity double precision
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  with scoped as (
    select c.id as chunk_id, c.document_id, c.content, c.span_start, c.span_end, c.embedding,
           d.source_type, d.source_id, d.title, d.normalized_text, d.metadata, d.updated_at
    from public.memory_chunks c
    join public.memory_documents d on d.id = c.document_id
    where c.user_id = p_user_id
      and d.user_id = p_user_id
      and d.status = 'indexed'
      and (p_source_types is null or d.source_type = any(p_source_types))
      and (p_updated_after is null or d.updated_at >= p_updated_after)
      and (
        p_project_ids is null
        or (d.metadata->>'project_id') is not null
        and (d.metadata->>'project_id')::uuid = any(p_project_ids)
      )
  ),
  dense as (
    select chunk_id, document_id,
           row_number() over (order by embedding <=> p_query_embedding) as rank,
           1 - (embedding <=> p_query_embedding) as similarity
    from scoped
    where p_query_embedding is not null and embedding is not null
    order by embedding <=> p_query_embedding
    limit greatest(p_match_count * 3, 30)
  ),
  lexical as (
    select chunk_id,
           row_number() over (
             order by ts_rank_cd(to_tsvector('simple', content), websearch_to_tsquery('simple', p_query_text)) desc
           ) as rank
    from scoped
    where coalesce(btrim(p_query_text), '') <> ''
      and to_tsvector('simple', content) @@ websearch_to_tsquery('simple', p_query_text)
    limit greatest(p_match_count * 3, 30)
  ),
  trigram as (
    select chunk_id, row_number() over (order by similarity(title, p_query_text) desc) as rank
    from scoped
    where coalesce(btrim(p_query_text), '') <> ''
      and title is not null
      and similarity(title, p_query_text) > 0.2
    limit greatest(p_match_count, 20)
  ),
  exact as (
    -- An exact normalized title match must outrank everything else; this is the
    -- "find the note called X" case.
    select chunk_id, row_number() over (order by span_start) as rank
    from scoped
    where array_length(p_query_tokens, 1) is not null
      and title is not null
      and title = array_to_string(p_query_tokens, ' ')
    limit greatest(p_match_count, 20)
  ),
  fused as (
    select
      s.chunk_id, s.document_id, s.source_type, s.source_id, s.title, s.content,
      s.span_start, s.span_end,
      d.rank as dense_rank, l.rank as lexical_rank, t.rank as trigram_rank, e.rank as exact_rank,
      coalesce(d.similarity, 0) as dense_similarity,
      -- Reciprocal rank fusion with a strong bonus for an exact title hit.
      coalesce(1.0 / (60 + d.rank), 0) +
      coalesce(1.0 / (60 + l.rank), 0) * 0.9 +
      coalesce(1.0 / (60 + t.rank), 0) * 0.6 +
      coalesce(1.0 / (60 + e.rank), 0) * 3.0 as fusion_score
    from scoped s
    left join dense d on d.chunk_id = s.chunk_id
    left join lexical l on l.chunk_id = s.chunk_id
    left join trigram t on t.chunk_id = s.chunk_id
    left join exact e on e.chunk_id = s.chunk_id
    where d.chunk_id is not null or l.chunk_id is not null or t.chunk_id is not null or e.chunk_id is not null
  ),
  -- One chunk per document keeps the result list diverse instead of returning five
  -- fragments of the same note.
  deduped as (
    select *, row_number() over (partition by document_id order by fusion_score desc) as per_document
    from fused
  )
  select document_id, chunk_id, source_type, source_id, title, content, span_start, span_end,
         dense_rank, lexical_rank, trigram_rank, exact_rank, fusion_score, dense_similarity
  from deduped
  where per_document = 1
  order by fusion_score desc
  limit p_match_count;
$function$;

revoke all on function public.search_memory_v2(uuid, vector, text, text[], text[], timestamptz, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.search_memory_v2(uuid, vector, text, text[], text[], timestamptz, uuid[], integer)
  to service_role;

commit;
