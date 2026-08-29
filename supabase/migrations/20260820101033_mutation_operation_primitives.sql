begin;

alter table public.projects add column if not exists version bigint not null default 1 check (version > 0);
alter table public.tasks add column if not exists version bigint not null default 1 check (version > 0);
alter table public.notes add column if not exists version bigint not null default 1 check (version > 0);
alter table public.habits add column if not exists version bigint not null default 1 check (version > 0);
alter table public.reminders add column if not exists version bigint not null default 1 check (version > 0);

create or replace function public.bump_entity_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  if new is distinct from old then
    new.version := old.version + 1;
  end if;
  return new;
end;
$function$;

revoke all on function public.bump_entity_version() from public, anon, authenticated;
grant execute on function public.bump_entity_version() to service_role;

create or replace trigger projects_bump_version before update on public.projects
  for each row execute function public.bump_entity_version();
create or replace trigger tasks_bump_version before update on public.tasks
  for each row execute function public.bump_entity_version();
create or replace trigger notes_bump_version before update on public.notes
  for each row execute function public.bump_entity_version();
create or replace trigger habits_bump_version before update on public.habits
  for each row execute function public.bump_entity_version();
create or replace trigger reminders_bump_version before update on public.reminders
  for each row execute function public.bump_entity_version();

create table if not exists public.mutation_operations (
  op_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  idempotency_key text not null,
  entity_type text not null check (entity_type in ('task', 'note', 'project', 'habit', 'reminder', 'link', 'habit_completion', 'recurrence', 'automation', 'calendar')),
  entity_id uuid,
  expected_version bigint check (expected_version is null or expected_version > 0),
  applied_version bigint check (applied_version is null or applied_version > 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'blocked', 'conflict', 'compensated')),
  request_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(request_payload) = 'object'),
  result jsonb,
  error_code text,
  error_detail jsonb,
  started_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (result is null or jsonb_typeof(result) in ('object', 'array')),
  check (error_detail is null or jsonb_typeof(error_detail) = 'object')
);

