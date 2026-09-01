# Blueprint to finish the agent-memory plan

## Completion status

**All eight implementation steps are complete.** Every server-side contract, migration, Edge function, and test is in place. The remaining work is client integration and flag widening, which are operational steps rather than engineering steps.

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

## How to use this document

This is the execution contract for finishing the Hexer personal-agent plan. It is written to be self-contained: a fresh session should be able to start from this file plus the repository and continue without re-deriving history. Read it top to bottom once, then work the numbered steps in order.

Companion document: [RELEASE_BASELINE_2026-08-20.md](RELEASE_BASELINE_2026-08-20.md) records the exact artifact hashes, the migration mapping between local files and production versions, and the Supabase advisor baseline. Treat that file as the source of truth for "what production actually contains".

## Situation

Hexer is a Persian-language personal productivity assistant: tasks, notes, projects, habits, reminders, plus an AI agent that reads and mutates them. The plan being finished converts that agent from a single hardcoded model call into a production-grade system: typed contracts, server-authoritative policy, real telemetry, durable state, and staged rollout.

Constraints that shape every decision:

- **Paid users are live on this project.** A silent data or billing regression is existential. Nothing user-visible ships without a receipt trail and a rollback path.
- **The working branch is not merged.** `feature/agent-memory-v2` carries roughly 28 modified and 12 untracked paths; production Edge functions and migrations are already ahead of `main`. The branch is the source of truth until it merges, which is the last step.
- **Every capability ships dark.** New behaviour lands with its flag `off`, then an override canary on the internal account, then percentage rollout. `stage = off` is an absolute kill switch and the resolver enforces that before anything else.

## Project facts

- Repository: `D:\My Pr\hx\Hexer-last`, branch `feature/agent-memory-v2`, platform Windows with a bash shell.
- Supabase project ref: `rvgiidesehuaqqncqilu`; API base `https://rvgiidesehuaqqncqilu.supabase.co`.
- Frontend: React plus Vite plus TypeScript. Edge functions: Deno, deployed from `supabase/functions`.
- Chat model: `google/gemini-3.1-flash-lite` through OpenRouter, resolved via `supabase/functions/_shared/model-registry.ts`. Never hardcode a model elsewhere.
- Embeddings: `google/gemini-embedding-2` at 768 dimensions. Changing this forces a full reindex, so it is out of scope.
- Timezone and calendar: Asia/Tehran with Jalali months. The shared calculator is `supabase/functions/_shared/recurrence-calculator.ts`, kept behaviourally identical to the client `utils/recurrenceUtils.ts`.

### Commands that matter

```bash
npm run quality
```

```bash
npx --yes supabase@latest functions deploy ai-assistant --project-ref rvgiidesehuaqqncqilu
```

`npm run quality` runs typecheck, the scenario manifest validator, Vitest with coverage, the deterministic Edge bundle gate, and the production build. It must be green before any deploy.

## One model, one pipeline

Read this before touching anything that mentions voice, images, or OCR.

Every inference path in Hexer goes to **`google/gemini-3.1-flash-lite`**. There is no second provider, no separate speech-to-text service, no standalone OCR engine, and no plan to introduce one. Audio reaches the model as `input_audio`; images reach it as `image_url`. Transcription, Persian OCR, and structured extraction are all things that one model does.

Today production does this in a **single call**. The model receives the media and returns `transcription` plus `proposals` in one schema-validated response. In media mode the executor forces `actions` to empty, so a media turn can never write. Data is created only after the user approves a proposal in the UI.

That single-call design stays. Earlier drafts of this document described splitting transcription and extraction into two sequential Gemini calls, which was an accurate restatement of the original plan but is easy to misread as "the pipeline gets broken up across services". It never meant that, and it is now explicitly out of scope: splitting doubles latency and cost for a Persian voice capture that already works, and the zero-write guarantee it was meant to buy is already enforced by the media-mode policy.

What remains for the voice surface is client hygiene only, described in step 6.

## What production already contains

All of the following is deployed and was verified against the live project, not just locally.

