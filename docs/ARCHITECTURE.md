# ARCHITECTURE.md — نقشه‌ی مهندسی این ریفکتور (Hexer AI)

> این سند «چه چیزی» و «چرا»ی ریفکتور جاری را تعریف می‌کند؛ «چگونگیِ» گام‌به‌گام در `tasks.md` (R1–R10).
> اصول حاکم (که از قبل پیاده شده‌اند و دست‌نخورده می‌مانند): **Server-Authoritative** (منطق پولی/مصرفی/امنیتی سمت سرور)، **RLS-First** (هر جدول قفل روی `auth.uid()=user_id`)، **Atomic via RPC** (نوشتن چندمرحله‌ای فقط در دیتابیس).

---

## ۱. وضعیت موجود (Snapshot — برای زمینه، نه برای تغییر)
> این بخش فقط برای آگاهی کدنویس است. این موارد **ساخته‌شده‌اند** و در این ریفکتور بازنویسی نمی‌شوند مگر صریحاً در یک تسک گفته شود.

- **جداول موجود (همه با `user_id` + RLS):** `profiles`, `plans`, `subscriptions`, `usage_counters`, `ai_requests_log`, `projects`, `tasks`, `notes`, `habits`, `habit_completions`, `reminders`, `media_assets`.
- **جداول مالی و ادمین:** `discount_codes` (با فیلد `is_active`) و `payments` (که از طریق `discount_code_id` به کدهای تخفیف متصل است). جداول ادمین معمولاً توسط کلاینت اصلی فقط خوانده/استفاده میشوند و مدیریت آنها سمت داشبورد ادمین است.
- **RPC های موجود:** `handle_new_user`(تریگر ساخت اتمیک profile+subscription+usage)، `create_task_with_tags`، `create_note_with_tags`، `match_documents`(جستجوی برداری user-scoped)، `consume_ai_quota`(گیت اتمیک سهمیه، خروجی `{allowed, model, remaining, reason}`)، `activate_subscription`، `enqueue_vectorize`(تریگر `pg_net` روی tasks/notes).
- **توابع لبه‌ی موجود:** `ai-assistant`(مسیر بدون Base64، مدیا از Storage با Service Role)، `vectorize`(امبدینگ ۷۶۸)، `zibal-request`, `zibal-verify`.
- **Storage:** باکت‌های Private `chat-media` و `avatars` با ساختار مسیر `{user_id}/...`.
- **env هدف:** کلاینت `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` · توابع `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ZIBAL_MERCHANT`, `ZIBAL_CALLBACK_URL`.
- **توابع ابری (Edge Functions) و امنیت:** علاوه بر توابع AI کاربر، یک تابع به نام `admin-api` وجود دارد که از طریق کلید `service_role` (بایپس کامل RLS) و احراز هویت سفارشی (هدر `x-admin-secret`) با دیتابیس ارتباط برقرار میکند. قوانین RLS موجود روی جداول نباید به گونهای تغییر کنند که عملکرد این Gateway ادمین را مختل کنند.

> فایل‌های SQL موجود با پیشوند `00`–`12` هستند. **فایل‌های جدیدِ این ریفکتور با پیشوند `20`+ ساخته می‌شوند تا تداخل نکنند.**

---

## ۲. افزوده‌های اسکیما (Schema Δ)
> فایل جدید `supabase/sql/20_refactor_schema.sql` (Idempotent). همه‌ی جداول جدید: `user_id` + RLS پایه `auth.uid() = user_id`.

### ۲.۱. اصلاح `profiles` (رفع باگ Onboarding)
دو ستونِ گم‌شده که فرم Onboarding جمع می‌کند ولی جایی برای ذخیره ندارد:
| ستون | نوع | توضیح |
|------|-----|------|
| specialty | text null | تخصص کاربر (مرحله‌ی ۲ Onboarding) |
| interests | text[] default '{}' | علایق (مرحله‌ی ۳ Onboarding) |

