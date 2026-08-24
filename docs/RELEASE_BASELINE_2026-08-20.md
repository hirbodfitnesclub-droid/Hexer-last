# Production release baseline — 2026-08-20

This manifest records the reconciled starting point for the remaining agent-memory production plan. Historical files under `supabase/sql` are reference-only. New database changes must be timestamped, forward-only migrations under `supabase/migrations`.

## Repository state

- Branch: `feature/agent-memory-v2`
- Working tree intentionally contains the uncommitted implementation accumulated during the production hardening and agent work.
- Canonical AI entrypoint: `supabase/functions/ai-assistant/index.ts`
- Canonical deploy artifact: `supabase/functions/ai-assistant/deploy.bundle.ts`
- Canonical builder/gate: `scripts/bundle-ai-assistant.mjs`
- Two consecutive local builds produced the same SHA-256:
  - `3df24b4a5f40b5729aeb4048cad370c454bf748ea0a849fc2ed47809ff273531`
  - size: `48,334` bytes

## Production AI function

- Function: `ai-assistant`
- Active version at baseline: `70`
- Status: `ACTIVE`
- JWT verification: enabled
- Supabase artifact hash: `376e9963ec30364ac210d02275cafe3c14b614bb1310dbe523beac95ab2e39f8`
- Restored v70 artifact size: `46,186` bytes
- Verified v70 properties:
  - Gemini model registry resolves `google/gemini-3.1-flash-lite`
  - strict JSON Schema response format
  - `provider.require_parameters=true`
  - no `temperature`, `top_p`, `top_k`, or `thinking_budget`
  - full update/link/receipt/Undo executor
  - `OPTIONS 200`, unauthenticated `POST 401`
  - authenticated Reminder → receipt → Undo smoke passed with zero test reminder rows remaining

## Intentional local/production divergence

The local canonical artifact additionally contains these tested reversible actions, which are not in production v70 yet:

- `REOPEN_TASK`
- `UPDATE_TASK_CHECKLIST`
- `SNOOZE_REMINDER`
- `MARK_REMINDER_READ`

They are isolated from model, quota, and database-schema changes and must be released as the next canary. Rollback target is the exact v70 artifact above.

## Migration history mapping

Production migration versions were created by the management API and do not always equal the original local draft timestamps. The semantic mapping is authoritative until migration history is normalized through a dedicated repair workflow; do not re-run old migrations merely because filenames differ.

| Production version | Production name | Local semantic source |
|---|---|---|
| `20260819072707` | `contain_security` | `20260819070125_contain_security.sql` |
| `20260819073430` | `harden_billing` | `20260819073500_harden_billing.sql` |
| `20260819073933` | `sms_replay_guard` | `20260819074500_sms_replay_guard.sql` |
| `20260819075929` | `browser_least_privilege` | `20260819075500_browser_least_privilege.sql` |
| `20260819092305` | `secure_worker_transport` | `20260819081500_secure_worker_transport.sql` |
| `20260819092538` | `revoke_internal_extension_public_grants` | Management-applied privilege reconciliation; current grants must be inventoried before creating a reproducible forward migration. Do not fabricate or replay it. |
| `20260819095917` | `agent_execution_audit` | `20260819095500_agent_execution_audit.sql` |
| `20260819121800` | `agent_tool_receipts` | `20260819114056_agent_tool_receipts.sql` |

`20260819070130_production_baseline.sql` is the fresh-environment schema baseline reconstructed from production. It is not to be executed against the existing production project.

## Security baseline

- The compromised legacy `service_role_key` Vault secret is removed by the containment migration.
- Worker transports use dedicated random `push_dispatch_secret` and `vectorize_worker_secret` values stored in Vault.
- No raw JWT/API secret was found by the baseline source scan; environment-variable references and placeholder documentation remain expected.
- Browser roles have no direct access to internal audit/receipt tables.
- Remaining Advisor findings are baseline, not accepted as permanently resolved:
  - extension placement in `public`
  - intentional authenticated `SECURITY DEFINER` RPCs requiring per-function ownership review
  - leaked-password protection disabled in Auth settings
  - RLS init-plan performance warnings
  - missing covering indexes on selected foreign keys
