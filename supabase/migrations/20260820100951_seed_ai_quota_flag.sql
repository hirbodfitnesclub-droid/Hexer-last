begin;

insert into public.feature_flags (key, description, stage, enabled, rollout_percent, rollout_salt)
values (
  'ai_quota_reservations',
  'Reservation/finalization quota lifecycle and actual provider telemetry',
  'off',
  false,
  0,
  'ai-quota-v1'
)
on conflict (key) do nothing;

commit;
