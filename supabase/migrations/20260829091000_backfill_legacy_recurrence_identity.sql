begin;

-- Legacy browser-spawned occurrences predate the server occurrence identity. Fill
-- only complete, collision-free series data; the preflight release query verifies
-- every legacy row has a due date and a unique Tehran wall-clock occurrence key.
with ranked as (
  select
    id,
    to_char(due_date at time zone 'Asia/Tehran', 'YYYY-MM-DD:HH24:MI:SS') as occurrence_key,
    row_number() over (
      partition by user_id, recurrence_series_id
      order by due_date, created_at, id
    ) - 1 as occurrence_sequence
  from public.tasks
  where recurrence_series_id is not null
    and recurrence_occurrence_key is null
    and due_date is not null
)
update public.tasks task
set recurrence_occurrence_key = ranked.occurrence_key,
    recurrence_sequence = ranked.occurrence_sequence,
    recurrence_calculator_version = coalesce(task.recurrence_calculator_version, 'tehran-jalali-v1'),
    recurrence_rule_version = coalesce(task.recurrence_rule_version, 1),
    updated_at = now()
from ranked
where task.id = ranked.id;

commit;