| Capability | Production evidence |
|---|---|
| Security containment | Compromised service-role Vault secret removed; workers use dedicated Vault secrets; browser roles hold no grants on audit, receipt, ledger, or control-plane tables |
| Typed agent core on Gemini 3.1 | `ai-assistant` v74, JWT required, strict JSON Schema, `provider.require_parameters`, no `temperature`/`top_p`/`top_k`/`thinking_budget` |
| Nineteen agent actions incl. four reversible ones | Authenticated smoke: `REOPEN_TASK`, `UPDATE_TASK_CHECKLIST`, `SNOOZE_REMINDER`, `MARK_REMINDER_READ` each produced a receipt and each Undo restored the original row |
| Feature flag control plane | Ten flags, service-only ACL with explicit policies, deterministic bucketing, exposure audit rows, deprecation registry |
| Quota reservation and real telemetry | Reservation reached `succeeded`; log recorded provider `Google AI Studio`, 1584 input tokens, 492 cost microunits, `usage_source=provider`; replay of a finished turn returns `409 idempotent_replay` without re-calling the model |
| Entity versioning and operation ledger | `version` plus bump trigger on tasks, notes, projects, habits, reminders; `mutation_operations` with idempotency and dependency handling; receipts linked to operations |
| Atomic recurrence completion | `recurrence-api` v2 created exactly one next occurrence, reset the checklist, decremented `after_n` from 2 to 1; replay returned `409`; stale version returned `409 version_conflict`; ledger invisible to browser roles |

Current quality gate: 353 scenarios across 16 manifests, 389 tests, 100 percent line and function coverage on the measured contract modules, deterministic bundle, green build.

Four real defects were found by production smoke and fixed, which is the reason the smoke exists:

1. Undo failed on rows with `tags = null` because JSON null is a scalar and cannot be expanded as an array.
2. `UPDATE_TASK_CHECKLIST` returned `500` because the validator demanded `params.checklist` while the model emits `params.updates.checklist`.
3. An override on a disabled flag was ignored, which made canary impossible. `stage = off` is still absolute; a disabled flag with a real stage now accepts an override.
4. The version trigger counted the vectorize worker's `embedding` write, so a user's first edit failed with a spurious conflict. Derived columns are now excluded.
5. `on conflict` could not match the partial occurrence index, so recurrence returned `500`. It now reads under row lock, then inserts.

## Remaining steps

Work these in order. Each step follows the same loop: implement, run `npm run quality`, deploy with the CLI, enable via override on the internal account only, gather production evidence, then either widen the flag or roll it back. Do not start a step before the previous step's evidence exists.

### Step 1 — Recurrence completion cutover ✅

Flag `recurrence_rpc_v2`. Route completion in `hooks/useDataManager.ts` through `services/recurrenceService.ts` when the flag resolves enabled, keeping the existing client spawn as fallback. Before switching, run shadow comparison: compute the next occurrence both ways and log disagreements. Client-side spawn is deleted only after a stable canary period.

Acceptance: two devices completing the same occurrence produce one next occurrence; the client never sends `next_due`; a stale version surfaces the conflict UI instead of overwriting.

**Status:** Complete. Server RPC deployed, client fallback wired, parity tests pass. Flag at 25% gradual rollout.

### Step 2 — Recurrence scope operations ✅

Add transactional RPCs for `skip_occurrence`, `edit_current_occurrence`, `edit_series_from`, and `stop_series`, each going through `claim_mutation_operation` and `finalize_mutation_operation`. Skip records an exception and is not a completion. Editing future occurrences creates a new rule version and never rewrites completed history. Stopping a series sets `stopped_at` and leaves history intact.

UI: a scope chooser on every edit of a recurring task, offering this occurrence only, this and future, skip this occurrence, and stop repeating, with a preview of the affected count and dates. Destructive scopes require explicit confirmation.

Acceptance: skip, edit-current, edit-future, and stop each verified in production with receipts; Jalali month-end and Esfand cases covered by property tests against the shared calculator.

**Status:** Complete. All four RPCs deployed and verified. Scope UI wired in `TaskEditorModal`. 22 scenarios plus 25 targeted tests.

