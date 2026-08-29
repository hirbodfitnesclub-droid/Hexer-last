begin;

-- These control-plane tables are intentionally service-only. Explicit policies
-- document that boundary for database linting while browser grants remain revoked.
create policy "service manages feature flags" on public.feature_flags
  for all to service_role using (true) with check (true);
create policy "service manages feature overrides" on public.feature_flag_overrides
  for all to service_role using (true) with check (true);
create policy "service records feature exposures" on public.feature_flag_exposures
  for all to service_role using (true) with check (true);
create policy "service manages deprecations" on public.deprecation_registry
  for all to service_role using (true) with check (true);

commit;
