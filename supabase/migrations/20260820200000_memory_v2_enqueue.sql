begin;

-- Memory V2 enqueue. The trigger only writes a job row inside the same transaction as
-- the user's edit: no network call, so a slow or failing embedding can never delay or
-- roll back a save. The existing `enqueue_vectorize` trigger keeps running in parallel,
-- because the legacy per-entity embeddings stay authoritative until backfill completes.

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

  -- md5 of the raw content is enough to detect "did the text actually change";
  -- the worker recomputes the normalized hash it stores.
  perform public.enqueue_memory_job(
    v_user_id,
    case when tg_op = 'INSERT' then 'index' else 'reindex' end,
    v_source_type, new.id, v_version, md5(v_content)
  );
  return new;
end;
$function$;

revoke all on function public.enqueue_memory_index_job() from public, anon, authenticated;

create or replace trigger memory_index_tasks
  after insert or update of title, description or delete on public.tasks
  for each row execute function public.enqueue_memory_index_job();

create or replace trigger memory_index_notes
  after insert or update of title, content or delete on public.notes
  for each row execute function public.enqueue_memory_index_job();

create or replace trigger memory_index_projects
  after insert or update of title, description or delete on public.projects
  for each row execute function public.enqueue_memory_index_job();

/**
 * Resumable backfill. Walks one source type in created_at order, enqueues jobs for rows
 * that have no indexed document yet, and returns the cursor to continue from.
 */
create or replace function public.backfill_memory_documents(
  p_source_type text,
  p_batch_size integer default 100,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_enqueued integer := 0;
  v_last_created timestamptz;
  v_last_id uuid;
  v_row record;
begin
  if p_source_type not in ('task', 'note', 'project') then raise exception 'invalid_source_type'; end if;
  if p_batch_size < 1 or p_batch_size > 500 then raise exception 'invalid_batch_size'; end if;

  for v_row in
    execute format($sql$
      select t.id, t.user_id, t.created_at, coalesce(t.version, 1) as version,
             coalesce(t.title, '') || ' ' || coalesce(t.%I, '') as content
      from public.%I t
      left join public.memory_documents d
        on d.user_id = t.user_id and d.source_type = %L and d.source_id = t.id
      where d.id is null
        and ($1 is null or (t.created_at, t.id) > ($1, $2))
      order by t.created_at, t.id
      limit $3
    $sql$,
      case p_source_type when 'note' then 'content' else 'description' end,
      case p_source_type when 'task' then 'tasks' when 'note' then 'notes' else 'projects' end,
      p_source_type)
    using p_after_created_at, coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid), p_batch_size
  loop
    v_last_created := v_row.created_at;
    v_last_id := v_row.id;
    if btrim(v_row.content) <> '' then
      perform public.enqueue_memory_job(
        v_row.user_id, 'index', p_source_type, v_row.id, v_row.version, md5(v_row.content)
      );
      v_enqueued := v_enqueued + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'sourceType', p_source_type,
    'enqueued', v_enqueued,
    'cursorCreatedAt', v_last_created,
    'cursorId', v_last_id,
    'done', v_last_id is null
  );
end;
$function$;

revoke all on function public.backfill_memory_documents(text, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.backfill_memory_documents(text, integer, timestamptz, uuid) to service_role;

commit;
