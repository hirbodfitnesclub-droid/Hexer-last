begin;

insert into public.feature_flags (key, description, stage, enabled, rollout_percent, rollout_salt)
values (
  'operation_primitives_v1',
  'Versioned idempotent mutation operation ledger',
  'off',
  false,
  0,
  'operation-v1'
)
on conflict (key) do nothing;

commit;