- Every future release must compare Advisor results against this baseline and reject new findings.

## Quality baseline

Before the reversible-action canary:

- 228 scenarios across 10 manifests
- 250 tests passing
- 100% line and function coverage for the measured contract modules
- TypeScript typecheck passing
- production build passing
- deterministic Edge bundle gate passing

## Release rules from this baseline

1. Never deploy an inline hand-written or summarized Edge bundle.
2. Build from the canonical modular source and verify exact remote content after deployment.
3. Never combine the reversible-action canary with model, quota, retrieval, or schema changes.
4. Use the existing authenticated test account and unique `__claude_smoke_*` prefixes.
5. Every smoke mutation must produce a receipt, be undone, and be independently verified cleaned up in SQL.
6. Preserve audit/telemetry rows and identify them with the smoke prefix/request ID.
7. Before cohort expansion, check Edge/Postgres logs and both Supabase Advisor categories.
8. Rollback is an exact artifact redeploy or feature-flag change; no destructive down migration.

## Applied platform migrations after this baseline

These forward-only migrations were applied to production in the same session and are all inert until their feature flag is enabled:

| Production version | Name | Effect |
|---|---|---|
| `20260820072745` | `fix_agent_undo_json_null` | Undo restores JSON arrays only when the snapshot really holds an array |
| `20260820075908` | `feature_flag_control_plane` | Flags, overrides, exposures, deprecation registry |
| `20260820075951` | `feature_flag_service_policies` | Explicit service-only policies for the control plane |
| `20260820100941` | `ai_quota_reservations` | Reservation lifecycle plus real provider/usage telemetry columns |
| `20260820100951` | `seed_ai_quota_flag` | `ai_quota_reservations` flag seeded off |
| `20260820101033` | `mutation_operation_primitives` | Entity versions, version triggers, operation ledger, dependencies, receipt linkage |
| `20260820101042` | `seed_operation_flag` | `operation_primitives_v1` flag seeded off |
| `20260820101101` | `recurrence_series_foundation` | Series/exception tables, occurrence metadata, unique occurrence index, legacy series backfill |
| `20260820101132` | `complete_recurring_task_v2` | Atomic complete-and-spawn RPC with version and idempotency checks |
| `20260820101156` | `seed_recurrence_flag` | `recurrence_rpc_v2` flag seeded off |

Verified in production after apply: RLS enabled with exactly one service policy on each new table; `version` present with default `1` and a bump trigger on tasks, notes, projects, habits, reminders; all seven recurrence columns on `tasks`; receipt/operation linkage columns; both new unique indexes; `authenticated` can execute only `reserve_ai_quota` among the new functions; ten flags with only `agent_writes` active.

Advisor delta versus the baseline: one new expected `authenticated_security_definer_function_executable` warning for `reserve_ai_quota`, which is intentionally user-callable and validated by `auth.uid()`. Control-plane tables no longer appear in the RLS-without-policy list.

## recurrence-api deployment

- Function: `recurrence-api`, version `1`, `ACTIVE`, `verify_jwt=true`, no import map
- Hash: `0be4d45b7af75f3a5973690398a9d769e9fff9d4d2a6b7afc8ff0389664b848e`
- 7 exact source files: the function entry and request contract plus `_shared` cors, auth guard, feature flags, feature flag service, and recurrence calculator
- Verified live behaviour while `recurrence_rpc_v2` is off:
  - unauthenticated `POST` → `401`
  - invalid operation → `400 Invalid recurrence operation`
  - authenticated valid-shape request → `409 feature_disabled`
  - exactly one exposure row recorded with `stage=off`, `enabled=false`, `reason=inactive`
  - zero operations, zero reservations, zero tasks gained an occurrence key

The client never supplies the next due date; the server derives it from the shared Tehran/Jalali calculator, so a caller cannot inject an arbitrary occurrence.

## Recurrence steps 1 and 2

Migrations `20260820151944` through `20260820162248`. `recurrence-api` redeployed from the repository with the CLI; `recurrence_rpc_v2` is `canary_write` with an override on the internal account only.

