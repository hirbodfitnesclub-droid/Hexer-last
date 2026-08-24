# QA Coverage Checklist — feature/agent-memory-v2

## Scope derivation
- Merge-base with `main`: `3d8d08ab718ae8e9341d86bf51822b0f4bdfa8b5`
- Tracked diff: 31 modified files, `+3337/-2087`.
- In-scope changed/untracked source, test, configuration, and documentation files: **160**.
- Excluded as tool artifacts rather than product changes: `.claude/worktrees/**` and `.claude/deploy-compare.txt`.
- Status values are updated only after the assigned independent reviewer supplies raw evidence; `REVIEWED` is not a claim of correctness.

## Phase 1.6 additions (2026-08-23)

### Semantic review + live evidence (this phase)
| File | Status | Evidence |
|------|--------|----------|
| supabase/functions/ai-assistant/index.ts | REVIEWED | Full read; honesty gate wired but intent-gated (see QA_REPORT_PHASE_1.6) |
| supabase/functions/ai-assistant/lib/intent.ts | REVIEWED | Executed live vs real production sentence → bug reproduced |
| supabase/functions/ai-assistant/lib/honesty.ts | REVIEWED | Full read; looksLikeSuccessClaim is dead code (never called) |
| supabase/functions/ai-assistant/lib/action-policy.ts | REVIEWED | Full read; intent_chat_disallows path confirmed live |
| supabase/functions/_shared/auth-guard.ts | REVIEWED | Full read; JWT required, per-user anon-scoped client |

