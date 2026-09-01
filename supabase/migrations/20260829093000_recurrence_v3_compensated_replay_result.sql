begin;

-- Keep the operation audit status as compensated, but replace its replay payload so
-- a retried pre-Undo completion cannot rehydrate stale done/next rows in a client.
create or replace function public.rewrite_compensated_recurrence_replay()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.status = 'compensated'
    and old.status = 'succeeded'
    and new.operation_type = 'complete_recurring_task_v3' then
    new.result := jsonb_build_object(
      'status', 'failed',
      'operationId', new.op_id,
      'errorCode', 'operation_compensated'
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists rewrite_compensated_recurrence_replay on public.mutation_operations;
create trigger rewrite_compensated_recurrence_replay
before update on public.mutation_operations
for each row execute function public.rewrite_compensated_recurrence_replay();

revoke all on function public.rewrite_compensated_recurrence_replay() from public, anon, authenticated;

commit;