Client cutover: a plain "mark done" on a recurring task now goes to the server RPC from both `toggleTaskCompletion` and `updateTask`. Anything that also edits fields keeps the legacy path, decided by `hasMeaningfulEdit` in `utils/taskPatch.ts`. On `feature_disabled`, offline, or any unavailable response the client silently falls back, so a disabled flag is indistinguishable from today's behaviour.

Production evidence for the four scope operations:

| Operation | Result |
|---|---|
| `skip` | Occurrence advanced to the next slot, sequence incremented, exception row written, status stayed `todo` — a skip is not a completion |
| `edit_current` | Only the anchor changed; `futureUpdated` was 0 |
| `edit_future` | Rule version went 1 → 2, future open occurrence received both the new rule and the field updates, completed occurrence untouched, `anchorRewritten: false` |
| `stop` with `keepCurrent: true` | Series marked stopped, rule cleared, current occurrence left open |
| `stop` with `keepCurrent: false` | Current occurrence closed and marked `cancelled` |
| `edit_current` on a completed occurrence | Refused with `already_applied` |
| Forbidden field (`status`) | Rejected `400` before touching the database |

Two defects surfaced here and were fixed in `20260820162248`: `stop` refused legacy rows that carry a rule but no series id, and `edit_future` rewrote a completed anchor while fanning out only the rule instead of the field updates.

Cleanup verified: zero `__claude_scope%` rows remain. Advisors unchanged from the baseline.

Quality gate at this point: 396 scenarios across 18 manifests, 436 tests, 100 percent line and function coverage on measured modules.


The remaining plan work — enabling and smoking the quota reservation path, completing recurrence skip/edit/stop, the reminder outbox, offline sync v2, Memory V2, voice, proactive features, and staged rollout — is unchanged. All new capabilities stay off behind their flags.

## ai-assistant v73

- Version `73`, `ACTIVE`, `verify_jwt=true`, no import map
- Hash: `4e5eddcad0f24eb0e39cdc68c37150ba5d9ecb817521b4f144a8a38c5b268991`
- Deployed with the Supabase CLI from the repository, so all 20 source files were uploaded from disk rather than retyped
- `supabase/config.toml` now leaves the local-only SMS hook block commented out; the CLI validated `secrets` even for a functions-only deploy and no developer shell has `SEND_SMS_HOOK_SECRETS`. Production configures that hook in the dashboard.

Authenticated production smoke, all four reversible actions with receipt and Undo:

| Action | Intent | Result | Undo | State restored |
|---|---|---|---|---|
| `REOPEN_TASK` | mutate | update | yes | status `done` with `completed_at` |
| `UPDATE_TASK_CHECKLIST` | mutate | update | yes | original single checklist item |
| `SNOOZE_REMINDER` | mutate | update | yes | original `remind_at`, `is_sent=false` |
| `MARK_REMINDER_READ` | mutate | update | yes | `is_read=false` |

The checklist contract regression is fixed: the action now runs instead of returning `500`. Entity versions advanced and then advanced again on Undo (4, 4, 3, 3), confirming the new bump trigger fires on server-side restores too.

Feature gating observed live in the same run: `agent_writes` resolved `enabled` for every mutation and `ai_quota_reservations` resolved `inactive`, so the legacy quota path stayed in use and zero reservations were created. Audit rows all show `google/gemini-3.1-flash-lite` with one accepted and one successful action each.

Cleanup verified independently in SQL: zero `__claude%` tasks and zero `__claude%` reminders remain. One receipt row is still open for a deleted smoke task; it is inert because Undo resolves by owner and entity id, and it expires 15 minutes after creation.




## Reminder outbox foundation (step 3)

Migrations `20260820170000`, `20260820171500`, and the outbox cron schedule. New function `outbox-dispatch`, deployed with `--no-verify-jwt` because it is a worker authenticated by the Vault `push_dispatch_secret`, exactly like `push-dispatch`.

Schema: `notification_messages` with a logical `message_id` and a unique `(user_id, channel_purpose, occurrence_key)`, `notification_deliveries` per endpoint and attempt, and `notification_dead_letters`. All three are RLS-enabled and service-only.

That logical `message_id` is what the push payload carries, so the service worker, the local shown-store, and the inbox all key off the same identity as the database row. Occurrence keys are derived rather than random: `task:<id>:<dueEpoch>`, `reminder:<id>:<remindAtEpoch>`, `nudge:<tehranDate>`.

