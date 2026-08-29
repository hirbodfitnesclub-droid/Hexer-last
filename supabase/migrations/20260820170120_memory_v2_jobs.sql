begin;

-- Memory V2 job queue and retrieval. Nothing here changes behaviour until memory_v2
-- is enabled: triggers only enqueue jobs, and `search_memory_v2` is a new function
-- that no deployed code calls yet. The legacy per-entity embeddings and hybrid_search
-- remain the live retrieval path.

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
  -- The key includes the revision, so editing a row supersedes its pending job
  -- instead of racing with it.
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

  -- Older pending jobs for the same source are obsolete once a newer revision arrives.
  update public.memory_jobs set status = 'stale', updated_at = now()
  where user_id = p_user_id
    and source_type = p_source_type
    and source_id = p_source_id
    and status = 'pending'
    and id <> v_id
    and coalesce(source_version, 0) < coalesce(p_source_version, 0);

  return v_id;
end;
$function$;

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

  update public.memory_jobs set status = 'pending', lease_owner = null, lease_expires_at = null, updated_at = now()
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

create or replace function public.finalize_memory_job(
  p_job_id uuid,
  p_status text,
  p_error_code text default null,
  p_max_attempts integer default 5
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_job public.memory_jobs%rowtype;
  v_state text;
begin
  select * into v_job from public.memory_jobs where id = p_job_id for update;
  if not found then raise exception 'memory_job_not_found'; end if;

  if p_status = 'succeeded' then v_state := 'succeeded';
  elsif p_status = 'stale' then v_state := 'stale';
  elsif v_job.attempt_count >= p_max_attempts then v_state := 'dead';
  else v_state := 'failed';
  end if;

  update public.memory_jobs set
    status = v_state,
    error_code = coalesce(p_error_code, error_code),
    lease_owner = null,
    lease_expires_at = null,
    next_attempt_at = case when v_state = 'failed'
      then now() + make_interval(secs => least(1800, power(2, greatest(v_job.attempt_count, 1))::integer * 30))
      else next_attempt_at end,
    updated_at = now()
  where id = p_job_id;

  return v_state;
end;
$function$;

/**
 * Writes a document and its chunks in one transaction, but only if the source has not
 * moved on. A slow embedding for revision N is discarded once revision N+1 exists.
 */
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

  if found and v_document.source_version > p_source_version then
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

create or replace function public.delete_memory_document(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_deleted integer;
begin
  with removed as (
    delete from public.memory_documents
    where user_id = p_user_id and source_type = p_source_type and source_id = p_source_id
    returning id
  ) select count(*) into v_deleted from removed;
  return v_deleted;
end;
$function$;

revoke all on function public.enqueue_memory_job(uuid, text, text, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.claim_memory_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_memory_job(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.upsert_memory_document(uuid, text, uuid, bigint, text, text, text, jsonb, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.delete_memory_document(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_memory_job(uuid, text, text, uuid, bigint, text) to service_role;
grant execute on function public.claim_memory_jobs(text, integer, integer) to service_role;
grant execute on function public.finalize_memory_job(uuid, text, text, integer) to service_role;
grant execute on function public.upsert_memory_document(uuid, text, uuid, bigint, text, text, text, jsonb, text, text, jsonb) to service_role;
grant execute on function public.delete_memory_document(uuid, text, uuid) to service_role;

commit;
