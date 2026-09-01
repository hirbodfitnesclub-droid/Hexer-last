begin;

create table if not exists public.task_recurrence_series (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule jsonb not null check (jsonb_typeof(rule) = 'object'),
  timezone text not null default 'Asia/Tehran' check (timezone = 'Asia/Tehran'),
  calculator_version text not null,
  rule_version bigint not null default 1 check (rule_version > 0),
  status text not null default 'active' check (status in ('active', 'stopped')),
  anchor_due timestamptz,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.task_recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null,
  occurrence_key text not null,
  kind text not null check (kind in ('skip', 'override', 'cancel')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (series_id, user_id) references public.task_recurrence_series(id, user_id) on delete cascade,
  unique (user_id, series_id, occurrence_key, kind)
);

alter table public.tasks
  add column if not exists recurrence_occurrence_key text,
  add column if not exists recurrence_sequence integer not null default 0 check (recurrence_sequence >= 0),
  add column if not exists recurrence_status text not null default 'active'
    check (recurrence_status in ('active', 'completed', 'skipped', 'cancelled', 'overridden')),
  add column if not exists recurrence_rule_version bigint check (recurrence_rule_version is null or recurrence_rule_version > 0),
  add column if not exists recurrence_calculator_version text;

create unique index if not exists tasks_recurrence_occurrence_unique
  on public.tasks (user_id, recurrence_series_id, recurrence_occurrence_key)
  where recurrence_series_id is not null and recurrence_occurrence_key is not null;
create index if not exists recurrence_series_user_status_idx
  on public.task_recurrence_series (user_id, status, updated_at desc);
create index if not exists recurrence_exceptions_series_idx
  on public.task_recurrence_exceptions (user_id, series_id, created_at desc);

alter table public.task_recurrence_series enable row level security;
alter table public.task_recurrence_exceptions enable row level security;
revoke all on public.task_recurrence_series from public, anon, authenticated;
revoke all on public.task_recurrence_exceptions from public, anon, authenticated;
grant all on public.task_recurrence_series to service_role;
grant all on public.task_recurrence_exceptions to service_role;
create policy "service manages recurrence series" on public.task_recurrence_series
  for all to service_role using (true) with check (true);
create policy "service manages recurrence exceptions" on public.task_recurrence_exceptions
  for all to service_role using (true) with check (true);

insert into public.task_recurrence_series (
  id, user_id, rule, calculator_version, rule_version, status, anchor_due
)
select distinct on (t.user_id, t.recurrence_series_id)
  t.recurrence_series_id,
  t.user_id,
  t.recurrence,
  'legacy-client-v1',
  1,
  'active',
  t.due_date
from public.tasks t
where t.recurrence_series_id is not null
  and t.recurrence is not null
  and jsonb_typeof(t.recurrence) = 'object'
order by t.user_id, t.recurrence_series_id, t.created_at desc
on conflict (id) do nothing;

create or replace function public.complete_recurring_task_v2(
  p_user_id uuid,
  p_task_id uuid,
  p_expected_version bigint,
  p_op_id uuid,
  p_idempotency_key text,
  p_next_due timestamptz,
  p_next_recurrence jsonb,
  p_occurrence_key text,
  p_calculator_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task public.tasks%rowtype;
  v_series public.task_recurrence_series%rowtype;
  v_next public.tasks%rowtype;
  v_claim jsonb;
  v_expected_key text;
  v_next_id uuid := gen_random_uuid();
begin
  if p_user_id is null or p_task_id is null or p_op_id is null then
    raise exception 'invalid_recurrence_request';
  end if;
  if p_calculator_version <> 'tehran-jalali-v1' then
    raise exception 'unsupported_recurrence_calculator';
  end if;
  if p_next_due is null or p_next_recurrence is null or jsonb_typeof(p_next_recurrence) <> 'object' then
    raise exception 'invalid_next_occurrence';
  end if;
  v_expected_key := to_char(p_next_due at time zone 'Asia/Tehran', 'YYYY-MM-DD:HH24:MI:SS');
  if p_occurrence_key is distinct from v_expected_key then
    raise exception 'invalid_occurrence_key';
  end if;

  v_claim := public.claim_mutation_operation(
    p_op_id, p_user_id, 'complete_recurring_task', p_idempotency_key,
    'recurrence', p_task_id, p_expected_version, '{}'::uuid[],
    jsonb_build_object(
      'taskId', p_task_id, 'nextDue', p_next_due, 'nextRecurrence', p_next_recurrence,
      'occurrenceKey', p_occurrence_key, 'calculatorVersion', p_calculator_version
    )
  );
  if coalesce((v_claim->>'claimed')::boolean, false) = false then
    return v_claim;
  end if;

  select * into v_task from public.tasks
  where id = p_task_id and user_id = p_user_id for update;
  if not found then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', null, null, 'not_found', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_found', 'operationId', p_op_id);
  end if;
  if v_task.version is distinct from p_expected_version then
    perform public.finalize_mutation_operation(
      p_op_id, p_user_id, 'conflict', v_task.version, null, 'version_conflict',
      jsonb_build_object('expectedVersion', p_expected_version, 'serverVersion', v_task.version, 'server', to_jsonb(v_task))
    );
    return jsonb_build_object('status', 'conflict', 'errorCode', 'version_conflict', 'operationId', p_op_id, 'server', to_jsonb(v_task));
  end if;
  if v_task.status = 'done' then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'already_applied', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'already_applied', 'operationId', p_op_id);
  end if;
  if v_task.recurrence is null then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'not_recurring', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'not_recurring', 'operationId', p_op_id);
  end if;
  if v_task.due_date is not null and p_next_due <= v_task.due_date then
    raise exception 'next_occurrence_not_later';
  end if;

  if v_task.recurrence_series_id is null then
    v_task.recurrence_series_id := gen_random_uuid();
  end if;

  select * into v_series from public.task_recurrence_series
  where id = v_task.recurrence_series_id for update;
  if found and v_series.user_id <> p_user_id then
    raise exception 'recurrence_series_owner_mismatch';
  end if;

  insert into public.task_recurrence_series (
    id, user_id, rule, calculator_version, rule_version, status, anchor_due
  ) values (
    v_task.recurrence_series_id, p_user_id, v_task.recurrence,
    p_calculator_version, coalesce(v_task.recurrence_rule_version, 1), 'active', v_task.due_date
  )
  on conflict (id) do update set
    rule = excluded.rule,
    calculator_version = excluded.calculator_version,
    updated_at = now()
  where task_recurrence_series.user_id = excluded.user_id
  returning * into v_series;

  if v_series.id is null then raise exception 'recurrence_series_owner_mismatch'; end if;
  if v_series.status <> 'active' then
    perform public.finalize_mutation_operation(p_op_id, p_user_id, 'failed', v_task.version, null, 'series_stopped', '{}'::jsonb);
    return jsonb_build_object('status', 'failed', 'errorCode', 'series_stopped', 'operationId', p_op_id);
  end if;

  update public.tasks set
    status = 'done', completed_at = now(),
    recurrence_series_id = v_series.id,
    recurrence_status = 'completed',
    recurrence_rule_version = v_series.rule_version,
    recurrence_calculator_version = p_calculator_version
  where id = v_task.id and user_id = p_user_id;

  insert into public.tasks (
    id, user_id, project_id, title, description, status, priority, due_date, completed_at,
    tags, checklist, recurrence, recurrence_series_id, recurrence_occurrence_key,
    recurrence_sequence, recurrence_status, recurrence_rule_version,
    recurrence_calculator_version, created_at, updated_at
  ) values (
    v_next_id, p_user_id, v_task.project_id, v_task.title, v_task.description, 'todo',
    v_task.priority, p_next_due, null, v_task.tags,
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', gen_random_uuid(), 'text', item->>'text', 'isCompleted', false
    )) from jsonb_array_elements(case when jsonb_typeof(v_task.checklist) = 'array' then v_task.checklist else '[]'::jsonb end) item), '[]'::jsonb),
    p_next_recurrence, v_series.id, p_occurrence_key,
    coalesce(v_task.recurrence_sequence, 0) + 1, 'active', v_series.rule_version,
    p_calculator_version, now(), now()
  )
  on conflict (user_id, recurrence_series_id, recurrence_occurrence_key)
    where recurrence_series_id is not null and recurrence_occurrence_key is not null
  do nothing
  returning * into v_next;

  if v_next.id is null then
    select * into v_next from public.tasks
    where user_id = p_user_id and recurrence_series_id = v_series.id
      and recurrence_occurrence_key = p_occurrence_key;
  end if;

  perform public.finalize_mutation_operation(
    p_op_id, p_user_id, 'succeeded', v_next.version,
    jsonb_build_object('current', (select to_jsonb(t) from public.tasks t where t.id = v_task.id), 'next', to_jsonb(v_next)),
    null, null
  );

  return jsonb_build_object(
    'status', 'succeeded', 'operationId', p_op_id,
    'current', (select to_jsonb(t) from public.tasks t where t.id = v_task.id),
    'next', to_jsonb(v_next)
  );
end;
$function$;

revoke all on function public.complete_recurring_task_v2(uuid, uuid, bigint, uuid, text, timestamptz, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_recurring_task_v2(uuid, uuid, bigint, uuid, text, timestamptz, jsonb, text, text)
  to service_role;

commit;