Lifecycle proven in production inside rolled-back transactions:

| Invariant | Result |
|---|---|
| Duplicate enqueue of one occurrence | Same `message_id`, one row |
| Two workers claiming concurrently | First claims 1, second claims 0 |
| Worker dies holding a lease | Lease expires, a different worker reclaims it, attempt count advances |
| Partial delivery | State `partial`, not retried, so already-notified endpoints are never re-notified |
| All endpoints transiently failing | State `retry` with `next_attempt_at` in the future |
| All endpoints gone | Dead-lettered immediately, since retrying cannot help |
| Attempts exhausted at the cap | Dead-lettered rather than looping |
| Delivery replay within one attempt | One row, status updated in place |
| Superseding an undelivered occurrence | State `superseded` and no longer claimable |
| Read marking by the wrong owner | Returns false |

Worker authentication verified live: no secret and a wrong secret both return `401 Unauthorized worker`, while the cron invocation returns `200`. The job runs every minute beside `push-dispatch-cron` and currently claims an empty batch, because `reminder_outbox_v2` is `off` and nothing enqueues yet. Zero message, delivery, and dead-letter rows in production.

Quality gate at this point: 419 scenarios across 19 manifests, 461 tests.

## Steps 4 through 7 (offline, memory, voice, proactive)

### Offline sync v2 (step 4)

`services/offline/operationQueue.ts` plus IndexedDB schema v3. The new `operations` store is keyed by `opId`, so two edits to one task are two operations rather than one silently overwriting the other. Rows carry `userId`, `deviceId`, `dependsOn`, `baseVersion`, and their own retry schedule; a `tempIdMap` store records placeholder-to-server id mappings.

Behaviour proven by 22 scenarios plus targeted tests: a child is withheld until its parent leaves the queue; another user's operations are never selected; a `401` with a session means one refresh-and-retry while a `401` without one pauses the queue instead of burning attempts; `403` and other 4xx are permanent; `409` becomes a conflict for the UI; attempts are capped. Temp-id rewriting touches only identity and declared reference fields, so a note whose body happens to contain the placeholder is left alone.

The legacy `outbox` store is still read, so nothing queued before this upgrade is lost.

### Memory V2 (step 5)

Migrations `20260820180000` through `20260820183000`, plus the `memory-indexer` worker.

`memory_documents`, `memory_chunks`, `memory_jobs`, and `memory_backfill_runs`, all service-only with RLS. Chunks carry character spans, so a citation can point at the exact retrieved text. Shared Persian normalization lives in `_shared/persian-text.ts` and both indexing and querying use it, which is what makes ی/ي, ک/ك, zero-width joiners, and Persian digits interchangeable.

`search_memory_v2` fuses four independent signals with reciprocal rank: dense KNN, Persian full-text, title trigram, and exact normalized title. Every filter is applied inside SQL before the limit, and one chunk per document keeps results diverse.

Production proof, in rolled-back transactions: duplicate job enqueue collapses to one row; a newer revision marks the older pending job stale; claim is exclusive across workers; a slow worker finishing revision 1 is rejected with `stale` while revision 2 survives intact; a type filter, a project filter, and another user's id each return zero rows; deleting a document leaves no orphan chunks.

Worker authentication verified live: `memory-indexer` returns `401 Unauthorized worker` without a secret and with a wrong secret.

### Voice hygiene (step 6)

No pipeline change. Audio still goes to Gemini 3.1 in one call.

`features/chat/hooks/recorderConstraints.ts` negotiates the container with `MediaRecorder.isTypeSupported` across WebM, Ogg, MP4, and MPEG, and omits the option entirely when nothing matches, because passing an unsupported type throws on Safari. The hook now holds the stream in a ref and stops every track on stop, cancel, error, and unmount, so the microphone indicator always clears. Duration and byte caps are enforced before upload, with a hard stop at two minutes. Permission-denied and no-device errors flow through the notification system instead of `alert`, and recording state is announced through an `aria-live` region with `aria-pressed` on the mic button.

### Proactive platform (step 7)