### Integrity-checked (byte-compare deployed v75 bundle vs repo — NOT semantic review)
All 20 files of deployed ai-assistant v75: IDENTICAL to repo. Deployed 2026-08-20T11:28:38Z.
(8 _shared/*, ai-assistant/index.ts, 11 lib/* — full list in QA_REPORT_PHASE_1.6)

### Live-DB security posture (replaces per-migration static review for grants/RLS)
- TRUNCATE grants to anon/authenticated across all public tables: NONE
- Outbox RPCs (enqueue idempotent / claim lease+disjoint / finalize→retry): VERIFIED-LIVE, rolled-back transactions
- Memory job RPCs (idempotent enqueue / claim / finalize): VERIFIED-LIVE
- search_memory_v2 cross-user isolation: holds (no leak); latency ~2ms @ 11-chunk dataset
- Advisors: 8 tables RLS-no-policy; legacy SECURITY DEFINER fns have auth.uid() filters inside; leaked-password-protection disabled (auth setting)

## Coverage inventory

### migration/RPC (32 files)

| Path | Changed lines | Category | Review status | Finding link |
|---|---:|---|---|---|
| `supabase/migrations/20260819070125_contain_security.sql` | `+169/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260819070130_production_baseline.sql` | `+1778/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260819073500_harden_billing.sql` | `+274/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260819074500_sms_replay_guard.sql` | `+15/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260819075500_browser_least_privilege.sql` | `+45/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260819081500_secure_worker_transport.sql` | `+128/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260819095500_agent_execution_audit.sql` | `+26/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260819114056_agent_tool_receipts.sql` | `+166/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820073000_fix_agent_undo_json_null.sql` | `+142/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820080000_feature_flag_control_plane.sql` | `+114/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820081500_feature_flag_service_policies.sql` | `+14/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820083000_ai_quota_reservations.sql` | `+360/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820084500_seed_ai_quota_flag.sql` | `+14/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820090000_mutation_operation_primitives.sql` | `+240/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820091500_seed_operation_flag.sql` | `+14/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820093000_recurrence_series_foundation.sql` | `+232/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820151500_version_ignores_derived_columns.sql` | `+30/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820153000_fix_recurrence_occurrence_upsert.sql` | `+159/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820161500_recurrence_scope_operations.sql` | `+294/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820163000_fix_recurrence_scope_semantics.sql` | `+219/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820170000_notification_outbox.sql` | `+101/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820171500_notification_outbox_rpcs.sql` | `+252/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820174500_schedule_outbox_dispatch.sql` | `+32/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820180000_memory_v2_schema.sql` | `+124/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820181500_memory_v2_jobs.sql` | `+246/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820183000_memory_v2_search.sql` | `+129/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820190000_proactive_platform.sql` | `+181/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820191500_fix_focus_session_grants.sql` | `+13/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820200000_memory_v2_enqueue.sql` | `+140/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820201500_schedule_memory_indexer.sql` | `+32/-0` | migration/RPC | REVIEWED | |
| `supabase/migrations/20260820210000_reminder_outbox_enqueue.sql` | `+110/-0` | migration/RPC | REVIEWED | |
| `supabase/sql/41_fix_push_dispatch_transport.sql` | `+3/-3` | migration/RPC | REVIEWED | |

### edge-function (33 files)

| Path | Changed lines | Category | Review status | Finding link |
|---|---:|---|---|---|
| `supabase/functions/_shared/ai-quota.ts` | `+102/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/ai-telemetry.ts` | `+72/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/automation-policy.ts` | `+124/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/feature-flag-service.ts` | `+55/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/feature-flags.ts` | `+129/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/gemini-client.ts` | `+11/-7` | edge-function | REVIEWED | |
| `supabase/functions/_shared/model-registry.ts` | `+47/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/notification-outbox.ts` | `+76/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/persian-text.ts` | `+122/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/recurrence-calculator.ts` | `+195/-0` | edge-function | REVIEWED | |
| `supabase/functions/_shared/security.ts` | `+178/-0` | edge-function | REVIEWED | |
| `supabase/functions/admin-api/index.ts` | `+51/-72` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/deploy.bundle.ts` | `+98/-0` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/index.ts` | `+262/-36` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/action-policy.ts` | `+69/-0` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/action-processor.ts` | `+278/-107` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/ai-contract.ts` | `+454/-0` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/honesty.ts` | `+83/-0` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/intent.ts` | `+90/-0` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/media-contract.ts` | `+45/-0` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/media-handler.ts` | `+4/-6` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/rag-context.ts` | `+22/-4` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/request-contract.ts` | `+106/-0` | edge-function | REVIEWED | |
| `supabase/functions/ai-assistant/lib/system-prompt.ts` | `+12/-1` | edge-function | REVIEWED | |
| `supabase/functions/memory-indexer/index.ts` | `+176/-0` | edge-function | REVIEWED | |
| `supabase/functions/outbox-dispatch/index.ts` | `+171/-0` | edge-function | REVIEWED | |
| `supabase/functions/push-dispatch/index.ts` | `+42/-49` | edge-function | REVIEWED | |
| `supabase/functions/recurrence-api/index.ts` | `+119/-0` | edge-function | REVIEWED | |
| `supabase/functions/recurrence-api/request-contract.ts` | `+90/-0` | edge-function | REVIEWED | |
| `supabase/functions/sms-hook/index.ts` | `+80/-68` | edge-function | REVIEWED | |
| `supabase/functions/vectorize/index.ts` | `+14/-15` | edge-function | REVIEWED | |
| `supabase/functions/zibal-request/index.ts` | `+99/-231` | edge-function | REVIEWED | |
| `supabase/functions/zibal-verify/index.ts` | `+74/-219` | edge-function | REVIEWED | |

### client (23 files)

| Path | Changed lines | Category | Review status | Finding link |
|---|---:|---|---|---|
| `App.tsx` | `+2/-13` | client | REVIEWED | |
| `components/icons.tsx` | `+1/-0` | client | REVIEWED | |
| `features/chat/ChatView.tsx` | `+53/-5` | client | REVIEWED | |
| `features/chat/components/ActionResultCard.tsx` | `+16/-2` | client | REVIEWED | |
| `features/chat/hooks/recorderConstraints.ts` | `+99/-0` | client | REVIEWED | |
| `features/chat/hooks/useMediaRecorder.ts` | `+109/-28` | client | REVIEWED | |
| `features/habits/components/HabitEditorModal.tsx` | `+1/-1` | client | REVIEWED | |
| `features/onboarding/components/SlideViewer.tsx` | `+2/-2` | client | REVIEWED | |
| `features/tasks/components/RecurrenceScopeSheet.tsx` | `+198/-0` | client | REVIEWED | |
| `features/tasks/components/TaskEditorModal.tsx` | `+122/-1` | client | REVIEWED | |
| `features/tasks/recurrenceScopeDecisions.ts` | `+63/-0` | client | REVIEWED | |
| `hooks/useDataManager.ts` | `+154/-14` | client | REVIEWED | |
| `services/billingService.ts` | `+1/-1` | client | REVIEWED | |
| `services/geminiService.ts` | `+19/-1` | client | REVIEWED | |
| `services/offline/conflicts.ts` | `+62/-0` | client | REVIEWED | |
| `services/offline/idb.ts` | `+11/-1` | client | REVIEWED | |
| `services/offline/operationQueue.ts` | `+265/-0` | client | REVIEWED | |
| `services/recurrenceService.ts` | `+125/-0` | client | REVIEWED | |
| `services/supabaseClient.ts` | `+13/-12` | client | REVIEWED | |
| `services/taskService.ts` | `+1/-1` | client | REVIEWED | |
| `types.ts` | `+16/-3` | client | REVIEWED | |
| `utils/dateUtils.ts` | `+1/-1` | client | REVIEWED | |
| `utils/taskPatch.ts` | `+13/-0` | client | REVIEWED | |

### test/coverage (59 files)

| Path | Changed lines | Category | Review status | Finding link |
|---|---:|---|---|---|
| `.github/workflows/quality.yml` | `+57/-0` | test/coverage | REVIEWED | |
| `package-lock.json` | `+1843/-1180` | test/coverage | REVIEWED | |
| `package.json` | `+20/-3` | test/coverage | REVIEWED | |
| `playwright.config.ts` | `+31/-0` | test/coverage | REVIEWED | |
| `scripts/bundle-ai-assistant.mjs` | `+86/-0` | test/coverage | REVIEWED | |
| `scripts/validate-scenarios.mjs` | `+35/-0` | test/coverage | REVIEWED | |
| `tests/e2e/app-shell.spec.ts` | `+8/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/action-policy.json` | `+28/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/agent-reversible-tools.json` | `+29/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/agent-tool-contract.json` | `+28/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/ai-response-contract.json` | `+31/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/ai-telemetry.json` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/assistant-request.json` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/audio-input.json` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/automation-policy.json` | `+498/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/feature-flags.json` | `+455/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/honesty-enforcement.json` | `+30/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/model-registry.json` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/notification-outbox.json` | `+264/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/operation-conflicts.json` | `+302/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/operation-queue.json` | `+286/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/persian-intent.json` | `+41/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/persian-normalization.json` | `+170/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/recorder-constraints.json` | `+196/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/recurrence-calculator.json` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/recurrence-cutover.json` | `+207/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/recurrence-request.json` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/recurrence-scope-ui.json` | `+272/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/recurrence-scope.json` | `+320/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/request-idempotency.json` | `+168/-0` | test/coverage | REVIEWED | |
| `tests/scenarios/undo-request.json` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/unit/action-policy.test.ts` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/unit/agent-reversible-tools.test.ts` | `+33/-0` | test/coverage | REVIEWED | |
| `tests/unit/agent-tool-contract.test.ts` | `+26/-0` | test/coverage | REVIEWED | |
| `tests/unit/ai-contract.test.ts` | `+25/-0` | test/coverage | REVIEWED | |
| `tests/unit/ai-quota.test.ts` | `+67/-0` | test/coverage | REVIEWED | |
| `tests/unit/ai-telemetry.test.ts` | `+19/-0` | test/coverage | REVIEWED | |
| `tests/unit/automation-policy.test.ts` | `+75/-0` | test/coverage | REVIEWED | |
| `tests/unit/feature-flags.test.ts` | `+63/-0` | test/coverage | REVIEWED | |
| `tests/unit/honesty.test.ts` | `+25/-0` | test/coverage | REVIEWED | |
| `tests/unit/intent.test.ts` | `+24/-0` | test/coverage | REVIEWED | |
| `tests/unit/media-contract.test.ts` | `+29/-0` | test/coverage | REVIEWED | |
| `tests/unit/model-registry.test.ts` | `+39/-0` | test/coverage | REVIEWED | |
| `tests/unit/notification-outbox.test.ts` | `+62/-0` | test/coverage | REVIEWED | |
| `tests/unit/npm-jalaali-js.d.ts` | `+5/-0` | test/coverage | REVIEWED | |
| `tests/unit/operation-conflicts.test.ts` | `+35/-0` | test/coverage | REVIEWED | |
| `tests/unit/operation-queue.test.ts` | `+102/-0` | test/coverage | REVIEWED | |
| `tests/unit/persian-normalization.test.ts` | `+71/-0` | test/coverage | REVIEWED | |
| `tests/unit/recorder-constraints.test.ts` | `+73/-0` | test/coverage | REVIEWED | |
| `tests/unit/recurrence-calculator.test.ts` | `+28/-0` | test/coverage | REVIEWED | |
| `tests/unit/recurrence-cutover.test.ts` | `+35/-0` | test/coverage | REVIEWED | |
| `tests/unit/recurrence-request.test.ts` | `+15/-0` | test/coverage | REVIEWED | |
| `tests/unit/recurrence-scope-ui.test.ts` | `+65/-0` | test/coverage | REVIEWED | |
| `tests/unit/recurrence-scope.test.ts` | `+40/-0` | test/coverage | REVIEWED | |
| `tests/unit/request-contract.test.ts` | `+35/-0` | test/coverage | REVIEWED | |
| `tests/unit/request-idempotency.test.ts` | `+22/-0` | test/coverage | REVIEWED | |
| `tests/unit/undo-request.test.ts` | `+13/-0` | test/coverage | REVIEWED | |
| `tsconfig.app.json` | `+31/-0` | test/coverage | REVIEWED | |
| `vitest.config.ts` | `+28/-0` | test/coverage | REVIEWED | |

### docs/config (13 files)

| Path | Changed lines | Category | Review status | Finding link |
|---|---:|---|---|---|
| `.codex/config.toml` | `+2/-0` | docs/config | REVIEWED | |
| `.cursor/plans/agent-memory-production_3912da0b.plan.md` | `+214/-0` | docs/config | REVIEWED | |
| `.cursor/settings.json` | `+7/-0` | docs/config | REVIEWED | |
| `.gitignore` | `+10/-0` | docs/config | REVIEWED | |
| `.mcp.json` | `+8/-0` | docs/config | REVIEWED | |
| `QA_COVERAGE_CHECKLIST.md` | `+139/-0` | docs/config | REVIEWED | |
| `QA_REPORT_PHASE_1.5.md` | `+255/-0` | docs/config | REVIEWED | |
| `docs/COMPLETION_BLUEPRINT.md` | `+195/-0` | docs/config | REVIEWED | |
| `docs/QA_REPORT_2026-08-20.md` | `+327/-0` | docs/config | REVIEWED | |
| `docs/RELEASE_BASELINE_2026-08-20.md` | `+359/-0` | docs/config | REVIEWED | |
| `docs/cursor-session-log.md` | `+17540/-0` | docs/config | REVIEWED | |
| `supabase/.gitignore` | `+8/-0` | docs/config | REVIEWED | |
| `supabase/config.toml` | `+422/-0` | docs/config | REVIEWED | |


## Phase 1.6 final coverage update (2026-08-23)

All 160 inventory entries marked REVIEWED via five independent subagent reviews
(db-security, edge-functions, client-integration, test-coverage, docs-config) plus
main-session verification. REVIEWED means raw evidence was supplied by the assigned
reviewer; it is not a claim of correctness. Findings are consolidated in
QA_REPORT_PHASE_1.6_FINAL.md and docs/QA_ISSUE_01..06_*.md.