### ۲.۲. لینک دوطرفه — `task_note_links`
جدول واسط که از هر دو سمت کوئری می‌شود.
| ستون | نوع | توضیح |
|------|-----|------|
| id | uuid PK | |
| user_id | uuid not null FK→auth.users | RLS |
| task_id | uuid not null FK→tasks `on delete cascade` | |
| note_id | uuid not null FK→notes `on delete cascade` | |
| created_at | timestamptz default now() | |
- `UNIQUE(task_id, note_id)` برای جلوگیری از لینک تکراری؛ ایندکس روی `(user_id)`, `(task_id)`, `(note_id)`.

### ۲.۳. تاریخچه‌ی چت — `chat_sessions` + `chat_messages`
چت از حالت ephemeral (state در `App.tsx`) به **پایدار، روزانه، با نگه‌داری یک‌ماهه** منتقل می‌شود.

**`chat_sessions`** — یک ردیف به‌ازای هر روزِ کاربر: `id`, `user_id`, `session_date date`(به وقت Asia/Tehran), `created_at`. با `UNIQUE(user_id, session_date)`.

**`chat_messages`** — پیام‌های هر نشست:
| ستون | نوع | توضیح |
|------|-----|------|
| id | uuid PK | |
| user_id | uuid not null FK | RLS |
| session_id | uuid not null FK→chat_sessions `on delete cascade` | |
| sender | text check in ('user','ai') | |
| text | text | |
| mode | text null | auto/action/memory |
| citations | jsonb default '[]' | منابع RAG |
| action_results | jsonb default '[]' | آیتم‌های ساخته/پیشنهادشده |
| created_at | timestamptz default now() | ایندکس `(user_id, session_id, created_at)` |

- **روز جاری vs تاریخچه:** نشستِ `session_date = today(Asia/Tehran)` قابل ادامه است؛ نشست‌های قدیمی‌تر **فقط-خواندنی** (کلاینت ارسال را غیرفعال می‌کند).
- **نگه‌داری یک‌ماهه:** ترجیحاً job شبانه با `pg_cron`: حذف نشست‌های قدیمی‌تر از ۳۰ روز (پیام‌ها با cascade). اگر `pg_cron` در دسترس نبود، **fallback** حذف تنبل داخل RPC `get_chat_sessions`.

### ۲.۴. ایندکس‌های متنی برای RAG هیبریدی
افزونه‌ی **`pg_trgm`** + ایندکس GIN تری‌گرم روی `tasks.title/description` و `notes.title/content` (full-text فارسی در Postgres ضعیف است؛ trigram انتخاب درست برای جستجوی کلیدواژه‌ای فازی فارسی است).

---

## ۳. افزوده‌های RPC (RPC Δ)
> فایل جدید `supabase/sql/21_refactor_functions.sql`. همه user-scoped و Idempotent.

| تابع | مسئولیت |
|------|---------|
| `link_task_note(p_task_id, p_note_id)` | لینک اتمیک دوطرفه، `user_id := auth.uid()`، Idempotent (تکرار خطا نمی‌دهد) |
| `unlink_task_note(p_task_id, p_note_id)` | حذف لینک، فقط برای صاحب |
| `get_linked_notes(p_task_id)` / `get_linked_tasks(p_note_id)` | برگرداندن آیتم‌های لینک‌شده (user-scoped) |
| `hybrid_search(p_query_embedding vector(768), p_query_text text, p_match_count int)` | **قلب RAG:** ترکیب امتیاز cosine (vector) و `similarity()` تری‌گرم با **Reciprocal Rank Fusion**؛ خروجی `(id, type, title, snippet, score)`؛ **اجباراً `where user_id = auth.uid()`** |
| `get_usage_status()` | خواندن وضعیت مصرف **بدون** افزایش شمارنده: `(plan_code, display_name, monthly_quota, request_count, remaining, period_start, period_end, expires_at)` |
| `get_daily_usage(p_days int)` | تجمیع `ai_requests_log` بر اساس روز (Asia/Tehran) برای نمودار مصرف |
| `get_or_create_today_session()` | برگرداندن/ساختِ اتمیک نشست چت امروز بر اساس Asia/Tehran |
| `get_chat_sessions(p_limit int)` | لیست نشست‌های یک‌ماه اخیر؛ در نبود pg_cron، حذف تنبل نشست‌های قدیمی‌تر از ۳۰ روز |