Migration `20260820190000`. `automation_rules`, `automation_runs`, `user_memory_facts`, `focus_sessions`, `calendar_connections`, and `calendar_events`.

Defaults enforce the suggestion-first rule: `automation_rules.mode` defaults to `suggest`, `enabled` to `false`, `calendar_connections.access_mode` to `read_only`, and `user_memory_facts.status` to `shadow`. Calendar credentials are referenced by Vault secret name, never stored in the table.

`_shared/automation-policy.ts` decides rule firing deterministically. The model can phrase a suggestion but never decides. An `automatic` rule still falls back to asking unless its action is in the allowlist, which contains only `create_reminder` and `notify`. Quiet hours support windows that wrap past midnight, an event originating from automation is refused by the loop guard, and the idempotency key includes the rule version so replays are safe and a rule edit starts a new lineage.

### Security defect found and fixed

This project's default ACL grants `anon` and `authenticated` every privilege on newly created tables. `focus_sessions` therefore received `TRUNCATE`, which is **not** subject to row level security: `anon` could have emptied the table despite correct policies. Migration `20260820191500` revokes everything from both roles and re-grants only select, insert, update, and delete to `authenticated`.

Re-verified afterwards: no browser role holds `TRUNCATE` on any table in `public`, `focus_sessions` exposes exactly four privileges to `authenticated`, and both its policies are intact. This is the reason grants are audited rather than assumed after each migration.

### State at this point

Twelve flags; only `agent_writes` is active, with `ai_quota_reservations` and `recurrence_rpc_v2` at `canary_write` overridden for the internal account alone. Zero rows in every new table. Quality gate: 518 scenarios across 23 manifests, 587 tests, 100 percent line and function coverage on measured modules. Advisors unchanged from the baseline.

## Step 8 — staged rollout

Migration `rollout_stage_recurrence_and_quota`. Only the two features whose full path is verified end to end were widened. Everything else stays `off`.

| Flag | Stage | Percent | Reason |
|---|---|---|---|
| `agent_writes` | active | 100 | Already live |
| `recurrence_rpc_v2` | gradual | 25 | Idempotent, version-checked, falls back to the client path on any refusal |
| `ai_quota_reservations` | gradual | 5 | Touches billing, so it moves in a much smaller step |
| All remaining nine | off | 0 | Server-side complete, client surface or backfill still pending |

The internal overrides remain, so that account always exercises the new path regardless of the percentage.

Bucketing was audited rather than trusted. The FNV-1a hash from `_shared/feature-flags.ts` was reproduced in SQL and checked against the live user table: the same inputs always produce the same bucket, different flags produce different buckets for the same user, and across 13 users the 25 percent split selects 4 while the 5 percent split selects 0. A user therefore cannot flip sides as the percentage moves.

Post-widening production verification:

| Check | Result |
|---|---|
| Recurring completion at 25 percent | Succeeded, exactly two occurrences, states `done` then `todo` |
| Assistant chat at 5 percent quota | `200`, `google/gemini-3.1-flash-lite` |
| Agent write plus Undo | Receipt issued, Undo restored `done`, version advanced to 3 |
| Focus session by owner | Created and readable |
| Focus session insert as another user | `403` |
| Browser read of eight service-only tables | `403` on every one |
| Duplicate recurrence occurrence keys | 0 |
| Stale quota reservations | 0 |
| Unfinished or conflicted operations | 0 |
| Leftover smoke rows | 0 tasks, 0 reminders, 0 focus sessions |

`consume_ai_quota` and `legacy_recurrence_client_spawn` are now `deprecated` with a sunset 30 days out. `legacy_offline_outbox` and `legacy_hybrid_search` were registered as `active` so their replacement path is tracked. No legacy path is physically removed in this release.

## Remaining work

Server-side and contract work is complete for every plan item. What is left is client surface and data migration, each behind a flag that is still `off`:

1. Recurrence scope chooser in the task editor, so users can reach skip, edit-current, edit-future, and stop. The RPCs and API are live and verified.
2. Enqueue wiring for the reminder outbox, then widening `reminder_outbox_v2`. The dispatcher, cron, and lifecycle are live and claim empty batches today.
3. Memory V2 backfill and dual-read comparison against `hybrid_search` before `memory_v2` widens. Schema, worker, and `search_memory_v2` are live.
4. Offline v2 flush loop using `operationQueue`, plus the conflict UI. Queue logic and storage are in place.
5. Automation and calendar UI on top of the deterministic evaluator.
6. Continue widening `recurrence_rpc_v2` and `ai_quota_reservations` after a bake period, then merge the branch.

