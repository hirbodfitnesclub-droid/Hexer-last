# CURRENT_TASK — Hexer Phase U (Recurring Tasks + UX Δ)

> **Audience:** Engineer / QA verifying Phase U.  
> **Scope:** Recurring tasks core + approved UX (skip, end, badges, toast, auto-due, series-from-now, reminders, today invariant, 14d done collapse).  
> **Sources:** `docs/PROJECT.md` فاز U · `docs/ARCHITECTURE.md` §U · `docs/tasks.md` (U1–U11)

---

# Status banner

| Field | Value |
|--------|--------|
| **Current phase** | Phase U — Recurring Tasks (+ UX expansions) |
| **Coding status** | **U1–U10 IMPLEMENTED** (U11 handoff this file) |
| **Order** | U1→…→U10 done serially |
| **Risk** | Medium — requires manual SQL 51 on Supabase |
| **npm** | None new |
| **SQL** | `supabase/sql/51_task_recurrence.sql` — **run manually in SQL Editor** |

---

# 1) What shipped (file map)

| ID | Deliverable |
|----|-------------|
| U1 | `supabase/sql/51_task_recurrence.sql` — columns + RPC DEFAULT params |
| U2 | `types.ts` TaskRecurrence/End · `utils/recurrenceUtils.ts` full pure API |
| U3 | `services/taskService.ts` SELECT/whitelist/RPC + normalize on write |
| U4 | `hooks/useDataManager.ts` — series, spawn silent+toast, skip, series fan-out, AI inject spawn |
| U5 | `RepeatIcon` · `features/tasks/components/RecurrencePickerModal.tsx` |
| U6 | `TaskEditorModal` — picker, auto-due, view summary, skip CTA, payload |
| U7 | `TaskCard` recurrence badge (todo only) |
| U8 | `TodaysPlan` badge; due filter unchanged |
| U9 | `TasksView` — partition completed; «تکراری‌های قدیمی‌تر» collapsed; search bypass; create passes recurrence |
| U10 | `useReminderScheduler` — recurring body copy; filter/messageId unchanged |

---

# 2) Deploy (user action required)

1. Open Supabase SQL Editor.  
2. Paste/run **`supabase/sql/51_task_recurrence.sql`** (safe twice).  
3. No Edge deploy. No CLI.

---

# 3) Smoke matrix (human QA — leave ☐ until verified)

| ID | Scenario | Result |
|----|----------|--------|
| U-QA1 | Run 51 SQL twice | ☐ |
| U-QA2 | Create daily + reload persistence | ☐ |
| U-QA3 | Complete daily → tomorrow todo + **one** info toast | ☐ |
| U-QA4 | Skip daily → same id, due tomorrow, still todo | ☐ |
| U-QA5 | Weekly Sat+Wed next due | ☐ |
| U-QA6 | Monthly 1&15; yearly Jalali | ☐ |
| U-QA7 | End after 1 total (remaining 0) → complete no spawn | ☐ |
| U-QA8 | End on_date past next → no spawn/skip advance | ☐ |
| U-QA9 | Clear recurrence → no spawn | ☐ |
| U-QA10 | Enable recurrence w/o date → due today | ☐ |
| U-QA11 | Preview shows next; empty weekdays blocks confirm | ☐ |
| U-QA12 | Badges on card + today plan | ☐ |
| U-QA13 | Edit recurrence updates all open same series | ☐ |
| U-QA14 | Done history not rewritten | ☐ |
| U-QA15 | New occurrence reminds (permission granted) | ☐ |
| U-QA16 | After complete, not active on today’s plan; next is tomorrow | ☐ |
| U-QA17 | Recurring dones >14d collapsed; search reveals | ☐ |
| U-QA18 | Offline create/complete/skip + flush | ☐ |
| U-QA19 | AI create without recurrence still OK | ☐ |
| U-QA20 | Phase O: checklist toggle doesn’t close modal; no PATCH 400 | ☐ |

---

# 4) Implementation notes (for QA)

- **Skip** = same row due advance (not done).  
- **Complete** = done + silent `addTask` next + one info toast «نوبت بعدی ثبت شد».  
- **after_n**: UI N → store `remaining = N-1`.  
- **Auto-due**: first enable recurrence without date → Tehran today 12:00.  
- **DataContext** exposes `skipRecurrenceOccurrence` via manager return (no context file edit needed).

---

# 5) One-liner

**Phase U coded: JSONB recurrence+end, spawn-on-complete, skip-advance, Apple picker, badges, 14d archive UI, reminder body — run SQL 51 before prod QA.**