> `consume_ai_quota` دست نمی‌خورد؛ `get_usage_status` فقط برای **نمایش** است و نباید شمارنده را تغییر دهد.

---

## ۴. ارتقای جریان هوش مصنوعی (AI Flow)


markdown## ۴. معماری ریفکتورشده‌ی هوش مصنوعی (Phase D — Backend Stability)

### ۴.۰. ریشه‌های بحران (مرجع تاریخی)

| رتبه | مشکل | اثر مستقیم |
|------|------|------------|
| 🔴 | **تناقض مدل Embedding** — `vectorize` از `text-embedding-004` و `ai-assistant` از `gemini-embedding-2-preview` استفاده می‌کردند | بردارهای ذخیره‌شده و بردار کوئری در فضاهای متفاوت؛ cosine similarity بی‌معنی؛ RAG هرگز کار نمی‌کند |
| 🔴 | **God File بدون مرز خطا** — ۶۰۰ خط در یک تابع؛ خرابی هر بخش کل درخواست را با ۵۰۰ می‌کشد | ناپایداری مزمن و غیرقابل دیباگ |
| 🟠 | **تایم‌اوت تجمعی** — Storage + Embedding + Search + Generation + Actions همه سریالی‌وار در یک تابع ۶۰ثانیه‌ای | ۵۰۴ Timeout روی درخواست‌های پیچیده |

---

### ۴.۱. ساختار ماژولار هدف
supabase/functions/
├── shared/                           ← ابزارهای مشترک (import با path نسبی)
│   ├── cors.ts                        ← corsHeaders constant
│   ├── auth-guard.ts                  ← getAuthUser(authHeader) → {user, client} | throw
│   └── gemini-client.ts               ← EMBEDDING_MODEL constant + factory + generateEmbedding()
│
├── ai-assistant/
│   ├── index.ts                       ← فقط Orchestrator (هدف: <۱۲۰ خط)
│   └── lib/
│       ├── media-handler.ts           ← Storage download → InlineData part
│       ├── rag-context.ts             ← Embedding query + hybrid_search + context string
│       ├── meta-context.ts            ← Tasks/Notes/Projects DB fetch → context string
│       ├── action-processor.ts        ← اجرای CREATE* و SUGGEST_LINK
│       └── system-prompt.ts           ← ساخت system prompt (pure function)
│
└── vectorize/
└── index.ts                       ← اصلاح مدل به EMBEDDING_MODEL از _shared

---

### ۴.۲. قانون ثبات مدل Embedding (Critical Rule)

**یک ثابت، دو مصرف‌کننده — هیچ هاردکد ممنوع:**

```typescript
// _shared/gemini-client.ts
export const EMBEDDING_MODEL = 'text-embedding-004';
```

- `ai-assistant/lib/rag-context.ts` → import از `../../_shared/gemini-client.ts`
- `vectorize/index.ts` → import از `../_shared/gemini-client.ts`
- هرگز نام مدل داخل هیچ فایلی هاردکد نمی‌شود

---

### ۴.۳. قرارداد رفتار خطا (Error Contract)

| ماژول | خطا → رفتار |
|-------|------------|
| `media-handler.ts` | دانلود ناموفق → **throw** (درخواست مدیا بدون مدیا بی‌معنی است) |
| `rag-context.ts` | Embedding یا Search ناموفق → **return `{contextString: '', citations: []}`** (graceful fallback) |
| `meta-context.ts` | DB query ناموفق → **return `""`** (context کاهش می‌یابد نه خرابی کل) |
| `action-processor.ts` | یک اکشن ناموفق → **log + skip** (اکشن‌های دیگر ادامه می‌یابند) |
| `index.ts` | خرابی Gemini generation → **۵۰۰** (قابل retry توسط frontend) |

