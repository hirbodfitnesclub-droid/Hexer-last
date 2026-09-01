begin;

-- Memory V2 hardening cycle 1:
--  1. SQL-side feature flag resolver so DB triggers obey feature_flags.
--  2. Enqueue triggers are gated on memory_v2 (stops paid embeddings while off).
--  3. Job supersession also works for delete jobs (version-only rule missed them).
--  4. Lease expiry now counts an attempt, so poisoned jobs eventually go dead.
--  5. Document upsert is idempotent on content hash, not source version, so text
--     edits are never lost to a version drift caused by non-textual field changes.
--  6. Lexical/trigram indexes for search_memory_v2 (was full scan per query).
--  7. Operator-invocable backfill for legacy rows.

-- ---------------------------------------------------------------------------
-- 1. Feature flag resolver usable inside triggers (no edge function involved).
-- ---------------------------------------------------------------------------
create or replace function public.feature_flag_enabled(
  p_key text,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  f public.feature_flags%rowtype;
  o public.feature_flag_overrides%rowtype;
  v_bucket bigint;
begin
  if p_key is null then
    return false;
  end if;

  select * into f from public.feature_flags where key = p_key;
  if not found then
    return false;
  end if;

  if f.starts_at is not null and now() < f.starts_at then
    return false;
  end if;
  if f.expires_at is not null and now() >= f.expires_at then
    return false;
  end if;

  if p_user_id is not null then
    select * into o
    from public.feature_flag_overrides
    where flag_key = p_key
      and user_id = p_user_id
      and environment = 'production'
      and (expires_at is null or expires_at > now())
    limit 1;
    if found and o.enabled is not null then
      return o.enabled;
    end if;
  end if;

  if not f.enabled then
    return false;
  end if;
  if f.rollout_percent >= 100 then
    return true;
  end if;
  if p_user_id is null then
    return false;
  end if;

  v_bucket := ('x' || substr(md5(coalesce(f.rollout_salt, '') || ':' || p_user_id::text), 1, 8))::bit(32)::bigint % 100;
  return v_bucket < floor(f.rollout_percent);
end;
$function$;

revoke all on function public.feature_flag_enabled(text, uuid) from public, anon, authenticated;
grant execute on function public.feature_flag_enabled(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Supersession: a delete job must also retire older pending jobs, and equal
--    versions with different hashes must supersede too.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_memory_job(
  p_user_id uuid,
  p_job_type text,
  p_source_type text,
  p_source_id uuid,
  p_source_version bigint,
  p_content_hash text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_key text;
  v_id uuid;
begin
  v_key := p_job_type || ':' || p_source_type || ':' || p_source_id::text || ':' ||
           coalesce(p_source_version::text, '0') || ':' || coalesce(p_content_hash, 'none');

  insert into public.memory_jobs (
    user_id, job_type, source_type, source_id, source_version, content_hash, idempotency_key
  ) values (
    p_user_id, p_job_type, p_source_type, p_source_id, p_source_version, p_content_hash, v_key
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.memory_jobs
    where user_id = p_user_id and idempotency_key = v_key;
  end if;

  -- Older pending jobs for the same source are obsolete once a newer revision
  -- arrives. Deletes carry no version, so they supersede unconditionally.
  update public.memory_jobs set status = 'stale', updated_at = now()
  where user_id = p_user_id
    and source_type = p_source_type
    and source_id = p_source_id
    and status = 'pending'
    and id <> v_id
    and (
      p_job_type = 'delete'
      or coalesce(source_version, 0) < coalesce(p_source_version, 0)
    );

  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Enqueue trigger gated on the memory_v2 flag. While the flag is off no jobs
--    are created and the indexer cron becomes a no-op (zero embedding spend).
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_memory_index_job()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_source_type text;
  v_content text;
  v_user_id uuid;
  v_version bigint;
  v_flag_user uuid;
begin
  if tg_table_name = 'tasks' then
    v_source_type := 'task';
  elsif tg_table_name = 'notes' then
    v_source_type := 'note';
  elsif tg_table_name = 'projects' then
    v_source_type := 'project';
  else
    return coalesce(new, old);
  end if;

  v_flag_user := coalesce(new.user_id, old.user_id);
  if not public.feature_flag_enabled('memory_v2', v_flag_user) then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    perform public.enqueue_memory_job(old.user_id, 'delete', v_source_type, old.id, null, null);
    return old;
  end if;

  v_user_id := new.user_id;
  v_version := coalesce(new.version, 1);
  if tg_table_name = 'tasks' then
    v_content := coalesce(new.title, '') || ' ' || coalesce(new.description, '');
  elsif tg_table_name = 'notes' then
    v_content := coalesce(new.title, '') || ' ' || coalesce(new.content, '');
  else
    v_content := coalesce(new.title, '') || ' ' || coalesce(new.description, '');
  end if;

  if btrim(v_content) = '' then
    -- Nothing worth indexing; drop any existing document instead of embedding blanks.
    perform public.enqueue_memory_job(v_user_id, 'delete', v_source_type, new.id, null, null);
    return new;
  end if;

  perform public.enqueue_memory_job(
    v_user_id,
    case when tg_op = 'INSERT' then 'index' else 'reindex' end,
    v_source_type, new.id, v_version, md5(v_content)
  );
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Lease expiry counts as an attempt; a job that keeps dying to timeouts
--    eventually goes dead instead of cycling forever.
-- ---------------------------------------------------------------------------
create or replace function public.claim_memory_jobs(
  p_lease_owner text,
  p_batch_size integer default 10,
  p_lease_seconds integer default 120
)
returns setof public.memory_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if btrim(coalesce(p_lease_owner, '')) = '' then raise exception 'invalid_lease_owner'; end if;
  if p_batch_size < 1 or p_batch_size > 100 then raise exception 'invalid_batch_size'; end if;

  update public.memory_jobs set
    status = case when attempt_count + 1 >= 10 then 'dead' else 'pending' end,
    attempt_count = attempt_count + 1,
    error_code = case when attempt_count + 1 >= 10
      then coalesce(error_code, 'lease_expired_max') else error_code end,
    lease_owner = null,
    lease_expires_at = null,
    updated_at = now()
  where status = 'leased' and lease_expires_at <= now();

  return query
  with claimable as (
    select id from public.memory_jobs
    where status in ('pending', 'failed') and next_attempt_at <= now()
    order by created_at
    limit p_batch_size
    for update skip locked
  )
  update public.memory_jobs j set
    status = 'leased',
    lease_owner = p_lease_owner,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = j.attempt_count + 1,
    updated_at = now()
  from claimable c
  where j.id = c.id
  returning j.*;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Document upsert idempotent on content hash. A higher source_version caused
--    by a non-textual field change (status/tags/completion) must never discard a
--    pending text index; only an identical (hash, chunker, model) triple no-ops.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_memory_document(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_source_version bigint,
  p_content_hash text,
  p_title text,
  p_normalized_text text,
  p_metadata jsonb,
  p_embedding_model text,
  p_chunker_version text,
  p_chunks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_document public.memory_documents%rowtype;
  v_chunk jsonb;
  v_written integer := 0;
begin
  if jsonb_typeof(coalesce(p_chunks, 'null'::jsonb)) <> 'array' then raise exception 'invalid_chunks'; end if;

  select * into v_document from public.memory_documents
  where user_id = p_user_id and source_type = p_source_type and source_id = p_source_id
  for update;

  if found
     and v_document.content_hash = p_content_hash
     and v_document.chunker_version = p_chunker_version
     and v_document.embedding_model = p_embedding_model then
    return jsonb_build_object('status', 'stale', 'documentId', v_document.id);
  end if;

  insert into public.memory_documents (
    user_id, source_type, source_id, source_version, content_hash, title, normalized_text,
    metadata, embedding_model, embedding_dimensions, chunker_version, status, indexed_at
  ) values (
    p_user_id, p_source_type, p_source_id, p_source_version, p_content_hash, p_title, p_normalized_text,
    coalesce(p_metadata, '{}'::jsonb), p_embedding_model, 768, p_chunker_version, 'indexed', now()
  )
  on conflict (user_id, source_type, source_id) do update set
    source_version = excluded.source_version,
    content_hash = excluded.content_hash,
    title = excluded.title,
    normalized_text = excluded.normalized_text,
    metadata = excluded.metadata,
    embedding_model = excluded.embedding_model,
    chunker_version = excluded.chunker_version,
    status = 'indexed',
    error_code = null,
    indexed_at = now(),
    updated_at = now()
  returning * into v_document;

  delete from public.memory_chunks where document_id = v_document.id;

  for v_chunk in select * from jsonb_array_elements(p_chunks) loop
    insert into public.memory_chunks (
      document_id, user_id, ordinal, content, content_hash, span_start, span_end,
      token_estimate, chunker_version, embedding
    ) values (
      v_document.id, p_user_id,
      (v_chunk->>'ordinal')::integer,
      v_chunk->>'content',
      v_chunk->>'contentHash',
      (v_chunk->>'spanStart')::integer,
      (v_chunk->>'spanEnd')::integer,
      nullif(v_chunk->>'tokenEstimate', '')::integer,
      p_chunker_version,
      (v_chunk->>'embedding')::vector
    );
    v_written := v_written + 1;
  end loop;

  return jsonb_build_object('status', 'indexed', 'documentId', v_document.id, 'chunks', v_written);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Indexes matching the exact expressions used by search_memory_v2.
-- ---------------------------------------------------------------------------
create index if not exists memory_chunks_lexical_gin
  on public.memory_chunks using gin (to_tsvector('simple', content));
create index if not exists memory_chunks_title_trgm_gin
  on public.memory_chunks using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 6b. search_memory_v2: also return the document's updated_at so callers can
--     apply time filters without a second query, and expose it for citations.
-- ---------------------------------------------------------------------------
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
  updated_at timestamptz,
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
      s.span_start, s.span_end, s.updated_at,
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
         updated_at, dense_rank, lexical_rank, trigram_rank, exact_rank, fusion_score, dense_similarity
  from deduped
  where per_document = 1
  order by fusion_score desc
  limit p_match_count;
$function$;

revoke all on function public.search_memory_v2(uuid, vector, text, text[], text[], timestamptz, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.search_memory_v2(uuid, vector, text, text[], text[], timestamptz, uuid[], integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. Operator-invocable backfill: enqueues reindex jobs for sources that have no
--    memory document yet. Bounded per call; call repeatedly until completed.
-- ---------------------------------------------------------------------------
create or replace function public.backfill_memory_documents(
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_limit integer;
  v_remaining integer;
  v_enqueued integer := 0;
  v_run_task uuid;
  v_run_note uuid;
  v_run_project uuid;
  r record;
begin
  v_limit := coalesce(p_limit, 500);
  if v_limit < 1 or v_limit > 5000 then raise exception 'invalid_limit'; end if;

  insert into public.memory_backfill_runs (source_type, status)
  values ('task', 'running') returning id into v_run_task;
  insert into public.memory_backfill_runs (source_type, status)
  values ('note', 'running') returning id into v_run_note;
  insert into public.memory_backfill_runs (source_type, status)
  values ('project', 'running') returning id into v_run_project;

  v_remaining := v_limit;

  for r in
    select s.id, s.user_id, coalesce(s.version, 1) as version, 'task' as source_type,
           md5(coalesce(s.title, '') || ' ' || coalesce(s.description, '')) as hash
    from public.tasks s
    left join public.memory_documents d
      on d.source_type = 'task' and d.source_id = s.id
    where d.id is null
      and btrim(coalesce(s.title, '') || ' ' || coalesce(s.description, '')) <> ''
    order by s.created_at
    limit v_limit
  loop
    perform public.enqueue_memory_job(r.user_id, 'reindex', r.source_type, r.id, r.version, r.hash);
    v_enqueued := v_enqueued + 1;
    v_remaining := v_remaining - 1;
  end loop;
  update public.memory_backfill_runs set enqueued_count = v_enqueued, status = 'completed', finished_at = now()
  where id = v_run_task;

  if v_remaining > 0 then
    for r in
      select s.id, s.user_id, coalesce(s.version, 1) as version, 'note' as source_type,
             md5(coalesce(s.title, '') || ' ' || coalesce(s.content, '')) as hash
      from public.notes s
      left join public.memory_documents d
        on d.source_type = 'note' and d.source_id = s.id
      where d.id is null
        and btrim(coalesce(s.title, '') || ' ' || coalesce(s.content, '')) <> ''
      order by s.created_at
      limit v_remaining
    loop
      perform public.enqueue_memory_job(r.user_id, 'reindex', r.source_type, r.id, r.version, r.hash);
      v_enqueued := v_enqueued + 1;
      v_remaining := v_remaining - 1;
    end loop;
  end if;
  update public.memory_backfill_runs set enqueued_count = v_enqueued, status = 'completed', finished_at = now()
  where id = v_run_note;

  if v_remaining > 0 then
    for r in
      select s.id, s.user_id, coalesce(s.version, 1) as version, 'project' as source_type,
             md5(coalesce(s.title, '') || ' ' || coalesce(s.description, '')) as hash
      from public.projects s
      left join public.memory_documents d
        on d.source_type = 'project' and d.source_id = s.id
      where d.id is null
        and btrim(coalesce(s.title, '') || ' ' || coalesce(s.description, '')) <> ''
      order by s.created_at
      limit v_remaining
    loop
      perform public.enqueue_memory_job(r.user_id, 'reindex', r.source_type, r.id, r.version, r.hash);
      v_enqueued := v_enqueued + 1;
    end loop;
  end if;
  update public.memory_backfill_runs set enqueued_count = v_enqueued, status = 'completed', finished_at = now()
  where id = v_run_project;

  return jsonb_build_object('enqueued', v_enqueued, 'limit', v_limit);
end;
$function$;

revoke all on function public.backfill_memory_documents(integer) from public, anon, authenticated;
grant execute on function public.backfill_memory_documents(integer) to service_role;

-- Re-grant the recreated functions (create or replace drops nothing, but keep the
-- original hardening grants explicit and correct).
revoke all on function public.enqueue_memory_job(uuid, text, text, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.claim_memory_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.upsert_memory_document(uuid, text, uuid, bigint, text, text, text, jsonb, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_memory_job(uuid, text, text, uuid, bigint, text) to service_role;
grant execute on function public.claim_memory_jobs(text, integer, integer) to service_role;
grant execute on function public.upsert_memory_document(uuid, text, uuid, bigint, text, text, text, jsonb, text, text, jsonb) to service_role;

commit;
