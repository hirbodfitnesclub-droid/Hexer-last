# Recurrence V3 Release Evidence

## Scope

- Atomic recurring completion and successor creation.
- Version-aware compound Undo for AI-created successors.
- Terminal occurrence completion without a successor.
- Legacy recurrence identity backfill.
- Realtime publication membership for subscribed entities.

## Production migrations

- `20260829090000_recurring_completion_v3_compound_undo`
- `20260829091000_backfill_legacy_recurrence_identity`
- `20260829092000_realtime_publication_membership`
- `20260829093000_recurrence_v3_compensated_replay_result`

## Verified production invariants

- `complete_recurring_task_v3` is `SECURITY DEFINER` and executable only by `service_role`.
- Legacy recurring tasks without an occurrence key: `0` after backfill.
- Duplicate `(user_id, recurrence_series_id, recurrence_occurrence_key)` rows: `0` after backfill.
- `tasks`, `notes`, `projects`, `habits`, and `reminders` belong to `supabase_realtime`.
- `supabase db push --dry-run` reports the remote database is up to date.

## Rollback-only production checks

The following executed inside explicit transactions followed by `ROLLBACK`; no test
rows, receipts, operations, or provider requests persisted:

- Nonterminal v3 completion creates exactly one successor and AI receipt; Undo restores
  the current row and deletes that exact successor.
- Terminal completion returns `next = null`; Undo restores the current occurrence.
- Replaying a completed operation returns the same receipt and successor.
- Replaying a completion after successful Undo returns `operation_compensated`, not a
  stale completed-task response.

## Local bootstrap limitation

WSL2 and a Docker daemon are available, but the WSL environment could not resolve the
container registry or GitHub during this release. The local Supabase clean-reset lane
therefore could not download its missing images. The checked-in `prepare-local-supabase`
script remains the reproducible no-cost bootstrap path: it creates an ignored temporary
workspace, injects the local-only baseline, disables seeds, and rewrites worker URLs away
from production. Production rollback-only transaction checks were used as the runtime
database gate for this release.