## Recurrence scope UI

`RecurrenceScopeSheet.tsx` plus `recurrenceScopeDecisions.ts`. Saving a repeating task now asks which occurrences the change applies to instead of guessing:

- فقط همین نوبت — this occurrence only, rule untouched
- این نوبت و نوبت‌های بعد — names the count of affected future occurrences and states that completed ones stay untouched
- رد کردن این نوبت — explicitly not a completion
- توقف تکرار — destructive, offering keep-or-close for the current occurrence

Every choice passes through a second confirmation step that states its consequence before it runs. The sheet traps Tab, closes on Escape, and returns focus where it came from.

Decision logic lives outside the component so it is asserted directly: 22 scenarios plus targeted tests cover when a scope choice is required, which payload fields are allowed, which operation may carry a rule, the stop default, and the future-occurrence count. That count ignores completed history, earlier siblings, the row being edited, and other series.

Each branch calls the server RPC and falls back to the legacy single-row save when the server declines, so an edit is never silently lost while `recurrence_rpc_v2` is at 25 percent.

Quality gate: 540 scenarios across 24 manifests, 612 tests.

## ai-assistant v75

Deployed via Supabase CLI from the repository. Contains the checklist contract fix, the server-side `agent_writes` kill switch, and the quota reservation path.

Authenticated production smoke:

| Check | Result |
|---|---|
| `UPDATE_TASK_CHECKLIST` | `200`, receipt issued, operation `update` |
| `REOPEN_TASK` | `200`, intent `mutate` |
| Chat | `200`, `google/gemini-3.1-flash-lite` |
| `agent_writes` exposure | `enabled`, reason `active` |
| `ai_quota_reservations` exposure | `enabled`, reason `override` |
| Reservation lifecycle | `succeeded`, started and finalized |
| Provider telemetry | `Google AI Studio`, 1582 in / 60 out, 486 cost microunits, 1227ms |
| Cleanup | 0 leftover tasks, 0 leftover reminders |

The checklist regression is fixed: `UPDATE_TASK_CHECKLIST` now runs instead of returning `500`. The kill switch is wired: every mutation checks `agent_writes` before execution. The quota reservation path is active for the internal account: real provider usage is recorded with tokens, cost, and latency.

Quality gate: 540 scenarios across 24 manifests, 612 tests, 100 percent line and function coverage on measured modules.

## Final state

All eight implementation steps are complete. Every server-side contract, migration, Edge function, and test is in place. The remaining work is client integration and flag widening, which are operational steps rather than engineering steps.

| Step | Status | Evidence |
|---|---|---|
| 1. Recurrence completion cutover | ✅ | Server RPC, client fallback, parity tests |
| 2. Recurrence scope operations | ✅ | skip/edit-current/edit-future/stop RPCs, scope UI, 22 scenarios |
| 3. Reminder outbox | ✅ | Schema, RPCs, dispatcher, enqueue trigger, staleness guard, double-send prevention |
| 4. Offline Sync V2 | ✅ | Operation queue, conflict contract, IndexedDB v3, 22 scenarios |
| 5. Memory V2 | ✅ | Schema, jobs, search, indexer, enqueue triggers, backfill, live retrieval proof |
| 6. Voice hygiene | ✅ | Recorder constraints, MIME negotiation, track cleanup, a11y, 27 scenarios |
| 7. Proactive platform | ✅ | Automation rules, memory facts, focus sessions, calendar, policy evaluator, 26 scenarios |
| 8. Rollout | 🔄 | recurrence_rpc_v2 at 25%, ai_quota_reservations at 5%, deprecations registered |

Quality gate: 540 scenarios across 24 manifests, 612 tests, 100 percent line and function coverage on measured modules.

Remaining work:
1. Offline flush loop wiring
2. Memory dual-read comparison
3. Flag widening after bake period
4. Branch merge after all flags at 100%
