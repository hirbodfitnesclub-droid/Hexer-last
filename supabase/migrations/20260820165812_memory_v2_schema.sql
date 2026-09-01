begin;

-- Memory V2: document and chunk storage with a job queue. Nothing reads from these
-- tables until memory_v2 is enabled; the existing per-entity `embedding` columns and
-- `hybrid_search` stay authoritative until backfill completes and the shadow
-- comparison clears, so this migration cannot change retrieval behaviour today.

create table if not exists public.memory_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('task', 'note', 'project')),
  source_id uuid not null,
  -- Version and hash of the source row this document was built from. The worker
  -- discards its result when either has moved on, so a fast edit cannot be
  -- overwritten by a slow embedding.
  source_version bigint not null check (source_version > 0),
  content_hash text not null,
  title text,
  normalized_text text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  embedding_model text not null,
  embedding_dimensions integer not null check (embedding_dimensions = 768),
  chunker_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'indexed', 'stale', 'failed', 'deleted')),
  error_code text,
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create table if not exists public.memory_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.memory_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  content text not null,
  content_hash text not null,
  -- Character offsets into the document text, so a citation can point at the exact span.
  span_start integer not null check (span_start >= 0),
  span_end integer not null check (span_end > span_start),
  token_estimate integer check (token_estimate is null or token_estimate >= 0),
  chunker_version text not null,
  embedding vector(768),
  created_at timestamptz not null default now(),
  unique (document_id, chunker_version, ordinal, content_hash)
);

create table if not exists public.memory_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (job_type in ('index', 'reindex', 'delete')),
  source_type text not null check (source_type in ('task', 'note', 'project')),
  source_id uuid not null,
  source_version bigint,
  content_hash text,
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'succeeded', 'failed', 'stale', 'dead')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One outstanding job per source revision. Re-triggering the same revision is a no-op.
  unique (user_id, idempotency_key)
);

create table if not exists public.memory_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_type text not null check (source_type in ('task', 'note', 'project')),
  cursor_created_at timestamptz,
  cursor_id uuid,
  enqueued_count integer not null default 0,
  status text not null default 'running' check (status in ('running', 'paused', 'completed', 'failed')),
  notes text
);

create index if not exists memory_documents_user_status_idx
  on public.memory_documents (user_id, status, updated_at desc);
create index if not exists memory_documents_source_idx
  on public.memory_documents (source_type, source_id);
create index if not exists memory_chunks_document_idx
  on public.memory_chunks (document_id, ordinal);
create index if not exists memory_chunks_user_idx
  on public.memory_chunks (user_id);
create index if not exists memory_jobs_claimable_idx
  on public.memory_jobs (next_attempt_at)
  where status in ('pending', 'failed');
create index if not exists memory_jobs_lease_idx
  on public.memory_jobs (lease_expires_at)
  where status = 'leased';

-- HNSW over cosine distance, matching the existing per-entity vector indexes.
create index if not exists memory_chunks_embedding_hnsw
  on public.memory_chunks using hnsw (embedding vector_cosine_ops);

alter table public.memory_documents enable row level security;
alter table public.memory_chunks enable row level security;
alter table public.memory_jobs enable row level security;
alter table public.memory_backfill_runs enable row level security;
revoke all on public.memory_documents from public, anon, authenticated;
revoke all on public.memory_chunks from public, anon, authenticated;
revoke all on public.memory_jobs from public, anon, authenticated;
revoke all on public.memory_backfill_runs from public, anon, authenticated;
grant all on public.memory_documents to service_role;
grant all on public.memory_chunks to service_role;
grant all on public.memory_jobs to service_role;
grant all on public.memory_backfill_runs to service_role;
create policy "service manages memory documents" on public.memory_documents
  for all to service_role using (true) with check (true);
create policy "service manages memory chunks" on public.memory_chunks
  for all to service_role using (true) with check (true);
create policy "service manages memory jobs" on public.memory_jobs
  for all to service_role using (true) with check (true);
create policy "service manages memory backfill runs" on public.memory_backfill_runs
  for all to service_role using (true) with check (true);

commit;