---

### ۴.۴. جریان داده‌ی بازطراحی‌شده
Request
│
├─[1] Auth Guard ──────────────────────────────── throw 401 on fail
├─[2] Quota Check ─────────────────────────────── return 402 on exceed
├─[3] Media Download (if audio/image) ────────── throw 500 on fail
│
├─[4] Context Building (Promise.all) ─────────── always resolves (fallback to "")
│      ├─ RAG Context (Embedding → hybrid_search)
│      └─ Meta Context (Tasks + Notes + Projects)
│
├─[5] System Prompt Build (pure function) ────── no side effects
├─[6] Gemini Generate ────────────────────────── throw 500 on fail
├─[7] Action Processing (per-action isolation) ─ partial failure OK
│
└─[8] Response

---

### ۴.۵. قرارداد API (بدون تغییر — backward compatible)

```json
{
  "reply": "string",
  "citations": "[{id, type, title, similarity}]",
  "actionResults": "[{type, operation, data}]",
  "proposals": "[{kind, draft, confidence}]",
  "transcription": "string"
}
```

فرانت‌اند هیچ تغییری نمی‌بیند.
---

## ۵. معماری State و ساختار فرانت‌اند

### ۵.۱. لایه‌ی داده (پایان God File و Prop Drilling)
- **`hooks/useDataManager.ts` (پیاده‌سازی واقعی):** مالک state و CRUD همه‌ی entityها (tasks, notes, projects, habits, subscription, usage). شامل: واکشی **صفحه‌بندی‌شده** (`loadInitial(range)` + `loadMore`) به‌جای `Promise.all` انبوه؛ همه‌ی handlerهای `add/update/delete/toggle` (با همان منطق Optimistic + race-guard فعلی)؛ `injectActionResult` برای خروجی AI.
- **`contexts/DataContext.tsx` (جدید):** خروجی `useDataManager` را Provide می‌کند؛ هر feature با `useData()` مصرف می‌کند.
- **`hooks/useRealtimeSync.ts` (جدید):** ۶ کانال Realtime (همه با `filter: user_id=eq.<uid>`) از `App.tsx` خارج و متمرکز؛ dependency فقط `user.id`.
- **State محلی به‌جای گلوبال:** `selectedDate`→Dashboard؛ `chatMessages`→ChatView (از DB)؛ `editingProject`→ProjectsView.

### ۵.۲. درخت فایلِ هدف (Feature-Based)
> این درخت **مقصد مهاجرت** است (پروژه از قبل موجود است). قانون مهاجرت: ابتدا usage جابه‌جا/به‌روز، بعد importِ بلااستفاده حذف شود.
```
/
├── App.tsx                 ← فقط Providers (Auth + Data) + Routing + Global Modals (هدف <۱۰۰ خط)
├── types.ts                ← + EntityLink, ChatSession, ChatMessage, ExtractionProposal, UsageStatus(extended)
│
├── features/
│   ├── auth/        (Auth.tsx, Onboarding.tsx)
│   ├── dashboard/   (Dashboard.tsx + components/{DashboardHeader,WeekCalendar,TodaysPlan,TodaysNotes,QuickCapture,StatsOverview,HabitTracker,KeyProjects}.tsx)
│   ├── tasks/       (TasksView.tsx, TaskCard.tsx, TaskEditorModal.tsx, components/LinkNotePicker.tsx, hooks/useGroupedTasks.ts)
│   ├── notes/       (NotesView.tsx, NoteCard.tsx, NoteEditorModal.tsx, components/LinkTaskPicker.tsx)
│   ├── projects/    (ProjectsView.tsx, ProjectCard.tsx, ProjectDetailsModal.tsx, utils/projectStats.ts)
│   ├── habits/      (HabitEditorModal.tsx)
│   ├── chat/        (ChatView.tsx, components/{CitationCard,ActionResultCard,ModeChip,ProposalCard,ChatHistoryDrawer}.tsx, hooks/useMediaRecorder.ts)
│   └── billing/     (PaywallModal.tsx, ProfileModal.tsx, SubscriptionPage.tsx, RenewReminderModal.tsx, UsageMeter.tsx)
│
├── components/
│   ├── ui/          (Modal.tsx, NetworkBanner.tsx, ToastNotifications.tsx)
│   ├── forms/       (PersianDatePicker.tsx, TimePicker.tsx)
│   ├── layout/      (BottomNav.tsx)
│   └── icons/       (index.ts)
│
├── contexts/        (AuthContext.tsx, DataContext.tsx[جدید])
├── hooks/           (useNetworkStatus.ts, useDataManager.ts[پیاده‌سازی], useRealtimeSync.ts[جدید])
├── services/        (geminiService به‌عنوان تنها لایه‌ی AI؛ حذف triggerVectorization از task/noteService)
└── utils/           (dateUtils.ts, imageUtils.ts[جدید], taskGrouping.ts[جدید])
```