create table if not exists public.operation_dependencies (
  operation_id uuid not null references public.mutation_operations(op_id) on delete cascade,
  depends_on_operation_id uuid not null references public.mutation_operations(op_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (operation_id, depends_on_operation_id),
  check (operation_id <> depends_on_operation_id)
);

create index if not exists mutation_operations_user_created_idx
  on public.mutation_operations (user_id, created_at desc);
create index if not exists mutation_operations_pending_idx
  on public.mutation_operations (status, created_at)
  where status in ('pending', 'processing', 'blocked');
create index if not exists mutation_operations_entity_idx
  on public.mutation_operations (user_id, entity_type, entity_id, created_at desc)
  where entity_id is not null;
create index if not exists operation_dependencies_parent_idx
  on public.operation_dependencies (depends_on_operation_id, operation_id);

alter table public.mutation_operations enable row level security;
alter table public.operation_dependencies enable row level security;
revoke all on public.mutation_operations from public, anon, authenticated;
revoke all on public.operation_dependencies from public, anon, authenticated;
grant all on public.mutation_operations to service_role;
grant all on public.operation_dependencies to service_role;
create policy "service manages mutation operations" on public.mutation_operations
  for all to service_role using (true) with check (true);
create policy "service manages operation dependencies" on public.operation_dependencies
  for all to service_role using (true) with check (true);

alter table public.agent_action_receipts
  add column if not exists operation_id uuid references public.mutation_operations(op_id) on delete set null,
  add column if not exists entity_version_before bigint,
  add column if not exists entity_version_after bigint;

alter table public.agent_action_receipts
  drop constraint if exists agent_action_receipts_version_order_check,
  add constraint agent_action_receipts_version_order_check check (
    entity_version_before is null or entity_version_after is null or entity_version_after >= entity_version_before
  );
create index if not exists agent_action_receipts_operation_idx
  on public.agent_action_receipts (operation_id)
  where operation_id is not null;

create or replace function public.claim_mutation_operation(
  p_op_id uuid,
  p_user_id uuid,
  p_operation_type text,
  p_idempotency_key text,
  p_entity_type text,
  p_entity_id uuid,
  p_expected_version bigint,
  p_dependencies uuid[] default '{}'::uuid[],
  p_request_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_operation public.mutation_operations%rowtype;
  v_blocked_count integer;
begin
  if p_op_id is null or p_user_id is null or p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'invalid_operation_request';
  end if;
  if jsonb_typeof(coalesce(p_request_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_operation_payload';
  end if;

  select * into v_operation from public.mutation_operations
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_operation.operation_type <> p_operation_type
      or v_operation.entity_type <> p_entity_type
      or v_operation.entity_id is distinct from p_entity_id
      or v_operation.expected_version is distinct from p_expected_version
      or v_operation.request_payload <> coalesce(p_request_payload, '{}'::jsonb)
      or array(
        select depends_on_operation_id from public.operation_dependencies
        where operation_id = v_operation.op_id order by depends_on_operation_id
      ) <> array(
        select dependency_id from unnest(coalesce(p_dependencies, '{}'::uuid[])) dependency_id
        order by dependency_id
      ) then
      return jsonb_build_object('claimed', false, 'status', 'conflict', 'errorCode', 'idempotency_payload_mismatch');
    end if;

    if v_operation.status = 'blocked' then
      select count(*) into v_blocked_count
      from public.operation_dependencies d
      join public.mutation_operations parent on parent.op_id = d.depends_on_operation_id
      where d.operation_id = v_operation.op_id and parent.status <> 'succeeded';
      if v_blocked_count = 0 then
        update public.mutation_operations set status = 'processing', started_at = now(), updated_at = now()
        where op_id = v_operation.op_id returning * into v_operation;
        return jsonb_build_object('claimed', true, 'status', 'processing', 'operationId', v_operation.op_id);
      end if;
    end if;

    return jsonb_build_object(
      'claimed', false, 'status', v_operation.status, 'operationId', v_operation.op_id,
      'result', v_operation.result, 'errorCode', v_operation.error_code
    );
  end if;

  insert into public.mutation_operations (
    op_id, user_id, operation_type, idempotency_key, entity_type, entity_id,
    expected_version, status, request_payload
  ) values (
    p_op_id, p_user_id, p_operation_type, p_idempotency_key, p_entity_type, p_entity_id,
    p_expected_version, 'pending', coalesce(p_request_payload, '{}'::jsonb)
  ) returning * into v_operation;

  if exists (
    select 1 from unnest(coalesce(p_dependencies, '{}'::uuid[])) dependency_id
    left join public.mutation_operations parent
      on parent.op_id = dependency_id and parent.user_id = p_user_id
    where parent.op_id is null or dependency_id = p_op_id
  ) then
    raise exception 'invalid_operation_dependency';
  end if;

  insert into public.operation_dependencies (operation_id, depends_on_operation_id)
  select p_op_id, dependency_id
  from unnest(coalesce(p_dependencies, '{}'::uuid[])) dependency_id
  on conflict do nothing;

  select count(*) into v_blocked_count
  from public.operation_dependencies d
  join public.mutation_operations parent on parent.op_id = d.depends_on_operation_id
  where d.operation_id = p_op_id and parent.status <> 'succeeded';

  update public.mutation_operations
  set status = case when v_blocked_count > 0 then 'blocked' else 'processing' end,
      started_at = case when v_blocked_count = 0 then now() else null end,
      updated_at = now()
  where op_id = p_op_id returning * into v_operation;

  return jsonb_build_object('claimed', v_operation.status = 'processing', 'status', v_operation.status, 'operationId', v_operation.op_id);
end;
$function$;

create or replace function public.finalize_mutation_operation(
  p_op_id uuid,
  p_user_id uuid,
  p_status text,
  p_applied_version bigint,
  p_result jsonb,
  p_error_code text default null,
  p_error_detail jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_status not in ('succeeded', 'failed', 'conflict', 'compensated') then return false; end if;
  update public.mutation_operations set
    status = p_status,
    applied_version = p_applied_version,
    result = p_result,
    error_code = p_error_code,
    error_detail = p_error_detail,
    finalized_at = now(),
    updated_at = now()
  where op_id = p_op_id and user_id = p_user_id and status = 'processing';
  return found;
end;
$function$;

revoke all on function public.claim_mutation_operation(uuid, uuid, text, text, text, uuid, bigint, uuid[], jsonb) from public, anon, authenticated;
revoke all on function public.finalize_mutation_operation(uuid, uuid, text, bigint, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_mutation_operation(uuid, uuid, text, text, text, uuid, bigint, uuid[], jsonb) to service_role;
grant execute on function public.finalize_mutation_operation(uuid, uuid, text, bigint, jsonb, text, jsonb) to service_role;

commit;