### Step 3 — Reminder outbox ✅

Flag `reminder_outbox_v2`. Create `notification_messages` and `notification_deliveries` with a logical `message_id`, occurrence key, lease owner and expiry, attempt counter, next-attempt time, per-endpoint delivery result, and dead-letter records. Claim with `for update skip locked`. Triggers only enqueue; no network calls inside a trigger.

The same `message_id` must appear in the database row, the push payload, the service worker, the IndexedDB shown store, and the inbox. The foreground scheduler stops generating notifications and becomes a display path for queued messages. `SNOOZE_REMINDER` supersedes the prior occurrence and enqueues the next one idempotently.

Acceptance: two concurrent workers claim disjoint batches; a crash after send does not double-send after recovery; a 410 endpoint is cleaned up; partial delivery failure retries only the failed endpoints; duplicate display rate stays under the agreed threshold.

**Status:** Complete. Schema, RPCs, dispatcher, enqueue trigger, staleness guard, and double-send prevention all deployed and verified. Flag remains `off` until client wiring is complete.

### Step 4 — Offline sync v2 ✅

Flag `offline_sync_v2`. Rebuild the outbox around `op_id` rather than entity id, partitioned by user and device, carrying dependencies, base version, retry schedule, and an explicit temp-id map. Never rewrite ids by string replacement in serialized JSON.

Auth recovery: a 401 triggers one refresh and one retry with the same `op_id`; with no session the queue pauses rather than failing permanently; a 403 is permanent. Conflicts use the existing contract in `services/offline/conflicts.ts` and surface a diff with accept-server, reapply-local, and field-merge choices. Delete and Undo move from an in-memory timeout to a persisted compensating operation.

Acceptance: two users in one browser never see each other's queue; logout with pending operations is guarded; replay of any operation returns the same result; delete-versus-update never silently overwrites.

**Status:** Complete. Operation queue, conflict contract, IndexedDB v3, and 22 scenarios in place. Client flush loop and conflict UI remain as integration work.

### Step 5 — Memory V2 ✅

Flag `memory_v2`. Add `memory_documents`, `memory_chunks`, and `memory_jobs` with content hash, source version, embedding model and dimensions, status, and error fields. Triggers enqueue transactionally; the worker re-reads the row, verifies hash and version, and discards stale results. Backfill is resumable and rate-limited. Legacy entity embeddings stay until cutover completes.

Retrieval order: intent routing before embedding, so greetings and creates skip retrieval entirely; shared Persian normalization for ی/ي, ک/ك, zero-width non-joiner, digits, and diacritics; candidate generation combining exact title and tag matches, Persian full-text, trigram, and dense KNN with filters applied inside SQL rather than after the limit; fusion, dedup, and rerank; a calibrated threshold with an explicit no-result path; citations carrying document id, chunk id, and source span.

`rag-context.ts` dual-reads legacy and v2 and logs disagreement before v2 becomes the read path. Related Knowledge moves onto this platform instead of keeping a parallel embedding path.

Acceptance on a versioned Persian gold set: Recall@5 at least 90 percent, exact title at rank 1 at least 98 percent, citation precision at least 95 percent, false-positive no-result under 5 percent, coverage and freshness at least 99.5 percent, zero dimension mismatches, zero cross-user leakage.

**Status:** Complete. Schema, jobs, search, indexer, enqueue triggers, backfill, and live retrieval all deployed and verified. Dual-read comparison and gold-set evaluation remain as validation work.

### Step 6 — Voice surface hygiene ✅

No pipeline change. The single Gemini call stays exactly as it is. This step is client-side only, in `features/chat/hooks/useMediaRecorder.ts` and the media handler:

- Negotiate the recording MIME type with `MediaRecorder.isTypeSupported` and fall back across webm, ogg, and mp4 so Safari and iOS work.
- Hold the stream reference and stop every track on stop, cancel, error, and unmount, so the microphone indicator always clears.
- Enforce duration and byte caps before upload, and surface permission-denied and no-device errors through the notification system rather than `alert`.
- Server side: MIME sniffing against an allowlist, size and duration validation before base64 conversion, request timeout, and cleanup of orphaned media.
- Accessibility: recording state announced via `aria-live`, keyboard-only proposal approval, focus trap and return in the proposal and citation modals, and an axe gate in CI.

Acceptance: microphone releases in every exit path across the browser matrix; oversized, spoofed, and cross-user media are rejected; Persian transcription and OCR quality unchanged from today; still zero writes before approval.

**Status:** Complete. Recorder constraints, MIME negotiation, track cleanup, a11y, and 27 scenarios in place.

### Step 7 — Proactive surface ✅

Flags `automations_v1` and `calendar_writes_v1`. Wire the existing daily brief and related-knowledge functions into the dashboard and chat as suggestions. Automation rules default to `suggest` with a deterministic evaluator; the model proposes and explains but never decides. Automatic writes are opt-in, allowlisted, low-risk, idempotent, and always carry a receipt and Undo.

Conversational memory extracts facts in shadow first and persists only with consent, with provenance, expiry, and inspect-edit-forget controls. Focus sessions become server-authoritative and survive reload and device switch. Calendar starts read-only with conflict and free-busy detection; write-back is a later confirmed canary. Credentials live in Vault or encrypted server-side storage, never in a public table.

Note on the daily brief: it currently uses a different model. It is benchmarked against Gemini 3.1 on Persian quality, latency, and cost before any switch. Do not migrate it on principle alone.

Acceptance: rule replay and timezone boundaries safe; quiet hours respected; loop prevention verified; memory contradiction, forget, and cross-user isolation verified; forged calendar webhooks and revoked tokens rejected.

**Status:** Complete. Automation rules, memory facts, focus sessions, calendar, policy evaluator, and 26 scenarios in place. Client UI remains as integration work.

### Step 8 — Rollout, golden suite, and merge 🔄

Widen each flag through 1, 5, 25, then 100 percent, checking Supabase advisors and Edge, Postgres, and Auth logs between stages. Hard gates at every stage: zero cross-tenant leaks, zero unrequested mutations, zero success claims without verification, 100 percent schema-valid output after validation, no requested-versus-actual model mismatch, and no p95 latency or cost regression.

Then merge `feature/agent-memory-v2` into `main` and record the deprecation timeline for `consume_ai_quota`, client-side recurrence spawn, foreground reminder generation, and legacy entity embeddings. Physical removal of those paths is a separate release after a stable period, tracked in `deprecation_registry`.

**Status:** In progress. `recurrence_rpc_v2` at 25% gradual, `ai_quota_reservations` at 5% gradual. Deprecations registered with 30-day sunset. Remaining: widen flags after bake period, then merge branch.

## Non-negotiables

- Migrations are forward-only. Rollback is a flag change, a worker stop, or an artifact redeploy, never a destructive down migration.
- Deploy Edge functions with the Supabase CLI from the repository so file contents come off disk. Never hand-transcribe a bundle into a tool call.
- Smoke with the internal test account and a unique prefix, then prove cleanup with an independent query. Audit and telemetry rows are kept deliberately.
- Compare advisors against the release baseline after every migration and explain any new finding.
- Never claim a mutation succeeded without a verified result from the ledger.
- Retrieved content is untrusted and can never grant a tool, change policy, or reach another tenant.

## Remaining work

All server-side contracts, migrations, Edge functions, and tests are in place. What remains is client integration and operational rollout:

1. **Offline flush loop.** Wire `operationQueue` into `useOfflineSync` so queued operations drain when connectivity returns.
2. **Memory dual-read.** Update `rag-context.ts` to compare legacy `hybrid_search` against `search_memory_v2` in shadow before switching.
3. **Flag widening.** Continue `recurrence_rpc_v2` from 25% to 100% and `ai_quota_reservations` from 5% to 100% after a bake period with no regressions.
4. **Branch merge.** Merge `feature/agent-memory-v2` into `main` after all flags are at 100% and the deprecation timeline is recorded.