---

## ۶. رجیستر باگ‌های UI/UX (مرجع تسک‌های فرانت)
> اولویت 🔴 بحرانی / 🟠 مهم / 🟡 متوسط. هر مورد در تسک فاز C مربوطه رفع می‌شود.

| # | فایل | باگ | رفع |
|---|------|-----|-----|
| 🔴 | services/supabaseClient.ts | کلید/URL هاردکد | فقط `VITE_*` با fallback ایمن |
| 🔴 | ChatView | حباب RTL برعکس | کاربر→`rounded-tr-none`، AI→`rounded-tl-none` |
| 🔴 | TasksView | دکمه‌ی حذف فقط-hover | همیشه قابل‌دسترس در موبایل |
| 🔴 | ProfileModal | کلاس نامعتبر `w-18` | سایز معتبر (`w-20`) |
| 🔴 | Onboarding | عدم ذخیره‌ی specialty/interests + type mismatch | ذخیره در `profiles` (§۲.۱)، هندلر `MouseEvent` صحیح |
| 🟠 | PersianDatePicker | کلاس نامعتبر `direction-rtl` | `dir="rtl"` |
| 🟠 | ProjectsView | انیمیشن مودال اجرا نمی‌شود + dead code (`handleUpdateNote`) | mount/unmount صحیح، حذف کد مرده |
| 🟠 | ChatView | input بدون `dir="rtl"` + Mode Chips سرریز | `dir="rtl"` + `flex-wrap` |
| 🟠 | Task/NoteEditorModal | کیبورد مجازی محتوا را می‌پوشاند | `dvh`/`100dvh` و اسکرول ایمن |
| 🟠 | Dashboard | scrollbar RTL (`pr-2`) + `todaysProgressStats` مستقل از `selectedDate` | `pl-2` + افزودن `selectedDate` به منطق/deps |
| 🟡 | Dashboard | باگ timezone (UTC vs local با `startsWith`) | `dateUtils` با Asia/Tehran |
| 🟡 | Dashboard | WeekCalendar سرریز ۳۲۰px + hit-area پروگرس‌رینگ کوچک | `min-w-0`/truncation + افزایش ناحیه‌ی کلیک |
| 🟡 | Auth | Native validation انگلیسی | `noValidate` + اعتبارسنجی دستی فارسی |
| 🟡 | PaywallModal | چینش روی صفحه‌ی کوتاه (iPhone SE) | چینش امن |
| 🟡 | ChatView | `compressImage` بدون try/catch | try/catch + پیام فارسی |
| 🟡 | TaskEditorModal | edge case `hasTime` (پیش‌فرض ظهر) | تمایز «بدون ساعت» از «ساعت ۱۲» |
| 🟡 | App | `removeNotification` بدون useCallback | پایداری closure |
