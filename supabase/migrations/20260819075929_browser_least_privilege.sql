begin;

alter function public.hexer_fa_normalize(text)
  set search_path = pg_catalog, public;
alter function public.immutable_array_to_string(text[], text)
  set search_path = pg_catalog, public;

-- Browser roles must never own DDL-adjacent table privileges. RLS does not
-- protect TRUNCATE, REFERENCES, or TRIGGER operations.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Anonymous access is not used by this authenticated application.
revoke all privileges on all tables in schema public from anon;

-- Service-managed and read-only account data are not writable from browsers.
revoke insert, update, delete on table
  public.ai_requests_log,
  public.usage_counters,
  public.subscriptions,
  public.payments,
  public.plans,
  public.push_dispatch_log,
  public.telegram_settings,
  public.admin_audit_log,
  public.sms_hook_deliveries
from authenticated;

-- These are service-only internals and should not be enumerable by users.
revoke select on table
  public.ai_requests_log,
  public.push_dispatch_log,
  public.telegram_settings,
  public.admin_audit_log,
  public.sms_hook_deliveries
from authenticated;

-- Users need only their own subscription/payment/usage reads through RLS.
grant select on table
  public.usage_counters,
  public.subscriptions,
  public.payments
  to authenticated;

notify pgrst, 'reload schema';
commit;
