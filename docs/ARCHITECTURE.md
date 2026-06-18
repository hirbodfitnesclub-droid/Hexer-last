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

### ۲.۱. ~~اصلاح `profiles` (افزودن specialty/interests)~~ — Deprecated (لغو شد)
> **وضعیت: منسوخ.** در بازطراحی آنبوردینگ (Educational Walkthrough)، سؤالات «تخصص» و «علایق/وایب» از فلو حذف شدند. بنابراین افزودن ستونهای `specialty` و `interests` **لازم نیست و انجام نمیشود**.
>
> آنبوردینگ جدید فقط «نام و نام خانوادگی» را میگیرد و آن را در ستونِ **از قبل موجودِ** `profiles.full_name` ذخیره میکند. وضعیت دیدهشدن آنبوردینگ هم با ستونِ از قبل موجودِ `profiles.onboarding_completed` کنترل میشود.
>
> **هیچ مایگریشن دیتابیسی برای آنبوردینگ لازم نیست.**

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

### آنبوردینگ (Educational Walkthrough) — منطق مسیردهی

- **محل ماژول:** `features/onboarding/` (همراستا با ساختار feature-based پروژه).
  - `features/onboarding/Onboarding.tsx` — کانتینر/ماشینحالت (`name → choice → slides`). قرارداد props: `{ userId: string; onComplete: () => void }` و خروجی `Onboarding` (named) + `default`.
  - `features/onboarding/components/NameStep.tsx` — گرفتن نام و نام خانوادگی (ترکیب در `full_name`).
  - `features/onboarding/components/WelcomeChoice.tsx` — صفحهی انتخاب «نشونم بده» / «رد شدن».
  - `features/onboarding/components/SlideViewer.tsx` — اسلایدر با `motion` (`AnimatePresence`)، نوار پیشرفت، ناوبری.
  - `features/onboarding/components/SlideCard.tsx` — ارائهی یک اسلاید (presentational).
  - `features/onboarding/data/slides.tsx` — دادهی ۵ اسلاید (آیکونها از `components/icons.tsx`، بدون اموجی).
- **لایهی سرویس:** نوشتن در DB فقط از `services/profileService.ts` انجام میشود؛
  `completeOnboarding(fullName)` ستونهای `{ full_name, onboarding_completed: true }` را روی ردیفِ `profiles` کاربر آپدیت میکند (الگوی `taskService`/`noteService`). کامپوننتها هرگز مستقیم `supabase.from('profiles').update(...)` صدا نمیزنند.
- **گیت آنبوردینگ (بدون تغییر):** `hooks/useDataManager.ts > loadInitial` مقدار `profiles.onboarding_completed` را میخواند؛ اگر `=== false` بود `setIsOnboarding(true)`. در `App.tsx > MainApp` خطِ `if (isOnboarding && user) return <Onboarding .../>` بهعنوان full-screen takeover **قبل از** لِیاوت اصلی (NetworkBanner / viewport / BottomNav / Modalها) رندر میشود؛ پس روی روتینگ و BottomNav اثری ندارد.
- **منبع حقیقت State:** فقط `profiles.onboarding_completed` در Supabase. استفاده از `localStorage` برای این پرچم ممنوع است (Anti-Pattern §۸).
- **حذفشده:** `components/Onboarding.tsx` (آنبوردینگ پروفایلمحور قدیمی) حذف شد؛ تنها مرجع import آن در `App.tsx` به مسیر جدید تغییر کرد.

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




---

## ۷. معماری UI — استانداردها و قراردادها

### ۷.۱. جدول رنگ‌های معتبر Tailwind (سریع‌مرجع)

| مقدار نامعتبر | جایگزین صحیح | توضیح |
|---|---|---|
| `zinc-850`, `zinc-855` | `zinc-900` | کمی تیره‌تر از 800 |
| `zinc-750` | `zinc-800` | بین 700 و 800 |
| `zinc-650` | `zinc-600` | ← از این استفاده کن |
| `zinc-550` | `zinc-500` | |
| `zinc-450` | `zinc-400` | |
| `zinc-350` | `zinc-300` | |
| `neutral-850` | `neutral-900` | |
| `red-650` | `red-600` | |
| `purple-650` | `purple-600` | |
| `z-15` | `z-10` یا `z-20` | |
| `z-45` | `z-40` یا `z-50` | |

### ۷.۲. سلسله مراتب Z-Index (قرارداد پروژه)

| لایه | مقدار | کامپوننت |
|---|---|---|
| Content | default | همه المان‌های عادی |
| Bottom Nav | `z-50` | BottomNav |
| Modals (سطح ۱) | `z-[60]` | TaskEditor, NoteEditor, HabitEditor |
| Modals (سطح ۲) | `z-[70]` | ProjectDetailsModal |
| Critical Modals | `z-[90]` | ProfileModal |
| Full-Screen Overlays | `z-[100]` | PaywallModal, RenewReminderModal |
| Toast/Alerts | `z-[100]` | ToastNotifications |
| Network Banner | `z-[9999]` | NetworkBanner |

> قانون: هر مودالی که Modal دیگری را cover می‌کند باید z-index بالاتری داشته باشد.

### ۷.۳. الگوی استاندارد مودال برای Mobile

مودال‌هایی که از پایین باز می‌شوند باید این ساختار را دقیقاً رعایت کنند:

```jsx
{/* Backdrop */}

  
  {/* Modal Sheet */}
  <div className="flex flex-col w-full max-w-xl
                  h-[100dvh]           {/* ارتفاع کامل viewport داینامیک */}
                  rounded-t-3xl        {/* فقط بالا گرد */}
                  overflow-hidden"     {/* clip محتوا */}
       onClick={e => e.stopPropagation()}>
    
    {/* Header — ثابت، shrink نمی‌شود */}
    
      {/* عنوان + دکمه بستن */}
    
    
    {/* Content — اسکرول‌پذیر، min-h-0 حیاتی است */}
    
      {/* محتوای فرم */}
    
    
    {/* Footer — ثابت، shrink نمی‌شود، pb-safe برای notch */}
    
      {/* دکمه‌های ذخیره/انصراف */}
    
  

```

**چرا `min-h-0` حیاتی است:**  
در `flex-col`، فرزندان flex به صورت پیش‌فرض `min-height: auto` دارند یعنی نمی‌توانند از محتوایشان کوچک‌تر شوند. بدون `min-h-0` روی بخش محتوا، وقتی کیبورد باز می‌شود و viewport کوچک می‌شود، فوتر از صفحه خارج می‌شود.

**چرا `h-[100dvh]` درست است:**  
واحد `dvh` (Dynamic Viewport Height) در مرورگرهای مدرن به کیبورد واکنش نشان می‌دهد — برخلاف `vh` که ثابت است. این باعث می‌شود مودال با باز شدن کیبورد جمع شود و footer همیشه قابل دسترس بماند.

### ۷.۴. Autofill Override (باید در index.css باشد)

```css
/* Override browser autofill white background on dark theme inputs */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
textarea:-webkit-autofill:hover,
textarea:-webkit-autofill:focus,
select:-webkit-autofill,
select:-webkit-autofill:hover,
select:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px #09090b inset !important;
  -webkit-text-fill-color: #ffffff !important;
  caret-color: #ffffff;
  transition: background-color 5000s ease-in-out 0s;
}
```

### ۷.۵. فاصله از Bottom Navigation

هر صفحه‌ای که اسکرول دارد باید `pb-24` داشته باشد تا محتوای انتهایی زیر BottomNav مخفی نشود. مودال‌های `fixed inset-0` این نیاز را ندارند چون خودشان overlay هستند.

### ۷.۶. Safe Area Insets (برای iPhone با Notch/Dynamic Island)

```css
/* در index.css */
:root {
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
}
```

و در Tailwind config یا inline:
```jsx

```

### ۷.۷. رجیستر باگ‌های R11-R14 (اضافه به §۶)

| # | فایل | باگ | راه‌حل |
|---|------|-----|--------|
| 🔴 | `index.css` | autofill browser سفید می‌شود | `-webkit-autofill` override |
| 🔴 | تمام فایل‌های component | `bg-zinc-855`, `z-45`, `dir-rtl` کلاس | جایگزینی سیستماتیک |
| 🔴 | `features/chat/ChatView.tsx` | `Page` enum ایمپورت نشده — runtime error | اضافه کردن import |
| 🟠 | `features/projects/components/ProjectDetailsModal.tsx` | `z-45` invalid، `dir-rtl` بی‌اثر | `z-[70]` و `dir="rtl"` |
| 🟠 | تمام مودال‌ها | `min-h-0` روی content area نیست | افزودن به div اسکرول‌پذیر |
| 🟠 | `features/projects/ProjectsView.tsx` | گرید `md:grid-cols-2 lg:grid-cols-3` در اپ mobile-only | فقط `grid-cols-1` |
| 🟡 | تمام مودال‌ها | z-index سلسله مراتب نامنظم | رعایت جدول §۷.۲ |

---

## ۸. معماری فیچر «کارت به کارت + رسید» (Card-to-Card Technical Architecture)

> این بخش backbone مشترک (DB/Storage/RPC) و سهم **کلاینت** را تعریف می‌کند. سهم پنل ادمین در `docs_of_manager_panel/ARCHITECTURE.md §۶`.
> فایل SQL جدید: `supabase/sql/28_card_to_card_system.sql` (Idempotent، پیشوند `28` تا با `20–27` تداخل نکند). این فایل توسط مالک به‌صورت دستی در SQL Editor اجرا می‌شود.

### ۸.۰. اصل طراحی: دو فلو، یک جدول، صفر آلودگی
درگاه آنلاین زیبال (تایید اتوماتیک) و کارت‌به‌کارت (تایید دستی) روی **همان جدول `payments`** زندگی می‌کنند و فقط با `gateway` و `status` از هم جدا می‌شوند. تفاوت کلیدی **در زمان رزرو کوپن** است:

| فلو | gateway | لحظه‌ی رزرو کوپن (`used_count++`) | فعال‌سازی |
|-----|---------|----------------------------------|-----------|
| آنلاین زیبال | `zibal` | در `activate_subscription` هنگام verify (موجود، دست‌نخورده) | اتوماتیک پس از verify |
| تخفیف ۱۰۰٪ | `bypass` | در `activate_subscription` هنگام verify (موجود) | اتوماتیک، بدون بانک |
| **کارت به کارت** | `card_to_card` | **در لحظه‌ی ثبت** داخل `submit_manual_payment` | دستی توسط ادمین |

> ⚠️ **قانون ضدِ Double-Count:** چون کارت‌به‌کارت کوپن را در *ثبت* رزرو می‌کند، تایید ادمین از RPCِ مجزای `activate_manual_subscription` استفاده می‌کند که **کوپن را لمس نمی‌کند**. هرگز از `activate_subscription` آنلاین برای تایید دستی استفاده نشود.

### ۸.۱. افزوده‌های اسکیما (`payments`)
| ستون/مقدار | نوع | توضیح |
|------------|-----|------|
| `offline_receipt_url` | text null | مسیر رسید در باکت خصوصی `receipts` (نه URL عمومی، نه Base64) |
| `manual_decline_reason` | text null | علت رد توسط ادمین، برای نمایش بنر به کاربر |
| `status = 'pending_manual'` | مقدار جدید | رسید ثبت‌شده، منتظر رسیدگی ادمین. مقادیر قبلی (`pending`/`paid`/`failed`/`canceled`) حفظ می‌شوند |
| `gateway = 'card_to_card'` | مقدار جدید | تفکیک ردیف‌های کارت‌به‌کارت از `zibal`/`bypass` |

- **«رد شده» چگونه نمایش داده می‌شود؟** ردیفی با `gateway='card_to_card'` + `status='failed'` + `manual_decline_reason IS NOT NULL`. (status جدید برای «رد» نمی‌سازیم تا منطق درآمد ادمین ساده بماند.)
- ستون‌های موجود `discount_code_id`, `discount_amount_irr`, `final_amount_irr`, `amount_irr` بدون تغییر استفاده می‌شوند.

### ۸.۲. Storage — باکت خصوصی `receipts`
- ساخت باکت خصوصی `receipts` (الگوی §موجودِ `11_storage.sql`). RLS سراسری `storage.objects` (کلید: `foldername[1] = auth.uid()`) **به‌صورت خودکار** کارت‌به‌کارت را پوشش می‌دهد؛ نیازی به policy جدید نیست.
- ساختار مسیر: `{user_id}/{payment_or_uuid}.jpg`.
- حذف رسید فقط از Edge Function ادمین با `service_role` (bypass RLS) پس از تایید/رد.

### ۸.۳. افزوده‌های RPC (در `28_card_to_card_system.sql`)
همه `SECURITY DEFINER SET search_path = public` و Idempotent (`create or replace`).

| تابع | فراخوان | مسئولیت |
|------|---------|---------|
| `preview_discount(p_plan_code text, p_code text)` | **کلاینت** (read-only) | بدون هیچ نوشتن: اعتبار/انقضا/ظرفیت کوپن را چک و خروجی `(valid bool, reason text, plan_price bigint, discount_amount bigint, final_amount bigint, is_full_discount bool)` می‌دهد. فقط برای branching UI (نمایش «فعال‌سازی رایگان» در برابر دو دکمه‌ی پرداخت). |
| `submit_manual_payment(p_plan_code text, p_code text, p_receipt_path text)` | **کلاینت** | اتمیک: (۱) اگر کاربر یک ردیف `pending_manual` باز دارد → خطا (یک درخواست در جریان). (۲) قیمت پلن را از `plans` می‌خواند. (۳) اگر کوپن بود: `SELECT ... FOR UPDATE` روی `discount_codes`، چک انقضا/ظرفیت، سپس `used_count++` (رزرو). (۴) `final_amount` را حساب می‌کند؛ اگر صفر شد خطا می‌دهد (مسیر ۱۰۰٪ باید bypass باشد نه کارت‌به‌کارت). (۵) ردیف payment با `status='pending_manual'`, `gateway='card_to_card'`, `offline_receipt_url=p_receipt_path`, `user_id=auth.uid()` درج می‌کند. خروجی: `payment_id`. |
| `activate_manual_subscription(p_payment_id uuid)` | **ادمین** (service_role) | اعتبارسنجی `status='pending_manual'`؛ سپس `status='paid'`+`paid_at`، upsert اشتراک `active` و ریست `usage_counters` (دقیقاً مثل بخش ۲–۴ از `activate_subscription`). **کوپن را لمس نمی‌کند** (قبلاً در ثبت رزرو شده). |
| `reject_manual_payment(p_payment_id uuid, p_reason text)` | **ادمین** (service_role) | اعتبارسنجی `status='pending_manual'`؛ `status='failed'`, `manual_decline_reason=p_reason`؛ اگر `discount_code_id` داشت رول‌بک رزرو: `used_count = greatest(0, used_count - 1)`. (حذف فایل رسید کارِ Edge Function است، نه RPC.) |

> `activate_subscription` (آنلاین) و `زیبال` دست‌نخورده می‌مانند. RPCهای ادمین می‌توانند از Edge Function با service_role صدا زده شوند (که RLS را دور می‌زند) و صرفاً برای اتمیک‌بودن داخل RPC کپسوله شده‌اند.

### ۸.۴. سهم کلاینت — لایه‌ی سرویس (`services/billingService.ts`)
متدهای جدید/تغییر‌یافته (امضاها مینیمال و سازگار):
- `startCheckout(planCode, discountCode?)` ← افزودن آرگومان اختیاری `discount_code` و پاس‌دادن آن به `zibal-request` (هم برای آنلاین، هم برای bypass ۱۰۰٪). zibal-request از قبل `{ plan_code, discount_code }` را می‌پذیرد.
- `previewDiscount(planCode, code)` → `supabase.rpc('preview_discount', ...)`.
- `submitManualPayment(planCode, code, file)`:
  1. گارد حجم ورودی (>۲MB → خطای فارسی).
  2. فشرده‌سازی تا <۵۰۰KB با حلقه روی `compressImage` از `utils/imageUtils.ts` (کاهش کیفیت/ابعاد تا رسیدن به آستانه)، سپس `dataURLtoBlob`.
  3. آپلود به `receipts/{uid}/{uuid}.jpg` با `supabase.storage`.
  4. `supabase.rpc('submit_manual_payment', { p_plan_code, p_code, p_receipt_path })`.
- `getManualPaymentState()` → آخرین ردیف `gateway='card_to_card'` کاربر را می‌خواند (RLS فقط ردیف خودش) و وضعیت UI را برمی‌گرداند: `none` | `pending` (`pending_manual`) | `rejected` (`failed` + `manual_decline_reason`).

> همه‌ی فعال‌سازی‌ها سمت سرور نهایی می‌شوند؛ کلاینت فقط `getSubscription`/`getManualPaymentState` را برای نمایش می‌خواند (ضدالگو ۳۲).

### ۸.۵. سهم کلاینت — UI و ماشین وضعیت
ساختار feature-based زیر `features/billing/`:
- **`ProfileModal`** (`components/ProfileModal.tsx`): badge پلن فعلی → دکمه‌ی ورود به اشتراک. به‌جای trigger مستقیم Paywall، مودال جدید اشتراک را باز می‌کند.
- **`SubscriptionModal`** (جدید، `features/billing/components/`): نمای **وضعیت فعلی** (پلن، انقضا، یا «در انتظار تایید»، یا بنر «رد شد + علت») در بالا؛ سپس لیست پلن‌ها با دکمه‌ی **«تمدید»** (اشتراک فعال) یا **«خرید»** (نداشتن/انقضا). در وضعیت `pending` دکمه‌ها قفل‌اند.
- **`PaymentMethodModal`** (جدید): فیلد کد تخفیف → `previewDiscount`. اگر `is_full_discount` → تنها دکمه‌ی **«فعال‌سازی رایگان»** (`startCheckout(plan, code)` → مسیر bypass). در غیر این صورت دو دکمه: **آنلاین** (`startCheckout(plan, code)`) و **کارت به کارت** (باز کردن مودال رسید).
- **`ReceiptUploadModal`** (جدید): نمایش اطلاعات کارت مقصد، فایل‌پیکر (`accept="image/*"`)، گارد ۲MB، پیش‌نمایش، و دکمه‌ی ثبت → `submitManualPayment`. پس از موفقیت، وضعیت `pending` و قفل.
- **State machine نمایش اشتراک:**
  - `active`/`expired` → پلن‌ها با «تمدید»/«خرید».
  - `pending_manual` → فقط «در انتظار تایید»؛ بدون هیچ دکمه (ضدالگو ۳۱).
  - `rejected` → بنر قرمز با `manual_decline_reason`، سپس باز شدن دوباره‌ی خرید.

### ۸.۶. رجیستر باگ/ریسک‌های این فیچر
| اولویت | ریسک | کنترل |
|--------|------|-------|
| 🔴 | Double-count کوپن در تایید دستی | RPC مجزای `activate_manual_subscription` بدون لمس کوپن |
| 🔴 | پر شدن Storage رایگان | فشرده‌سازی <۵۰۰KB + گارد ۲MB + حذف فوری توسط ادمین |
| 🟠 | چند درخواست هم‌زمانِ کاربر | گارد «یک `pending_manual` باز» در `submit_manual_payment` |
| 🟠 | همزمانی ظرفیت کوپن | `SELECT ... FOR UPDATE` در رزرو و رول‌بک |
| 🟡 | عدم تطابق `plan_code` کلاینت با `plans` | فقط plan_codeهای موجود در جدول `plans` استفاده شوند |

---

## ۹. فاز F — نقشه‌ی مهندسی (PWA، باگ‌ها، مصرف، تیکت، RAG پروژه، رفتار AI)

> «چه چیزی/چرا» در `PROJECT.md §۸`. گام‌به‌گام در `tasks.md` (F1–F9). یادآوری قانون SQL: **فایل SQL موجود ویرایش نمی‌شود؛ فایل جدید با پیشوند `31`+ ساخته می‌شود** و مالک آن را دستی در SQL Editor اجرا می‌کند.

### ۹.۰. خلاصه‌ی نگاشت درخواست‌ها به تسک‌ها
| درخواست کاربر | تسک |
|---|---|
| ۱ سافاری + PWA کامل | F1 |
| ۲ اسکرول افقی اشتراک | F3 |
| ۳ جهت آیکون بازگشت RTL | F2 |
| ۴ باگ دکمه‌های حالت AI | F4 |
| ۵ نمایش مصرف (چت + اشتراک) | F3 + F4 |
| ۶ درک عمیق پروژه‌ها (RAG) | F7 + F8 |
| ۷ سیستم تیکت پشتیبانی | F9 |
| ۸ فید شدن لبه‌های لیست | F6 |
| ۹ جایگاه دکمه‌ی لینک تسک↔یادداشت | F5 |
| ۱۰ جلوگیری از پیشنهاد خودسرانه AI | F8 |

### ۹.۱. PWA و رفع باگ سافاری (F1)
- **فایل‌های جدید:**
  - `public/manifest.webmanifest`: `name`, `short_name=Hexer`, `start_url="/"`, `scope="/"`, `display="standalone"`, `orientation="portrait"`, `background_color="#09090b"`, `theme_color="#09090b"`, `dir="rtl"`, `lang="fa"`, آرایه‌ی `icons` شامل `192×192`, `512×512` و یک آیکون `512×512` با `purpose:"maskable"`.
  - `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png` (۱۸۰×۱۸۰). آیکون‌ها با لوگوی اختصاصی هکسر تولید می‌شوند (پس‌زمینه‌ی تیره، تم برند).
  - `public/sw.js`: Service Worker مینیمال. استراتژی **network-first** برای `navigate` و درخواست‌های Supabase/API؛ **cache-first** فقط برای asset‌های ثابت (فونت، آیکون، manifest). نسخه‌بندی cache با ثابت `CACHE_VERSION` و پاک‌سازی کش قدیمی در `activate`. هرگز پاسخ‌های `*.supabase.co` کش نشوند.
- **`index.html`:** افزودن `<link rel="manifest" href="/manifest.webmanifest">`، `<meta name="theme-color" content="#09090b">`، `<meta name="apple-mobile-web-app-capable" content="yes">`، `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`، `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`، و اصلاح viewport به `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- **`index.tsx`:** ثبت Service Worker پس از `load` (`navigator.serviceWorker.register('/sw.js')` با گارد `'serviceWorker' in navigator` و try/catch).
- **رفع باگ هدر سافاری (chrome/address-bar):** ریشه از `h-screen` (`100vh` ثابت) است که با نوار آدرس داینامیک iOS هماهنگ نیست؛ در `App.tsx` کانتینر ریشه به `h-[100dvh]` تغییر کند. در `index.css`: `html, body { height: 100%; overscroll-behavior-y: none; }` و افزودن `--safe-area-inset-*` (اگر نیست). هدرهای `sticky top-0` با ثابت‌شدن ارتفاع ویوپورت دیگر نیاز به اسکرول اولیه ندارند.
- **محدودیت:** بدون افزودن کتابخانه‌ی PWA (مثل workbox)؛ SW دست‌نویس و سبک. هیچ کش تهاجمی (ضدالگو ۳۳/۳۴).

### ۹.۲. جهت آیکون بازگشت RTL (F2)
- ریشه: در RTL، بازگشت باید به **راست** اشاره کند. نمونه‌های خطا: `NoteEditorModal.tsx` از `ChevronDownIcon` با `rotate-90` (به چپ) استفاده می‌کند؛ بررسی `ProjectDetailsModal.tsx` و `MoreCitationsModal.tsx`.
- راه‌حل: استفاده از `ChevronRightIcon` (در `components/icons.tsx` موجود است) برای دکمه‌ی بازگشت RTL؛ حذف ترفند `rotate-90`. ضدالگو ۳۶.

### ۹.۳. باگ دکمه‌های حالت AI (F4)
- ریشه: در `features/chat/ChatView.tsx` کامپوننت `ModeChip` با پراپ `m=` صدا زده می‌شود ولی `ModeChip` پراپ `mode` می‌خواهد → `currentMode === undefined` و highlight شکسته. همچنین کلاس نامعتبر `ring-sky-450/55` در `ModeChip.tsx`.
- راه‌حل: تصحیح فراخوانی به `mode=`؛ اصلاح کلاس به `ring-sky-400/50`. تضمین «دقیقاً یک حالت فعال» با کنتراست بصری واضح (ضدالگو ۲۲ و ۳۷).

### ۹.۴. نمایش مصرف (F3 + F4)
- کامپوننت `UsageMeter` (موجود در `features/billing/components/UsageMeter.tsx`) از RPCهای `get_usage_status` و `get_daily_usage` تغذیه می‌شود و قبلاً فقط در `SubscriptionPage` استفاده شده.
- **اشتراک (F3):** افزودن `UsageMeter` به بالای `SubscriptionModal` در حالت عادی/active (نه در حالت `pending` قفل‌شده).
- **چت (F4):** یک نمای **فشرده** از مصرف در هدر `ChatView` یا حالت empty-state. برای جلوگیری از تکرار کوئری، یا یک پراپ `compact` به `UsageMeter` افزوده شود یا یک کامپوننت سبک `UsagePill` که فقط `get_usage_status` را می‌خواند. کوئری نباید در رندر لوپ شود (deps پایدار، ضدالگو ۳).

### ۹.۵. اسکرول افقی اشتراک (F3)
- منابع محتمل بیرون‌زدگی: گریدهای دسکتاپ‌محور (`md:grid-cols-2 lg:grid-cols-4` در `SubscriptionPage`)، عرض‌های ثابت، اعداد `font-mono` طولانی بدون شکست، و نبود `overflow-x-hidden` روی ویوپورت اصلی (`App.tsx` → `<main>`).
- راه‌حل: حذف گریدهای دسکتاپ در اپ mobile-only (فقط `grid-cols-1`)، افزودن `min-w-0`/`max-w-full`/`break-words` به کارت‌ها و باکس فاکتور، و `overflow-x-hidden` روی `<main>` در `App.tsx`. ممیزی `SubscriptionModal`, `PaymentMethodModal`, `ReceiptUploadModal`. ضدالگو ۳۵/۲۶.

### ۹.۶. جایگاه دکمه‌ی لینک تسک↔یادداشت (F5)
- وضعیت فعلی: `LinkNotePicker` فقط در **حالت view** و فقط برای آیتم موجود (`!isNew`) در `TaskEditorModal` نمایش داده می‌شود؛ در حالت ساخت/ویرایش فرم در دسترس نیست. مشابهاً `LinkTaskPicker` در `NoteEditorModal` انتهای canvas است.
- راه‌حل UX: انتقال بخش لینک به **داخل فرم اصلی (edit mode)** در جایگاهی منطقی (پس از فیلدهای اصلی، کنار انتخاب پروژه). برای آیتم جدیدی که هنوز `id` ندارد، یا لینک پس از اولین ذخیره فعال شود یا بخش لینک به‌صورت غیرفعال با راهنمای کوتاه نمایش داده شود. اتصال‌ها همچنان از `services/linkService.ts` (`linkTaskNote`/`unlinkTaskNote`/`getLinked*`) انجام می‌شوند. بدون تغییر بک‌اند.

### ۹.۷. فید شدن لبه‌های لیست‌های اسکرول‌خور (F6)
- هدف: محو نرم (fade) لبه‌های بالا/پایین نواحی اسکرول در `NotesView`, `ProjectsView` (و در صورت نیاز `TasksView`) به‌جای کات سخت.
- راه‌حل: کلاس کمکی در `index.css` با `mask-image: linear-gradient(...)` (و `-webkit-mask-image`) روی کانتینر اسکرول، یا overlay‌های gradient ثابت `pointer-events-none` در بالا/پایین. باید با پس‌زمینه‌ی واقعی هر صفحه (`zinc-950`/`slate-950`) هماهنگ باشد و عملکرد اسکرول/کلیک را خراب نکند.

### ۹.۸. RAG و درک عمیق پروژه‌ها (F7 backend + F8 context)
**F7 — دیتابیس و وکتورایز (فایل جدید `supabase/sql/31_rag_projects.sql`):**
- افزودن ستون `embedding vector(768)` به `projects` (مثل tasks/notes).
- تریگر `enqueue_vectorize` روی `projects` (الگوی موجود `22_fix_vectorize_webhook.sql`) که با `type='project'` به تابع `vectorize` پیام می‌دهد. (کلاینت هرگز مستقیم — ضدالگو ۴۰/۱۵.)
- بازنویسی `hybrid_search` (فایل جدید، مثل `26_update_hybrid_search.sql`) برای افزودن `UNION ALL` پروژه‌ها: `type='project'`, `snippet = COALESCE(description,'')`, با همان آستانه‌ها و RFF و `where user_id = auth.uid()`.
- `NOTIFY pgrst, 'reload schema';` در انتها.
- **`supabase/functions/vectorize/index.ts`:** افزودن شاخه‌ی `type==='project'` → `table='projects'`, `combinedText = title + ' ' + description`.

**F8 — زمینه و Intent (Edge `ai-assistant`):**
- **`lib/meta-context.ts`:** هنگام واکشی پروژه‌ها، علاوه بر `id,title` فیلد `description` نیز خوانده و **خلاصه‌ای** از هدف هر پروژه به context افزوده شود تا AI «هدف پروژه» را بفهمد (برای لینک نوت/تسک به پروژه‌ی درست).
- **`lib/system-prompt.ts`:**
  - معرفی پروژه‌ها به‌عنوان موجودیت قابل‌مرجع و امکان نسبت‌دادن آیتم به پروژه‌ی مرتبط.
  - **Intent-gating (ضدالگو ۳۸):** قانون صریح که `SUGGEST_LINK` و پیشنهاد دیتای مرتبط فقط هنگام نیت آشکارِ جستجو/پیدا کردن/ساختن/پیگیری/لینک مجاز است؛ در گفت‌وگوی معمولی هیچ پیشنهاد اضافه تولید نشود. (دستور فعلی `SUGGEST_LINK` تا حدی این را دارد؛ باید سخت‌گیرتر و شامل تحلیل Intent اولیه شود.)
- **`lib/action-processor.ts`:** چون `hybrid_search` اکنون پروژه هم برمی‌گرداند، `SUGGEST_LINK` می‌تواند `type='project'` نیز تولید کند؛ مدیریت ایمن این نوع در نتایج (بدون شکستن مسیرهای task/note).
- قرارداد API بدون تغییر؛ فرانت‌اند تغییر اجباری نمی‌بیند (citations ممکن است `type='project'` داشته باشد → مدیریت کلیک امن در `ChatView`/`CitationCard`).

### ۹.۹. سیستم تیکت پشتیبانی (F9)
> الگوی مرجع: «فیش‌های بانکی» (جدول + RLS مالک‌محور + تریگر تلگرام + اکشن `admin-api`). فایل SQL جدید: `supabase/sql/32_support_tickets.sql` (Idempotent، اجرای دستی).

**۹.۹.۱. اسکیما — `support_tickets`:**
| ستون | نوع | توضیح |
|------|-----|------|
| id | uuid PK default gen_random_uuid() | |
| user_id | uuid not null FK→auth.users | RLS |
| subject | text not null | عنوان تیکت |
| message | text not null | توضیحات |
| status | text default 'open' check in ('open','closed') | |
| created_at | timestamptz default now() | ایندکس `(user_id, created_at)` |

- **RLS فعال:** `auth.uid() = user_id` برای SELECT/INSERT مالک. بدون UPDATE/DELETE کلاینت (مدیریت با ادمین). ضدالگو ۱/۳۹.
- **تریگر تلگرام:** تابع `notify_telegram_on_new_ticket()` دقیقاً مثل `notify_telegram_on_manual_payment` در `30_telegram_notifications.sql` — خواندن `telegram_settings` (همان جدول)، ساخت پیام HTML فارسی (نام کاربر از `profiles`، عنوان، خلاصه‌ی متن)، و `net.http_post` غیرمسدودکننده به `sendMessage`. تریگر `AFTER INSERT ON public.support_tickets`.
- `NOTIFY pgrst, 'reload schema';`.

**۹.۹.۲. پنل ادمین — `supabase/functions/admin-api/index.ts`:**
- افزودن اکشن `list_tickets` (الگوی `list_manual_payments`): واکشی `support_tickets` + join دستی با `profiles` برای نمایش نام/ایمیل کاربر. (اکشن `close_ticket` اختیاری برای آینده.) توکن تلگرام فقط سمت سرور.

**۹.۹.۳. کلاینت:**
- **`services/ticketService.ts` (جدید):** `submitTicket(subject, message)` → یا INSERT مستقیم با RLS مالک، یا RPC `submit_ticket` (ترجیح: INSERT مستقیم چون policy مالک کافی است). و `getMyTickets()` اختیاری.
- **`components/SupportTicketModal.tsx` (جدید):** فرم عنوان + توضیحات، اعتبارسنجی، ارسال، پیام موفقیت Toast. علاوه بر دکمه‌ی ثبت، یک دکمه‌ی **«گفتگو در تلگرام»** که لینک مستقیم چت تلگرامی پشتیبانی را در تب جدید باز می‌کند (آیدی تلگرام پشتیبانی به‌صورت ثابت/کانفیگ کلاینت؛ نه توکن بات).
- **`components/ProfileModal.tsx`:** افزودن آیتم «پشتیبانی و ارسال تیکت» که `SupportTicketModal` را باز می‌کند (جایگزین یکی از placeholderهای غیرفعال فعلی).
- z-index طبق §۷.۲ (مودال روی ProfileModal `z-[90]` → تیکت `z-[100]`+).

### ۹.۱۰. رجیستر باگ‌های فاز F (افزوده به §۶ و §۷.۷)
| # | فایل | باگ | رفع |
|---|------|-----|-----|
| 🔴 | `App.tsx` | `h-screen` (۱۰۰vh ثابت) → هدر سافاری تا اسکرول نچسبد | `h-[100dvh]` + overscroll در `index.css` |
| 🔴 | `features/chat/ChatView.tsx` | `ModeChip` با `m=` صدا زده می‌شود (حالت فعال خراب) | تصحیح به `mode=` |
| 🔴 | `features/chat/components/ModeChip.tsx` | کلاس نامعتبر `ring-sky-450/55` | `ring-sky-400/50` |
| 🟠 | `features/billing/pages/SubscriptionPage.tsx` | گرید دسکتاپ `md:/lg:` در اپ mobile-only + بیرون‌زدگی عرضی | `grid-cols-1` + `min-w-0`/`overflow-x-hidden` |
| 🟠 | `features/notes/components/NoteEditorModal.tsx` | آیکون بازگشت با `rotate-90` به چپ اشاره می‌کند (RTL) | `ChevronRightIcon` |
| 🟠 | `features/tasks/components/TaskEditorModal.tsx` | دکمه‌ی لینک یادداشت فقط در view-mode/آیتم موجود | انتقال به فرم اصلی |
| 🟡 | `features/notes/NotesView.tsx`, `features/projects/ProjectsView.tsx` | کات سخت لبه‌های اسکرول | fade با mask/gradient |
| 🟡 | `features/tasks/components/LinkNotePicker.tsx` | کلاس نامعتبر `text-zinc-350` | `text-zinc-300` |

### ۹.۱۱. مهاجرت به شماره همراه و رمز عبور (Phone Number + Password)

در راستای سهولت ورود کاربران و استفاده از شماره موبایل به عنوان شناسه هویتی اصلی، سیستم احراز هویت از ایمیل محور به ساختار شماره همراه و رمز عبور با پلتفرم پیامکی کاوه‌نگار مهاجرت کرد:

۱. **جریان ثبت‌نام (Sign Up):**
   - دریافت شماره همراه و رمز عبور در کلاینت.
   - ارسال کد تأیید (OTP) از طریق Edge Function هوشمند به آدرس `supabase/functions/sms-hook/index.ts` با یک وب‌هوک متصل به‌وسیله‌ی قالب احراز هویت کاوه‌نگار (`hexer-verify`).
   - تایید ثبت‌نام با اکشن `supabase.auth.verifyOtp` و نوع تایید `sms`.

۲. **جریان ورود (Login):**
   - ورود مستقیم صرفاً بر اساس شماره موبایل و رمز عبور تعیین شده در ثبت‌نام (عدم نیاز به OTP جدید).

۳. **جریان فراموشی رمز عبور (Reset Password):**
   - ارسال OTP بازیابی رمزعبور به شماره موبایل کاربر و امکان ریست کردن رمز عبور.

۴. **توسعه‌پذیری نمایش مشخصات کاربر در کلاینت:**
   - با توجه به اینکه برخی کاربران ممکن است فیلد `email` نداشته باشند و شناسه هویتی اصلی آن‌ها `phone` باشد، در تمامی بخش‌های فرانت‌اند که از مشخصات کاربر برای UI (هدر، آواتار و مودال پروفایل) استفاده می‌شد، تمهیدات لازم جهت استفاده از `user?.phone` به عنوان جایگزین در صورت عدم وجود `user?.email` پیش‌بینی و پیاده‌سازی شده است:
     - **آیکون آواتار هدر (`DashboardHeader.tsx`):**
       `{user?.email?.[0]?.toUpperCase() || user?.phone?.[0] || <UserIcon className="w-5 h-5"/>}`
     - **پرتره و آواتار بزرگ مودال پروفایل (`ProfileModal.tsx`):**
       `{user?.email?.[0]?.toUpperCase() || user?.phone?.[0] || <UserIcon className="w-8 h-8"/>}`
     - **نمایش آی‌دی کاربری یا آدرس مخاطب (`ProfileModal.tsx`):**
       `{user?.email || user?.phone || 'کاربر مهمان'}`


---

# ۱۰. فاز G — نقشه‌ی مهندسی (نوتیفیکیشن، آکاردئون، مودال موقت، لینک، عادات)

> پروژه از‌قبل موجود است؛ کل درخت فایل دوباره رسم نمی‌شود. در ادامه فقط **منطق مسیردهی** و **مسیر دقیقِ فایل‌های جدید/ویرایش‌شده** برای هر تسک می‌آید. قواعد عمومی مسیردهی همچنان: کامپوننت‌های هر فیچر در `features/<name>/components/`، توابع خالص در `utils/`، هوک‌ها در `hooks/`، لایه‌ی سرویس در `services/`، SQL شماره‌دار و Idempotent در `supabase/sql/`، توابع لبه در `supabase/functions/<name>/index.ts` (اجرای دستی، بدون CLI).

## ۱۰.۰. وضعیت موجودِ مرتبط (Snapshot — برای زمینه)
- جدول `reminders` و RLS آن از‌قبل در `supabase/sql/05_reminders.sql` ساخته شده (`remind_at`, `type`, `is_sent`, `is_read`, `related_entity_type/id`).
- `services/reminderService.ts` از‌قبل `requestNotificationPermission()` و `sendBrowserNotification()` (Notification API، `dir:'rtl'`) دارد.
- `public/sw.js` (نسخه‌بندی‌شده، استراتژی network-first/cache-first) موجود است اما **هیچ هندلر `push`/`notificationclick` ندارد**.
- زیرساخت `net.http_post` (pg_net) از‌قبل در `30_telegram_notifications.sql` استفاده شده ⇒ pg_net فعال است.
- `linkService.ts` و RPCهای `link_task_note`/`unlink_task_note`/`get_linked_notes`/`get_linked_tasks` موجود و معتبرند.
- `habit_completions` (date به فرمت `YYYY-MM-DD`) و `habitService.getHabits()` که `completedDates` کاملِ هر عادت را برمی‌گرداند، موجودند ⇒ تسک ۵ **نیازی به مهاجرت دیتابیس ندارد**.

---

## ۱۰.۱. تسک ۱ — سیستم نوتیفیکیشن هوشمند (Smart Reminders)

### معماری دولایه
- **لایه A (Foreground / On-Open) — تضمینی:** هوک `hooks/useReminderScheduler.ts` هنگام mount و روی رویدادهای `visibilitychange`/`online`، تسک‌های امروز را از state می‌خواند:
  - تسک‌های امروزِ **زمان‌دار** (`due_date` دارای جزء ساعت): برای هر کدام که هنوز در آینده‌ی امروز است یک `setTimeout` تا لحظه‌ی دقیق تنظیم و سرِ ساعت با `registration.showNotification(title, {body, dir:'rtl', tag})` نمایش داده می‌شود.
  - تسک‌های امروزِ **بدون‌ساعت**: «تلنگر روزانه» — اگر امروز (به وقت Tehran) هنوز تلنگری نخورده و از آستانه‌ی زمانیِ مناسب گذشته‌ایم، یک نوتیفیکیشن کلیِ صمیمی نمایش و در `localStorage` ثبت می‌شود.
- **لایه B (Background Web Push) — ارتقا:** وقتی سایت بسته است اما مرورگر باز است. مسیر: `pushManager.subscribe({applicationServerKey: VAPID_PUBLIC})` ⇒ ذخیره‌ی subscription در DB ⇒ Edge `push-dispatch` (با زمان‌بند) موارد سررسیده را اسکن و Web Push می‌فرستد ⇒ هندلر `push` در `sw.js` نوتیفیکیشن را نشان می‌دهد. در نبودِ پشتیبانی، فقط لایه A فعال می‌ماند.

### Schema Δ — `supabase/sql/34_push_subscriptions.sql` (جدید، Idempotent)
```sql
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- RPC امن برای upsert subscription از کلاینت
create or replace function public.upsert_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end; $$;
notify pgrst, 'reload schema';
```

### Schema/Cron Δ — `supabase/sql/35_reminder_dispatch.sql` (جدید، Idempotent)
- یک VIEW/تابع برای یافتنِ تسک‌های زمان‌دارِ سررسیده‌ی پنجره‌ی جاری (join با `push_subscriptions`) و دِدوپ با کمک `reminders.is_sent`.
- زمان‌بندی با `pg_cron` که هر دقیقه Edge `push-dispatch` را با `net.http_post` صدا می‌زند (هم‌سبک با تریگر تلگرام).

### Edge — `supabase/functions/push-dispatch/index.ts` (جدید)
- با `service_role`، موارد سررسیده + تلنگر روزانه را جمع و با پروتکل Web Push (VAPID از `Deno.env`) به subscriptionها می‌فرستد؛ سپس `is_sent=true`. کلید خصوصی فقط اینجا.

### SW Δ — `public/sw.js` (ویرایش)
- افزودن `self.addEventListener('push', ...)` (نمایش با داده‌ی payload، `dir:'rtl'`) و `notificationclick` (focus/باز کردن `'/'` و مسیردهی به تسک). بامپ `CACHE_VERSION`.

### Client Δ
- ویرایش `services/reminderService.ts`: افزودن `subscribeToPush(vapidPublicKey)`، `saveSubscription()` (صدا زدن RPC `upsert_push_subscription`)، و `showViaSW(title, body)`.
- جدید `utils/notificationCopy.ts`: توابع خالص بازگرداننده‌ی متنِ تلنگر صمیمی (آرایه‌ی کوچک چرخشی؛ مثل «رفیق یه سر به هکسر بزن، کارای امروزت منتظرن!»).
- جدید `hooks/useReminderScheduler.ts`: منطق لایه A.
- ویرایش `App.tsx`: mount هوک + درخواست permission در لحظه‌ی طبیعی (نه روی لود اولیه‌ی خشک).

---

## ۱۰.۲. تسک ۲ — آکاردئون لیست پروژه‌ها

### منطق مسیردهی
- صفحه‌ی مرجع: `features/projects/ProjectsView.tsx` (هم‌اکنون `ProjectCard`های خلاصه را map می‌کند و تسک‌ها در `ProjectDetailsModal` دیده می‌شوند).
- **جدید:** `features/projects/components/ProjectAccordionItem.tsx` — هدرِ قابل‌کلیک (نقطه‌ی رنگ پروژه + نام + `ChevronDownIcon` با چرخش + شمارنده‌ی تسک از `calculateProjectStats`) و بدنه‌ی collapsible که لیستِ inlineِ فشرده‌ی تسک‌های همان پروژه را نشان می‌دهد (چک‌باکس toggle + کلیک برای باز کردن `TaskEditorModal`).
- **ویرایش `ProjectsView.tsx`:** نگه‌داری `expandedIds: Set<string>` (پیش‌فرض **خالی** ⇒ همه بسته)؛ map روی `ProjectAccordionItem` به‌جای `ProjectCard`؛ فیلتر تسک‌ها با `task.project_id === project.id`؛ گروهِ اختیاریِ «بدون پروژه» در انتها. وضعیت expanded اختیاری در `localStorage` (UI-only) ماندگار می‌شود.
- دسترس‌پذیری: `aria-expanded`، tap target ≥ ۴۴px، انیمیشن باز/بسته با کلاس‌های موجود.

---

## ۱۰.۳. تسک ۳ — سیستم مودال‌های موقت (Announcements)

### منطق مسیردهی و کشف خودکار
- پوشه‌ی اختصاصی: `features/announcements/TemporaryModals/` — هر فایل `*.tsx` مستقیماً داخل آن = **فعال**.
- زیرپوشه‌ی آرشیو: `features/announcements/TemporaryModals/archive/` — نادیده گرفته می‌شود (به‌خاطر الگوی **غیربازگشتیِ** glob).
- کشف: `import.meta.glob('./TemporaryModals/*.tsx', { eager: true })` در `AnnouncementManager`. هر ماژول `export default` (کامپوننت) و `export const meta = { id, version, priority?, startsAt?, endsAt? }` دارد.

### فایل‌ها (جدید)
- `features/announcements/AnnouncementManager.tsx` — کنترلر: جمع‌آوری ماژول‌های فعال، اعمال سیاست نمایش، رندر مودالِ منتخب با `components/Modal.tsx`.
- `features/announcements/config.ts` — ۳ بازه‌ی زمانیِ Asia/Tehran (مثلاً صبح/بعدازظهر/شب) + `MAX_PER_DAY = 3`.
- `features/announcements/storage.ts` — هلپرهای `localStorage` کلید‌خورده با `getTehranDateString` (impression در هر بازه + `dismissedIds` با version).
- `features/announcements/types.ts` — تایپ `AnnouncementMeta`.
- `features/announcements/TemporaryModals/_Example.tsx` — نمونه‌ی الگو.
- `features/announcements/TemporaryModals/archive/.gitkeep`.

### سیاست نمایش (Display Policy)
- هنگام ورود به اپ: بازه‌ی زمانیِ جاری محاسبه می‌شود؛ اگر آن بازه امروز هنوز نمایش نداده و مودالِ واجدِ شرایطی (نه آرشیو، داخل بازه‌ی تاریخیِ اختیاری، نه قبلاً «دیگر نشان نده» شده) موجود است، نمایش و impression آن بازه ثبت می‌شود. سقف کل = ۳ impression/روز (یکی در هر بازه).
- انتخاب بین چند مودال فعال: بر اساس `priority` سپس `version`/تازگی.

### ویرایش
- `App.tsx`: mount `<AnnouncementManager />` در ریشه‌ی `MainApp` (هم‌تراز سایر مودال‌های سراسری).

---

## ۱۰.۴. تسک ۴ — بازطراحی فلوی لینک تسک↔یادداشت

### ریشه‌ی باگ‌ها و قرارداد جدید
- **`hooks/useDataManager.ts` (ویرایش):** `addTask` و `addNote` باید موجودیتِ ساخته‌شده را `return` کنند (`return newTask;` / `return newNote;`). امروز برنمی‌گردانند ⇒ فلوی ایجاد نمی‌تواند روی `id` واقعی لینک بزند.
- **`App.tsx` و `features/projects/ProjectsView.tsx` (ویرایش):** هندلرهای save مودال‌ها مقدارِ برگشتیِ موجودیتِ ذخیره‌شده را `return`/`await` کنند تا به مودال برسد (`onSave: (e) => Promise<Task|Note>`).
- **Pickerها (ویرایش `features/tasks/components/LinkNotePicker.tsx` و `features/notes/components/LinkTaskPicker.tsx`):** به الگوی «انتخاب‌گرِ ارائه‌ای» refactor شوند — به‌جای صدا زدن مستقیم `linkService`، یک callbackِ `onSelect(item)` بدهند. تصمیم persistence به مودال منتقل می‌شود.

### فلوی ایجاد (هر دو مودال)
- state محلی `pendingLinkIds`. در حالت new، انتخاب در picker فقط `pendingLinkIds` را پر می‌کند (بدون DB) و آیتم‌ها به‌صورت چیپِ «در انتظار» نمایش می‌یابند. هنگام Save: `const saved = await onSave(formState); if (isNew && saved?.id) await Promise.all(pendingLinkIds.map(id => linkService(saved.id, id)));`. در حالت ویرایش، رفتار فعلی (linkService فوری) حفظ می‌شود.

### جایگاه UI (فقط مودال یادداشت)
- **`features/notes/components/NoteEditorModal.tsx` (ویرایش):** بلوک «کارهای لینک‌شده + LinkTaskPicker» از میان عنوان و `textarea` بدنه **خارج** و به ناحیه‌ی متادیتای پایین (Control Center، کنار تگ‌ها و انتخاب‌گر پروژه) منتقل شود؛ هم‌ساختار با `TaskEditorModal`. ناحیه‌ی نوشتن = فقط عنوان + بدنه.

> ترتیب اجرا: G4.1 (لایه‌ی داده) باید **پیش از** G4.2/G4.3 انجام شود چون فایل‌های مشترک (`useDataManager`, `App.tsx`, `ProjectsView`) را لمس می‌کند.

---

## ۱۰.۵. تسک ۵ — داشبورد و مدیریت جامع عادات

### بدون مهاجرت DB
- `habit_completions` و `habitService.getHabits()` (که `completedDates` کامل را برمی‌گرداند) کفایت می‌کنند.

### فایل‌ها
- **جدید `utils/habitStats.ts` (توابع خالص، Tehran-aware):** `computeStreaks` (جاری/بهترین)، `weekdayBreakdown` (نرخ موفقیت در هر روز هفته)، `monthlyTrend` (تعداد در N ماه اخیر)، `weeklyHeatmap` (شبکه‌ی ~۱۲ هفته‌ی اخیر، سبکِ contribution-grid). همه با `getTehranDateString`/`utils/dateUtils.ts`.
- **جدید `features/habits/components/HabitStatsView.tsx`:** ارائه‌ی آماری با **SVG/CSS سبک** (بدون کتابخانه‌ی چارت): heatmap، میله‌های ماهانه، نوار روزهای هفته، streak.
- **جدید `features/habits/components/HabitForm.tsx`:** استخراج فرمِ ویرایش از `HabitEditorModal` فعلی (نام/تکرار/تعداد/توضیح) برای استفاده‌ی مشترک در ایجاد و تب ویرایش.
- **جدید `features/habits/components/HabitManagerModal.tsx`:** ظرف اصلی — حالت new ⇒ فقط `HabitForm`؛ حالت موجود ⇒ تب‌های «آمار» (`HabitStatsView`) و «مدیریت» (`HabitForm` + حذف کامل با تأیید). استفاده از `habitService` (نه supabase مستقیم در کامپوننت).

### مسیردهی/ویرایش
- **`App.tsx` (ویرایش):** مودالِ سراسریِ `editingHabit` از `HabitEditorModal` به `HabitManagerModal` سوییچ شود (همان state `editingHabit`/`setEditingHabit` از `DataContext`).
- **`features/dashboard/components/HabitTracker.tsx`:** بدون تغییرِ منطقی لازم — همان `editHabit(habit)` اکنون مدیر جدید را باز می‌کند.
- `components/HabitEditorModal.tsx` و نسخه‌ی فیچرِ قدیمی پس از استخراج فرم، می‌توانند منسوخ/حذف‌ـازـمسیر شوند (بدون شکستن import در `App.tsx`).

## ۱۰.۶. هم‌زمانی و نقاط داغِ مشترک (Conflict Map)
- **`App.tsx`** توسط G1.5، G3، G4.1 و G5 لمس می‌شود ⇒ این تسک‌ها روی `App.tsx` **سریال** اجرا شوند (هرگز موازی).
- G2 (پروژه‌ها)، G3 (announcements به‌جز mount در App)، و G5 (به‌جز App) عمدتاً فایل‌های مجزا دارند و پس از آزاد شدنِ `App.tsx` می‌توانند مستقل پیش بروند.
- G4.2 و G4.3 پس از G4.1 فایل‌های مجزا دارند (مودال/پیکر مختص خود) و می‌توانند موازی شوند.


---

# ۱۱. فاز H — نقشهٔ مهندسی (نوتیفیکیشنِ پایدار، آفلاین/PWA، پرفورمنسِ لود)

> پروژه از قبل موجود است؛ کلِ درختِ فایل دوباره ترسیم نمی‌شود. فقط منطقِ مسیردهی و مسیرِ دقیقِ فایل‌های جدید/ویرایش‌شده ذکر می‌شود. جزئیات قابلِ پیاده‌سازی در `tasks.md` (H1–H12).

## ۱۱.۰. وضعیت موجودِ مرتبط (Snapshot — برای زمینه، نه تغییر)
- **نوتیفیکیشن:** `hooks/useReminderScheduler.ts` (Foreground/setTimeout + nudge) · `services/reminderService.ts` (permission, subscribe, `showViaSW`, `saveSubscription`) · `public/sw.js` (push + showNotification) · `supabase/functions/push-dispatch/index.ts` (دیسپچِ سرور) · `supabase/sql/34_push_subscriptions.sql` · `supabase/sql/35_reminder_dispatch.sql` + `35.5` (view/cron). اتصالِ Push در `App.tsx` (با تأخیرِ ۳ ثانیه). لیسنرِ `reminders` در `hooks/useRealtimeSync.ts`.
- **آفلاین:** `hooks/useNetworkStatus.ts` + `components/NetworkBanner.tsx` (فقط نشانگر، بدون منطق) · `services/supabaseClient.ts` · لایهٔ CRUDِ خوش‌بینانه در `hooks/useDataManager.ts`.
- **پرفورمنس:** `loadInitial` در `hooks/useDataManager.ts` (Promise.all ۷تایی، بدون limit) · `services/{task,note,project,habit}Service.ts` (`select('*')`) · `index.html` (importmap + Tailwind CDN) · `vite.config.ts` (بدون Tailwind/code-split).
- **اسکیما:** `tasks(embedding vector(768))`, `notes(embedding ...)`, ایندکس‌های `idx_*_user_id`؛ بدونِ ایندکسِ ترکیبیِ `(user_id, created_at)` یا `(user_id, due_date)`.

---

## ۱۱.الف. بازطراحیِ نوتیفیکیشن — معماری دو-لایهٔ «بدون شکاف»

**اصلِ طراحی:** جدولِ `reminders` = **دفترِ کلِ یکتا (Outbox/Ledger)**. هر دو لایه با همین دفتر dedup می‌شوند. سرور موتورِ قطعیِ «اپ‌بسته» است؛ Foreground بهبودِ «اپ‌باز» است. هیچ نوتیفیکیشنی دوبار شلیک نمی‌شود.

### ۱۱.الف.۱. لایهٔ سرور (وقتی اپ بسته است) — تثبیتِ خطِ دیسپچ
فایلِ جدید (Idempotent): **`supabase/sql/41_fix_push_dispatch_transport.sql`**
- `create extension if not exists pg_net;` و `create extension if not exists pg_cron;`.
- ذخیرهٔ امنِ آدرس و سرویس‌کی در **Supabase Vault** (`vault.create_secret(...)` برای `project_url` و `service_role_key`) و خواندنِ آن‌ها داخلِ بدنهٔ کرانه از `vault.decrypted_secrets` — جایگزینِ `current_setting('app.settings.*')` که روی میزبان ست نیست.
- `cron.unschedule('push-dispatch-cron')` در بلاک ایمن، سپس `cron.schedule('push-dispatch-cron','* * * * *', ...)` که با `net.http_post` و هدرِ `Authorization: Bearer <service_role_key از Vault>` فانکشن را صدا می‌زند.
- جدولِ مشاهده‌پذیری: `create table if not exists public.push_dispatch_log(id, ran_at, sent_count, failed_count, cleaned_count, notes)` با RLS بسته (فقط service_role). `push-dispatch` در پایانِ هر اجرا یک ردیف لاگ می‌نویسد.
- ایندکسِ کمکیِ view: `create index if not exists idx_tasks_due_pending on public.tasks(due_date) where completed_at is null;`.
- **تذکرِ اجرا (در همان فایل کامنت):** کاربر باید در داشبوردِ Supabase اکستنشن‌های `pg_cron` و `pg_net` را فعال کند و سکرت‌های Vault را یک‌بار ست کند. این فایل دستی و idempotent اجرا می‌شود (طبق قانونِ §۲ بک‌اند).

ویرایشِ **`supabase/functions/push-dispatch/index.ts`:** بدون تغییرِ منطقِ اصلی، افزودنِ نوشتنِ `push_dispatch_log` و شمارشِ دقیقِ `sent/failed/cleaned`. منطقِ پاک‌سازیِ ۴۱۰/۴۰۴ و dedup با جدولِ `reminders` حفظ می‌شود.

### ۱۱.الف.۲. کلید VAPID — منبعِ واحد (رفعِ ریشهٔ «شانسی»)
ویرایشِ **`App.tsx`** و **`services/reminderService.ts`:**
- حذفِ کاملِ کلیدِ عمومیِ هاردکدِ fallback. کلید فقط از `import.meta.env.VITE_VAPID_PUBLIC_KEY`.
- اگر env تعریف نشده باشد → `setupPushManager` بدونِ subscribe برمی‌گردد و فقط لاگِ هشدار می‌زند (افتِ تدریجی به Foreground).
- **قانونِ مستندِ استقرار (کامنت در کد + `tasks.md`):** `VITE_VAPID_PUBLIC_KEY` (کلاینت) و `VAPID_PRIVATE_KEY` (Edge) باید یک **جفتِ کلیدِ واحد** باشند (با `web-push generate-vapid-keys` ساخته شوند). اگر این جفت ناهماهنگ شود، تمامِ Push با ۴۰۳ رد می‌شود.

### ۱۱.الف.۳. زمانِ درخواستِ مجوز (رفعِ خطاهای خاموشِ iOS)
- حذفِ `requestNotificationPermission()` از `loadInitial` در `useDataManager.ts` (درخواستِ تکراریِ بدونِ gesture).
- درخواستِ مجوز فقط با **gestureِ صریحِ کاربر** (یک کارتِ یک‌بارهٔ «روشن‌کردنِ یادآوری‌ها»). تشخیصِ iOSِ نصب‌نشده (`navigator.standalone === false`) → نمایشِ راهنمای «افزودن به صفحهٔ اصلی» به‌جای تلاشِ شکست‌خورده.

### ۱۱.الف.۴. بازنویسیِ لایهٔ Foreground (قطعی هنگام بازبودنِ اپ)
بازنویسیِ **`hooks/useReminderScheduler.ts`:**
- جایگزینیِ منطقِ شکستهٔ `handleSyncReset` (که فقط clear می‌کرد): تابعِ واحدِ `evaluate()` که (الف) برای تسک‌های زمان‌دارِ امروز که در آیندهٔ نزدیک‌اند `setTimeout` می‌گذارد، و (ب) یک **`setInterval` هر ۶۰ ثانیه** که «catch-up» می‌کند: هر تسکِ سررسیدگذشتهٔ امروزِ بدونِ نوتیفِ قبلی → همین حالا شلیک. این، اتکا به تایمرهای بلندِ غیرقابل‌اعتماد را حذف می‌کند.
- بایندِ صحیح: `document.addEventListener('visibilitychange', ...)`, `window`-`online`/`focus` → فراخوانیِ `evaluate()` (clear + reschedule + catch-up) به‌جای صرفِ clear.
- dedup با `localStorage` کلیدِ روزانهٔ Tehran برای nudge و یک `Set` از taskIdهای نوتیف‌شدهٔ امروز (transient/UI، مجاز). همهٔ متن‌ها از `utils/notificationCopy.ts`.

### ۱۱.الف.۵. مسیرِ واحدِ نمایش + dedup بین لایه‌ها
ویرایشِ **`hooks/useRealtimeSync.ts`:** لیسنرِ `reminders` INSERT:
- اگر `document.visibilityState === 'visible'` → فقط `addNotification` (Toast). **حذفِ `sendBrowserNotification`** در حالتِ visible (نوتیفِ OS هنگام بازبودن، اضافی و عاملِ تکرار است).
- اگر hidden → کاری نکن (لایهٔ Push/SW مسئول است). `tag` یکتا برای coalesce.

**جریانِ دادهٔ نهاییِ نوتیفیکیشن:**
```
تسکِ زمان‌دار ──┬─ اپ باز/visible ─→ useReminderScheduler.evaluate() ─→ showViaSW(tag) [+Toast از Realtime]
               └─ اپ بسته/hidden ─→ pg_cron(۱دقیقه) ─→ push-dispatch ─→ webpush ─→ sw.js 'push' ─→ showNotification(tag)
                                                          └─ insert reminders (Ledger/dedup) ─→ Realtime (Toast فقط اگر visible)
```

---

## ۱۱.ب. آفلاین/PWA — صفِ خروجی + اسنپ‌شاتِ خواندنی

**منطقِ مسیردهی:** کلِ منطقِ آفلاین در پوشهٔ جدیدِ **`services/offline/`** کپسوله می‌شود؛ هیچ کامپوننتی مستقیم با IndexedDB حرف نمی‌زند. سیاستِ تعارض: **Last-Write-Wins بر اساس `updated_at`** (هم‌راستا با `useRealtimeSync`). بدونِ کتابخانهٔ خارجی — یک wrapperِ سبکِ دست‌نویس روی IndexedDB.

### ۱۱.ب.۱. فایل‌های جدید
- **`services/offline/idb.ts`** — wrapperِ مینیمالِ IndexedDB: `openDB()`, `get/getAll/put/delete/clear(store, ...)`. دو object store: `snapshot` (کلید: `${userId}:${entity}`) و `outbox` (کلید: `opId`).
- **`services/offline/snapshot.ts`** — `saveSnapshot(userId, entity, rows)` / `loadSnapshot(userId, entity)` برای `tasks|notes|projects|projects|habits|entityLinks`.
- **`services/offline/outbox.ts`** — مدلِ mutation: `{ opId, op:'create'|'update'|'delete', entity, payload, tempId?, baseUpdatedAt?, createdAt, retries }`؛ توابعِ `enqueue`, `listPending`, `remove`, `bumpRetry`, و `remapTempId(tempId, realId)` (برای آپدیتِ opهای وابسته به یک temp).
- **`hooks/useOfflineSync.ts`** — موتورِ flush: روی `online` و در بوت، صف را **به‌ترتیبِ زمانی** پردازش می‌کند؛ برای هر op سرویسِ متناظر را صدا می‌زند؛ پس از create، `tempId → realId` را در state و در opهای بعدیِ صف remap می‌کند؛ خطاهای موقتی retry (با backoff)، خطاهای دائمی (۴xxِ معنادار) drop + Toast.

### ۱۱.ب.۲. ویرایش‌ها (اتصال)
- **`hooks/useDataManager.ts`:**
  - **بوتِ Stale-While-Revalidate:** `loadInitial` ابتدا از `snapshot` هیدریت می‌کند (نمایشِ فوری، `loadingData=false` سریع)، سپس در پس‌زمینه از شبکه رِواِلیدِیت و اسنپ‌شات را به‌روز می‌کند. (این بند هم‌زمان بخشِ پرفورمنسِ ۱۱.ج را پوشش می‌دهد.)
  - **CRUDِ مقاومِ آفلاین:** در `catch`ِ هر عملیات، اگر `!navigator.onLine` یا خطای شبکه بود → به‌جای rollback، mutation در `outbox` صف می‌شود و state محلی (و اسنپ‌شات) حفظ می‌ماند. در موفقیتِ آنلاین، اسنپ‌شات به‌روز می‌شود.
  - عملیاتِ سرورمحور (AI/مدیا/پرداخت) از این مسیر **مستثنا**اند و در آفلاین پیامِ مناسب می‌دهند.
- **`App.tsx`:** mountِ `useOfflineSync()`؛ پاس‌دادنِ تعدادِ pendingِ صف به `NetworkBanner`.
- **`components/NetworkBanner.tsx`:** نمایشِ وضعیتِ واقعی («N تغییرِ ذخیره‌شده، در انتظارِ سینک» / «در حالِ سینک…»).
- **`services/supabaseClient.ts`:** صریح‌کردنِ `auth: { persistSession: true, autoRefreshToken: true }` تا session در کلدـاستارتِ آفلاین از localStorage بازخوانی شود (بدونِ نیاز به شبکه برای ورود به shell).

### ۱۱.ب.۳. مرزها (صریح)
- فقط CRUDِ `tasks|notes|projects|habits|habit_completions|task_note_links` صف می‌شوند.
- `embedding`/RAG/AI/پرداخت/ادمین آنلاین‌محور. iOS = best-effort (ITP eviction + Push فقط در حالتِ نصب‌شده).

---

## ۱۱.ج. پرفورمنسِ لودِ اولیه — مقیاس‌پذیر و سریع

### ۱۱.ج.۱. لاغرسازیِ کوئری‌ها (بزرگ‌ترین بردِ دیتا)
ویرایشِ **`services/{task,note,project,habit}Service.ts`:**
- جایگزینیِ `select('*')` با **لیستِ ستونِ صریح بدونِ `embedding`** (طبق Anti-Pattern §۵۶).
- افزودنِ `.order('created_at',{ascending:false}).range(0, limit-1)` و سیم‌کشیِ `tasksLimit/notesLimit`ِ موجود (که اکنون dead-code‌اند) از `useDataManager` به سرویس‌ها؛ `loadMoreTasks/loadMoreNotes` واقعی شوند.
- `getHabits`: به‌جای کشیدنِ کلِ `habit_completions`، یا پنجرهٔ محدود (مثلاً ۹۰ روزِ اخیر با فیلترِ `completion_date >=`) یا RPCِ تجمیعی (پایین).

### ۱۱.ج.۲. اسکیما/RPC (Idempotent)
فایلِ جدید: **`supabase/sql/42_list_query_optimization.sql`**
- ایندکس‌های ترکیبی: `idx_tasks_user_created on tasks(user_id, created_at desc)`, `idx_notes_user_created on notes(user_id, created_at desc)`, `idx_tasks_user_due on tasks(user_id, due_date)`, `idx_habit_completions_habit_date on habit_completions(habit_id, completion_date)`.
- (اختیاری) RPCِ `get_habits_with_recent_completions(p_days int)` که عادت‌ها + تکمیل‌های پنجرهٔ اخیر را در یک رفت‌وبرگشت برمی‌گرداند (حذفِ کوئریِ دومِ سنگین).

### ۱۱.ج.۳. بوتِ Progressive (پایانِ گیتِ تمام‌صفحه)
- اسپینرِ سراسری حذف؛ بوت از اسنپ‌شات (۱۱.ب.۲) + اولویتِ مسیرِ بحرانی: ابتدا `profile + subscription + تسک‌های امروز/اخیر` برای رنگ‌آمیزیِ Dashboard، سپس بقیه به‌صورت تنبل. هر بخش loading مستقل دارد؛ هیچ کوئریِ کندی کلِ UI را قفل نمی‌کند.

### ۱۱.ج.۴. پایپ‌لاینِ Build (تطبیقِ §H.۴ — بزرگ‌ترین بردِ first-paint)
ویرایشِ **`index.html`, `vite.config.ts`, `package.json`, `index.css` + فایل‌های جدیدِ Tailwind:**
- **حذفِ `importmap`** از `index.html`؛ سپردنِ React/react-dom/supabase-js به باندلِ Vite.
- **Tailwind از CDN → build-time (مسیرِ اصلی = `tailwindcss@3.4` با PostCSS، بدونِ تغییرِ معناییِ کلاس):** بردِ پرفورمنس از کامپایلِ build-time میآید نه از نسخهٔ v4؛ چون CDN فعلی v3-محور است، پینکردنِ `tailwindcss@3.4`+`postcss`+`autoprefixer`+`tailwind.config.js` (با `content`، تمِ تیره، فونتِ Vazirmatn) و دایرکتیوهای `@tailwind base/components/utilities` در `index.css` هیچ تغییرِ معناییِ کلاس ایجاد نمیکند و قانونِ «بدون رگرسیون» را رعایت میکند. حذفِ `<script src="cdn.tailwindcss.com">`. safelist با آرایهٔ `safelist` در `tailwind.config.js`.
- حفظِ عینیِ Vazirmatn (با `display=swap`، preloadِ فقط وزن‌های مصرفی)، Safe-Area Insets، Autofill Override.
- **Code-Splitting:** `React.lazy` + `Suspense` برای `Chat`, `Projects`, `Subscription` و مودال‌های سنگین در `App.tsx`؛ `Dashboard` eager.

> **هشدارِ رگرسیون:** پس از این تغییر، چون Tailwind دیگر همهٔ کلاس‌ها را runtime نمی‌سازد، کلاس‌هایی که به‌صورت رشتهٔ پویا ساخته می‌شوند ممکن است purge شوند؛ باید `safelist` یا کلاس‌های کامل استفاده شوند. این هم‌راستا با Anti-Patternهای §۲۲/§۲۶ است (کلاس‌های نامعتبر/پویا قبلاً هم ممنوع بوده‌اند).

## ۱۱.د. نقشهٔ تداخلِ فایل‌ها (Conflict Map — برای موازی‌نکردن)
- `useDataManager.ts` در H6 (سرویس‌خوانی)، H9 (بوت/هیدریت) و H10 (صف) لمس می‌شود → **سریِ اکید**.
- `reminderService.ts` در H1 و H4 → سری.
- `App.tsx` در H1 (Push gesture)، H7b (lazy) و H10 (mountِ sync) → سری.
- `index.css` در H7a → فقط همان‌جا.
- فایل‌های SQLِ جدید (41/42) و پوشهٔ `services/offline/*` مستقل‌اند و می‌توانند موازی با کارِ UI پیش بروند، اما تستِ یکپارچهٔ آن‌ها به ویرایش‌های `useDataManager` وابسته است.


---

## ۱۱.هـ. اصلاحیهٔ مهندسی (Revision H.2) — گاردریل‌های اجرا

### ۱۱.هـ.۱. لیستِ دقیقِ ستون‌های `select` (ضدِ تلهٔ فیلدِ جاافتاده — Anti-Pattern §۶۴)
مرجعِ کپی‌برداری از `supabase/sql/03_core.sql` (بدونِ `embedding`):
```ts
// taskService.getTasks
.select('id, user_id, project_id, title, description, status, priority, due_date, completed_at, tags, checklist, created_at, updated_at')
// noteService.getNotes
.select('id, user_id, project_id, title, content, tags, created_at, updated_at')
// projectService.getProjects
.select('id, user_id, title, description, status, priority, color, created_at, updated_at')
// habitService: habits
.select('id, user_id, name, description, frequency, target_count, created_at, updated_at')
// habitService: habit_completions (پنجرهٔ محدود)
.select('habit_id, completion_date').gte('completion_date', <Tehran today - 90d>)
```
> اگر در آینده ستونی به جدول اضافه شد، این لیست‌ها باید هم‌زمان به‌روز شوند؛ `embedding` هرگز اضافه نشود (Anti-Pattern §۵۶).

### ۱۱.هـ.۲. safelistِ کلاس‌های داینامیکِ Tailwind (الزامی — Anti-Pattern §۶۵)
**کلاس‌های درون‌یابی‌شدهٔ اثبات‌شده در کد:** `bg-${project.color}-500` (`Dashboard`, `TasksView`)، `via-${project.color}-500` (`NotesView`, `NoteCard`)، `border-${priorityColor}-500` و `bg-${priorityColor}-500` و `bg-${priorityColor}-500/50` (`TaskCard`/`TasksView`)، و opacityِ افزوده به `solidBg` مثل `${colors.solidBg}/80`.
**مجموعهٔ رنگ‌ها:** پروژه‌ها `{sky, red, green, yellow, purple, zinc, gray}` · اولویت `{red, yellow, sky}`.
در `index.css` (Tailwind v4):
```css
@import "tailwindcss";
@source inline("{bg,border,via,from}-{sky,red,green,yellow,purple,zinc,gray}-500");
@source inline("{bg,border}-{sky,red,green,yellow,purple,zinc,gray}-500/{50,80}");
@source inline("text-{sky,red,green,yellow,purple,zinc,gray}-300");
```
> بهترین‌راهکارِ بلندمدت (توصیهٔ معمار، نه اجبارِ این فاز): حذفِ درون‌یابی و نگاشتِ `color`/`priority` به **رشته‌های کاملِ ثابت** (مثل الگوی `colorClasses` که هم‌اکنون امن است). تا زمانِ آن، safelist بالا اجباری است وگرنه اپ بی‌استایل بالا می‌آید.

### ۱۱.هـ.۳. dedupِ نوتیفیکیشن با `messageId` (افزوده به §۱۱.الف.۵ — Anti-Pattern §۶۳)
- هر شلیک یک `messageId` قطعی دارد: تسک = `task-<id>-<dueEpoch>`، ناج = `nudge-<uid>-<tehranDate>`.
- یک object storeِ سومِ سبک `shown` در IndexedDB (کلید = `messageId`، مقدار = timestamp، TTL ~۲۴ساعت) نگهداری می‌شود.
- منطقِ هر سه مسیر (Foreground scheduler، لیسنرِ Realtime، `sw.js push`): **پیش از نمایش**، اگر `messageId` در `shown` بود → نمایش نده؛ در غیرِ این صورت نمایش بده و ثبت کن. این، شلیکِ هم‌زمانِ کلد-استارت و replayِ کهنهٔ Realtime را خنثی می‌کند. (`sw.js` به IndexedDB دسترسی دارد؛ خواندن/نوشتنِ `shown` در worker مجاز است.)
- `tag` همچنان برای coalescingِ بصریِ OS حفظ می‌شود، اما **منبعِ حقیقتِ dedup**، دفترِ `shown` است.

### ۱۱.هـ.۴. گاردِ سشن پیش از سینک (افزوده به §۱۱.ب — Anti-Pattern §۶۲)
جریانِ موتورِ سینک در `hooks/useOfflineSync.ts` هنگامِ `online`/بوت:
```
online ─→ ensureValidSession() ─→ flushOutbox()
ensureValidSession():
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session || نزدیکِ انقضا) await supabase.auth.refreshSession()  // shared single-flight promise
  اگر رفرش شکست خورد (SIGNED_OUT): flush نکن، Outbox را نگه‌دار، پیامِ «برای سینک دوباره وارد شوید»
flushOutbox(): برای هر op:
  try → سرویس متناظر
  catch 401/403 → retryable (سشن را دوباره رفرش کن، op را در صف نگه‌دار)   // هرگز drop
  catch 4xxِ معنادار (مثل 409/422) → drop + Toast (دادهٔ نامعتبر)
  catch شبکه → retryable با backoff
```
- روی `supabase.auth.onAuthStateChange`، رویدادِ `TOKEN_REFRESHED` می‌تواند یک flushِ مجدد را تریگر کند؛ `SIGNED_OUT` صف را دست‌نخورده نگه می‌دارد. (سند: supabase-js issue #1732 — توکن پس از آفلاین auto-refresh نمی‌شود و reconnect با توکنِ منقضی 401 می‌دهد.)
- realtime channelها نیز پس از رفرش باید دوباره join شوند (الگوی shared refreshPromise).

### ۱۱.هـ.۵. لایهٔ IndexedDB روی `idb` (به‌روزرسانیِ §۱۱.ب.۱ — Anti-Pattern §۶۶)
- وابستگیِ جدید: `idb` (~۱.۲KB، promise-based) در `dependencies`؛ از طریقِ باندلِ Vite (importmap حذف شده).
- `services/offline/idb.ts` فقط یک `openDB(name, version, { upgrade })` با سه store: `snapshot`، `outbox`، `shown`؛ بقیهٔ ماژول‌ها (`snapshot.ts`/`outbox.ts`) فقط از این لایه استفاده می‌کنند. بدونِ callbackِ خام.

## ۱۱.هـ.۶. اصلاحیهٔ مهندسی (Revision H.3)
### الف. سشن: getSession-first، بدونِ forceِ دستی
فقط `getSession()`؛ اگر منقضی باشد خودِ کتابخانه رفرش میکند. forceِ دستیِ `refreshSession` در فاز H انجام نشود.
### ب. dead-letter store برای شکستِ دائمی
ساخت store چهارم `failed`. خطای دائمیِ غیرauth (۴۰۰/۴۰۹/۴۲۲) به اینجا منتقل شود (هرگز delete نشود). قانون Cascade روی `tempId`ها رعایت شود.
### ج. هرسِ دفترِ `shown`
`shown` با TTL ~۴۸ ساعت؛ تابعِ `pruneShown()` در بوتِ اپ و پس از هر `put` رکوردهای کهنه را پاک میکند.
### د. نوشتنِ `shown` از داخلِ Service Worker (نکته حیاتی ضد تله VersionError)
لایهٔ اپ مالک schema است و با `idb` کار میکند. اما SW (فایل sw.js) دیتابیس را **بدونِ شمارهٔ version** باز میکند (`indexedDB.open(name)` بدون آرگومان دوم). اگر store `shown` نبود، SW بیصدا از نوشتن میگذرد تا تداخل نسخه پیش نیاید. فقط در SW از هلپر مینیمال raw-IndexedDB استفاده شود.
### هـ. ترتیبِ اجراییِ Tailwind
H7a اولین تسک، ایزوله، روی کامیت مجزا. در صورت شکست، rollback فوری.



---

# ۱۲. فاز I — نقشه‌ی مهندسی (جستجوی هیبریدی Zero-Cost: FTS + RRF + استخراج فیلتر)

## ۱۲.۰. وضعیت موجودِ مرتبط (Snapshot — برای زمینه، نه تغییر)
- **جداول:** `tasks(title, description, tags TEXT[], embedding vector(768), created_at)`، `notes(title, content, tags TEXT[], embedding vector(768), created_at)`، `projects(title, description, embedding vector(768), created_at)`. توجه: **`projects` ستونِ `tags` ندارد.**
- **تابعِ زنده:** `public.hybrid_search(p_query_embedding vector(768), p_query_text text, p_match_count int)` که آخرین‌بار در **`31_rag_projects.sql`** بازنویسی شده (tasks+notes+projects). مسیرِ وکتور: `1 - (embedding <=> q)` با آستانه‌ی `>= 0.25`. مسیرِ متن: `similarity(title||' '||body, q)` (تری‌گرم) با آستانه‌ی `>= 0.01`. تلفیق: RRF با `k=60` روی `FULL OUTER JOIN`.
- **ایندکس‌های متنیِ فعلی:** `idx_tasks_title_trgm`، `idx_tasks_description_trgm`، `idx_notes_title_trgm`، `idx_notes_content_trgm` (همگی GIN/`gin_trgm_ops`، از `20_refactor_schema.sql`).
- **خط لوله‌ی امبدینگ:** Trigger‌های `enqueue_vectorize()` (AFTER INSERT/UPDATE روی tasks/notes/projects) درخواستِ ناهمگامِ `pg_net` به Edge `vectorize` می‌زنند؛ آنجا با مدلِ `google/gemini-embedding-2` (۷۶۸ بُعد، OpenRouter) امبدینگ ساخته و در ستونِ `embedding` ذخیره می‌شود. **این مسیر دست‌نخورده می‌ماند.**
- **مصرف‌کنندگانِ `hybrid_search`:** (۱) `ai-assistant/lib/rag-context.ts` با `p_match_count=15`؛ (۲) `ai-assistant/lib/action-processor.ts` در اکشنِ `SUGGEST_LINK` با `p_match_count=5`. ورودیِ هیچ‌کدام امروز پیش‌پردازشِ Regex/فیلتر ندارد.

## ۱۲.۱. افزوده‌های اسکیما (Schema Δ — فقط در `supabase/sql/43_fulltext_hybrid_search.sql`)

**گام ۱ — تابعِ نرمال‌سازیِ فارسیِ `IMMUTABLE`** (پایه‌ی انطباقِ ایندکس و کوئری):
```sql
CREATE OR REPLACE FUNCTION public.hexer_fa_normalize(p_input text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(
    regexp_replace(
      translate(
        COALESCE(p_input, ''),
        -- ی/ك عربی → فارسی ، حذف اعراب و کشیده، نیم‌فاصله → فاصله
        E'\u064A\u0643\u0640\u200C\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652',
        E'\u06CC\u06A9  '
      ),
      '\s+', ' ', 'g'
    )
  );
$$;
```
> قاعده: چون این تابع در ستونِ `GENERATED` استفاده می‌شود، **باید `IMMUTABLE` بماند** (`translate`/`regexp_replace`/`lower` همگی immutable‌اند). هر تغییرِ بعدیِ منطقِ نرمال‌سازی نیازمندِ مهاجرتِ جدید و بازسازیِ ستون است.

**گام ۲ — ستونِ تولیدشده‌ی `search_vector` (وزن‌دار، `'simple'`)** روی هر سه جدول:
```sql
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', hexer_fa_normalize(title)), 'A') ||
    setweight(to_tsvector('simple', hexer_fa_normalize(COALESCE(description,''))), 'B') ||
    setweight(to_tsvector('simple', hexer_fa_normalize(COALESCE(array_to_string(tags,' '),''))), 'C')
  ) STORED;

ALTER TABLE public.notes    ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', hexer_fa_normalize(title)), 'A') ||
    setweight(to_tsvector('simple', hexer_fa_normalize(COALESCE(content,''))), 'B') ||
    setweight(to_tsvector('simple', hexer_fa_normalize(COALESCE(array_to_string(tags,' '),''))), 'C')
  ) STORED;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', hexer_fa_normalize(title)), 'A') ||
    setweight(to_tsvector('simple', hexer_fa_normalize(COALESCE(description,''))), 'B')
  ) STORED;
```
> نکات اجرایی: (الف) `ADD COLUMN ... GENERATED STORED` رکوردهای موجود را **خودکار پر می‌کند** (بدون بک‌فیل). (ب) این عملیات جدول را بازنویسی و قفلِ کوتاه می‌گیرد؛ برای حجمِ داده‌ی یک اپِ بهره‌وریِ شخصی بی‌خطر است ولی باید در ساعتِ کم‌ترافیک اجرا شود. (ج) `array_to_string` برای فارسیِ تگ‌ها immutable و امن است.

**گام ۳ — ایندکس GIN روی هر `search_vector`:**
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector    ON public.tasks    USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_notes_search_vector    ON public.notes    USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_projects_search_vector ON public.projects USING gin (search_vector);
```

**گام ۴ — حذفِ ایندکس‌های زائدِ trigram (پس از کنارگذاشتنِ `similarity()`):**
```sql
DROP INDEX IF EXISTS public.idx_tasks_title_trgm;
DROP INDEX IF EXISTS public.idx_tasks_description_trgm;
DROP INDEX IF EXISTS public.idx_notes_title_trgm;
DROP INDEX IF EXISTS public.idx_notes_content_trgm;
```
> افزونه‌ی `pg_trgm` حذف نمی‌شود (بی‌ضرر و ممکن است جای دیگری لازم شود).

## ۱۲.۲. افزوده‌های RPC (RPC Δ) — بازنویسیِ `hybrid_search`
امضای جدید (سازگارِ رو به عقب؛ سه پارامترِ اول ثابت، فیلترها با `DEFAULT NULL`):

| پارامتر | نوع | مسئولیت |
|------|------|---------|
| `p_query_embedding` | `vector(768)` | بردارِ کوئری (بدون تغییر) |
| `p_query_text` | `text` | متنِ **پاکِ** کوئری (پس از حذفِ توکن‌های فیلتر) |
| `p_match_count` | `int` | تعدادِ نتیجه‌ی نهایی |
| `p_filter_type` | `text DEFAULT NULL` | `'task'`/`'note'`/`'project'`؛ `NULL`=همه |
| `p_date_from` | `timestamptz DEFAULT NULL` | شرطِ `created_at >= p_date_from` |
| `p_date_to` | `timestamptz DEFAULT NULL` | شرطِ `created_at <= p_date_to` |
| `p_tags` | `text[] DEFAULT NULL` | شرطِ هم‌پوشانی `tags && p_tags` (فقط tasks/notes؛ projects تگ ندارد) |

**منطقِ داخلیِ هدف (مبتنی بر نسخه‌ی سه‌جدولیِ ۳۱):**
- در هر دو CTE (وکتور و متن)، در هر شاخه‌ی `UNION ALL` این شرط‌ها اعمال شود: `user_id = auth.uid()` **و** `(p_filter_type IS NULL OR type = p_filter_type)` **و** `(p_date_from IS NULL OR created_at >= p_date_from)` **و** `(p_date_to IS NULL OR created_at <= p_date_to)`.
- شرطِ تگ فقط در شاخه‌های tasks/notes: `(p_tags IS NULL OR tags && p_tags)`. شاخه‌ی **projects** هنگامی که `p_tags IS NOT NULL` است باید کنار گذاشته شود (با `WHERE p_tags IS NULL`)، چون ستونِ tags ندارد.
- **مسیرِ وکتور:** `val_vector = CASE WHEN embedding IS NULL THEN 0 ELSE 1-(embedding <=> p_query_embedding) END`؛ `ROW_NUMBER() OVER (ORDER BY val_vector DESC)`؛ **`LIMIT 100`** (به‌جای آستانه).
- **مسیرِ متن:** ابتدا `v_ts_query tsquery := websearch_to_tsquery('simple', hexer_fa_normalize(p_query_text))`؛ فقط ردیف‌هایی که `search_vector @@ v_ts_query`؛ امتیاز `ts_rank_cd(search_vector, v_ts_query)`؛ `ROW_NUMBER() OVER (ORDER BY rank DESC)`؛ **`LIMIT 100`**. اگر `p_query_text` تهی بود یا `v_ts_query` تهی شد، این CTE خالی می‌ماند (مسیرِ وکتور همچنان کار می‌کند).
- **تلفیقِ نهایی:** بدونِ هیچ آستانه‌ای —
  `score = COALESCE(1.0/(60.0 + v.rank_val),0) + COALESCE(1.0/(60.0 + t.rank_val),0)`،
  `FULL OUTER JOIN ... ON v.id=t.id AND v.type=t.type`، `ORDER BY score DESC LIMIT p_match_count`.
- خروجی و ستون‌های بازگشتی **بدون تغییر**: `(id uuid, type text, title text, snippet text, score float8)`؛ `SECURITY DEFINER SET search_path = public`؛ گاردِ `auth.uid() IS NULL`.
- در انتهای فایل: `NOTIFY pgrst, 'reload schema';`.

## ۱۲.۳. جریان داده‌ی جدیدِ جستجو (Data Flow)
```
پیامِ کاربر (خام)
   │
   ▼  [TS] parseSearchQuery()  ← ماژولِ جدید query-parser.ts
   ├─ filterType  (نوع:/type: → task|note|project)
   ├─ tags[]      (#تگ)
   ├─ dateFrom/dateTo (امروز/دیروز/هفته گذشته/این ماه ...)
   └─ cleanText  (متن بدون توکن‌های فیلتر)
        │
        ├─► generateEmbedding(ai, cleanText, 'query')   → بردار ۷۶۸ (همان یک فراخوانیِ موجود، بدون هزینه‌ی اضافه)
        │
        └─► supabase.rpc('hybrid_search', {
                 p_query_embedding, p_query_text: cleanText, p_match_count,
                 p_filter_type, p_date_from, p_date_to, p_tags })
                    │
                    ▼  Postgres: [وکتور Top-100] + [tsvector/ts_rank_cd Top-100] → RRF(k=60)
                    ▼  WHERE فیلترهای قطعی (type/date/tags) دایره‌ی جستجو را قبل از رتبه‌بندی محدود می‌کنند
                 citations / contextString  (بدون تغییرِ قرارداد)
```
نتیجه: فیلترهای قطعی نویز را قبل از RRF حذف می‌کنند، `tsvector` دقتِ واژه‌ایِ متونِ بلند را بالا می‌برد، و هیچ توکنِ هوش مصنوعی‌ای مصرف نمی‌شود.

## ۱۲.۴. قانونِ مسیردهیِ فایل‌ها (File Tree Δ)
- **جدید (DB):** `supabase/sql/43_fulltext_hybrid_search.sql` — تنها محلِ تغییراتِ دیتابیسِ این فاز.
- **جدید (TS):** `supabase/functions/ai-assistant/lib/query-parser.ts` — تابعِ خالصِ `parseSearchQuery(raw) → { cleanText, filterType, dateFrom, dateTo, tags }` (بدونِ I/O، قابلِ تست).
- **ویرایش:** `supabase/functions/ai-assistant/lib/rag-context.ts` — فراخوانیِ `parseSearchQuery` قبل از امبدینگ؛ پاس‌دادنِ `cleanText` به `generateEmbedding` و `hybrid_search` به‌همراهِ فیلترها.
- **ویرایش (اختیاری/ثانویه):** `supabase/functions/ai-assistant/lib/action-processor.ts` — در `SUGGEST_LINK` همان parser برای پاک‌سازیِ `queryText` (بدونِ شکستنِ امضا).
- **اختیاری/بعدی (UI):** افزودنِ دکمه‌های Toggle (زمان/نوع) در سطحِ چتِ «memory»؛ خارج از هسته‌ی این فاز.
- **بدونِ تغییر:** `supabase/functions/vectorize/index.ts`، `supabase/functions/_shared/gemini-client.ts`، و فایل‌های SQLِ قدیمی.

## ۱۲.۵. نقشه‌ی تداخلِ فایل‌ها (Conflict Map — برای موازی‌نکردن)
- تسک‌های دیتابیس همگی روی **یک فایل** (`43_...sql`) می‌نویسند → **به‌هیچ‌وجه موازی نشوند**؛ ترتیبی و در یک کامیت.
- `rag-context.ts` به امضای جدیدِ `hybrid_search` و به `query-parser.ts` وابسته است → فقط **پس از** اتمام تسکِ SQL و تسکِ parser.
- `query-parser.ts` مستقل است → می‌تواند موازی با تسکِ SQL پیش برود.

## ۱۲.۶. اصلاحِ §۲.۴ و لغو کامل tsvector (Nuclear Revert)
«ممنوعیت استفاده از مدل صلب tsvector برای عبارات محاوره‌ای فارسی چت: در فازهای قبلی تلاش شد برای افزایش سرعت، از کاتالوگ واژگانی tsvector همراه با پارسر رجکس استفاده شود. این ساختار در پروداکشن به دلیل ماهیت اتصالات سختگیرانه AND و نبود استاپ-ورد بومی فارسی، به کلی شکست خورد و عبارات محاوره‌ای کاربران را مسدود کرد. پلتفرم Hexer رسماً و برای همیشه به معماری ترکیبی True Semantic Vector + Trigram Fuzzy (similarity) متعهد است و هیچکس حق اور-انجینیرینگ و مخدوش کردن متن طبیعی کاربر را ندارد.»



---

# ۱۳. فاز J — نقشه‌ی مهندسی (حریم امن سراسری، BottomNav، فاصله‌گذاری مودال/کشو)

> مرجعِ هویت و نبایدها: `docs/PROJECT.md` فاز J. این بخش «چگونگیِ» مهندسی را مپ می‌کند. اصلِ طراحی: **یک لایه‌ی ابزارِ مرکزی در `index.css`** + اعمال در «درزهای» معماری. هیچ کامپوننتی نباید env() را به‌صورت موضعی بازنویسی کند.

## ۱۳.۰. وضعیت موجود (Snapshot — با شواهدِ خط‌به‌خط)
- `index.html`: `viewport-fit=cover` ✓ و `apple-mobile-web-app-status-bar-style=black-translucent` (یعنی در PWAِ iOS، status bar روی وب‌ویو می‌افتد و حریمِ بالا لازم است). Tailwind از CDN: `https://cdn.tailwindcss.com` (بدون کانفیگ).
- `index.css`: متغیرهای `--safe-area-inset-bottom/top` تعریف شده‌اند اما تقریباً بی‌مصرف؛ تنها ابزارهای واقعیِ موجود `scroll-fade-edge` و override اتوفیلْ‌اند.
- `components/BottomNav.tsx:28`: `fixed bottom-0 right-0 left-0 h-20 px-4 z-50`؛ بارِ شناور `absolute bottom-4 ... h-16` (خط ۳۰). → فاقدِ inset؛ لبه‌ی نوار روی Home Indicator.
- `App.tsx:310-316`: پوسته `relative flex flex-col h-[100dvh]` → `<main className="flex-1 overflow-y-auto overflow-x-hidden pb-24">` (تنها اسکرولِ بیرونی) → سپس `<BottomNav/>` به‌صورت خواهر. با `border-box`، فرزندِ `h-full`ِ هر ویو دقیقاً به‌اندازه‌ی `pb-24` از پایین تو رفته است؛ پس **`pb-24`ِ `main` همان فاصله‌ی نوار برای همه‌ی ویوهاست**.
- ویوها دو مدلِ اسکرول دارند: (الف) خودگردان `h-full flex-col` با اسکرولِ داخلی — `TasksView` (هدر خط ۱۶۳ `... pt-safe ... shrink-0`، اسکرول خط ۱۹۴ `flex-1 overflow-y-auto ... pb-32`)، `NotesView`/`ProjectsView` (ریشه `min-h-full pb-32 ... h-full` + اسکرولِ `flex-1`)، `ChatView` (هدر `pt-safe`، پیام‌ها `flex-1 overflow-y-auto`، نوارِ ورودی خط ۸۳۶ `p-4 ... border-t`). (ب) جریانی که روی اسکرولِ `main` می‌نشیند — `Dashboard` (`<div className="pb-24">`، هدرِ sticky با `pt-safe`).
- مودال‌ها (همه bottom-sheet با `items-end`، `h-[100dvh]`، `min-h-0` روی اسکرول):
  - `TaskEditorModal`: footerِ ثابت `p-4 sm:p-6 border-t shrink-0` (خط ۶۳۰) — بدون inset. اسکرول `... pb-24 sm:pb-6` (خط ۳۲۲؛ زائد چون footer جداست).
  - `NoteEditorModal`: footerِ متادیتا `shrink-0 ... p-4 sm:p-6 pb-20 sm:pb-6` (خط ۲۳۵) — `pb-20`ِ ثابت.
  - `SubscriptionModal`: footerِ ثابت `p-4 border-t ... shrink-0 pb-safe` (خط ۳۱۲) — `pb-safe`ِ **no-op**.
  - `HabitEditorModal`/`HabitManagerModal`/`ProjectDetailsModal`: **بدونِ footerِ ثابت**؛ دکمه‌ها/محتوای پایانی داخلِ ناحیه‌ی `flex-1 overflow-y-auto min-h-0` هستند و آن ناحیه پدینگِ امنِ پایین ندارد.
- `ChatHistoryDrawer.tsx:44-62`: کشوی پایین `fixed inset-0 z-[60] items-end` + پنل `max-h-[80vh] rounded-t-3xl flex-col` + اسکرول `p-4 overflow-y-auto flex-1` — لبه‌ی پایین روی Home Indicator.
- موارد **درستِ موجود** (مرجعِ سبک، تغییر نمی‌کنند مگر برای DRY): `Onboarding.tsx:66-69` (style اینلاین با `calc(env(...)+1.5rem)`) و `WeeklyReportModal.tsx:156` (`pb-[calc(5rem+env(safe-area-inset-bottom))]`).

## ۱۳.الف. لایه‌ی منبعِ واحد در `index.css` (قرارداد دقیق — هسته‌ی فاز J)
این بلاک پس از بلاکِ `:root` موجود اضافه می‌شود. مقادیرِ پایه‌ی طراحی طوری انتخاب شده‌اند که روی دستگاه‌های **بدونِ** notch دقیقاً معادلِ پدینگِ فعلی باشند (صفر رگرسیون) و روی دستگاه‌های دارایِ inset، حریم را بیفزایند. استفاده از `!important` عمدی و موجه است (مصونیت از ترتیب تزریقِ Runtime CDN — §۱۱.هـ.۵).

```css
:root {
  /* فضای اشغالیِ BottomNav بدونِ احتسابِ حریم سیستم (h-20 = 5rem) */
  --bottom-nav-space: 5rem;
}

/* حریمِ بالا برای هدرهای sticky (ناچ/داینامیک‌آیلند/استتوس‌بار). این کلاس مالکِ padding-top است. */
.pt-safe { padding-top: calc(env(safe-area-inset-top, 0px) + 2rem) !important; }

/* حریمِ پایین برای نوارهای عمل/footerِ ثابت. مالکِ padding-bottom است. */
.pb-safe { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem) !important; }

/* محتوای اسکرول‌شونده‌ی مودال/کشو که footerِ ثابت ندارد (دکمه‌ها داخلِ اسکرول‌اند). */
.pb-safe-content { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1.5rem) !important; }

/* فاصله‌ی صفحاتِ اسکرول‌شونده از BottomNavِ شناور = فضای نوار + حریم سیستم + نفس‌کشی. */
.pb-bottom-nav { padding-bottom: calc(var(--bottom-nav-space) + env(safe-area-inset-bottom, 0px) + 0.5rem) !important; }
```

**چرا این طراحی درست است:** `.pt-safe`/`.pb-safe` مالکِ کاملِ همان ضلع‌اند؛ روی هدرهایی که `py-8`/`pt-8` (=۲rem) دارند، روی دستگاه بدونِ notch دقیقاً ۲rem می‌ماند (بدون رگرسیون) و روی notch به‌درستی رشد می‌کند. چون `!important` است، نیازی به دست‌زدن به کلاس‌های پدینگِ موجود نیست؛ ۶ هدر و footerِ اشتراک که امروز no-op دارند، **بلافاصله و بدونِ تغییر markup** فعال می‌شوند.

## ۱۳.ب. اصلاح `BottomNav` (بالا آوردن از Home Indicator)
نوارِ شناور باید به‌اندازه‌ی `env(safe-area-inset-bottom)` بالا بیاید و ظرفِ بیرونی هم‌اندازه رشد کند، تا توکنِ `--bottom-nav-space` با فضای واقعی هم‌خوان بماند:
- ظرفِ بیرونی: `h-20` → `h-[calc(5rem+env(safe-area-inset-bottom))]` (یا افزودنِ `padding-bottom: env(...)` معادل).
- بارِ شناورِ داخلی: افست `bottom-4` → `bottom-[calc(1rem+env(safe-area-inset-bottom))]`.
- مقادیرِ `z-50`، `max-w-lg`، گریدِ ۵‌ستونی و دکمه‌ی مرکزی دست‌نخورده.
> نتیجه: لبه‌ی پایینِ نوار بالای اندیکیتور قرار می‌گیرد؛ سقفِ نوار در `5rem + inset` می‌نشیند که دقیقاً همان چیزی است که `.pb-bottom-nav` رزرو می‌کند.

## ۱۳.ج. فاصله‌ی سراسریِ صفحه (مالکِ واحد) و حذفِ اعدادِ جادویی
- `App.tsx`: در `<main>` کلاسِ `pb-24` → `pb-bottom-nav`. از این پس **`main` تنها مالکِ فاصله‌ی نوار** برای همه‌ی ویوهاست (چون فرزندانِ `h-full` با `border-box` به‌اندازه‌ی این پدینگ از پایین تو می‌روند و ویوهای جریانی هم داخلِ همین اسکرول‌اند).
- حذفِ پدینگِ نوارِ زائد در ویوها (ضدِّ Double-Padding، Anti §۸۲): `Dashboard` ریشه‌ی `pb-24` → حذف (یا `pb-2` صرفاً نفس‌کشی)؛ `TasksView` اسکرولِ داخلی `pb-32` → `pb-4`؛ `NotesView`/`ProjectsView` ریشه‌ی `pb-32` → حذف.
- FABها (`TasksView`/`NotesView` با `fixed bottom-24`): افستِ ثابت `bottom-24` → `bottom-[calc(var(--bottom-nav-space)+env(safe-area-inset-bottom))]` تا روی نوار/اندیکیتور نیفتند.
- هدرهای ویوها (`pt-safe`ِ موجود) خودبه‌خود با §۱۳.الف فعال می‌شوند — تغییری لازم نیست.

## ۱۳.د. قراردادِ مودال/کشو (الگوی واحد — اصلاحِ §۷.۳، §۷.۵، §۷.۶)
دو حالت، یک قاعده:
1. **مودال با footerِ ثابت** (خواهرِ `shrink-0`ِ ناحیه‌ی اسکرول، مثل `TaskEditorModal`، `SubscriptionModal`، modalِ ساختِ `ProjectsView`): footer کلاسِ `pb-safe` بگیرد؛ ناحیه‌ی اسکرول `min-h-0` و `pb`ِ زائد (مثل `pb-24`/`pb-20`ِ موبایل) حذف/کوچک شود. هدرِ شیت `pt-safe` بگیرد (برای شیت‌های `h-[100dvh]` که سقفِ ویوپورت را لمس می‌کنند).
2. **مودال/کشو بدونِ footerِ ثابت** (دکمه‌ها داخلِ اسکرول، مثل `HabitEditorModal`، `HabitManagerModal`، `ProjectDetailsModal`، `ChatHistoryDrawer`): ناحیه‌ی `flex-1 overflow-y-auto` کلاسِ `pb-safe-content` بگیرد تا آخرین اِلمان بالای Home Indicator بایستد.
> قاعده‌ی ثابت: `h-[100dvh]`/`min-h-0`/`max-h-[..vh]` و `z-index`ها (§۷.۲) دست‌نخورده می‌مانند؛ فقط padding اضافه می‌شود. `NoteEditorModal` باید `pb-20`ِ موبایلِ footer را به `pb-safe` تبدیل کند (حذفِ عددِ جادویی).

## ۱۳.هـ. نقشه‌ی مسیردهیِ فایل‌ها (File Tree Δ — این پروژه از‌قبل موجود است)
- **منطقِ مسیردهی:** هیچ فایل/پوشه‌ی جدیدی ساخته نمی‌شود. تنها فایلِ «تعریفِ سبک» `index.css` است؛ مابقی، اعمالِ کلاس‌ها در درزهای موجود.
- فایل‌های دست‌خورده: `index.css` (تعریفِ لایه)، `components/BottomNav.tsx`، `App.tsx`، `features/dashboard/Dashboard.tsx`، `features/tasks/TasksView.tsx`، `features/notes/NotesView.tsx`، `features/projects/ProjectsView.tsx` (هم صفحه و هم modalِ اینلاینِ همان فایل)، `features/tasks/components/TaskEditorModal.tsx`، `features/notes/components/NoteEditorModal.tsx`، `features/habits/components/HabitEditorModal.tsx`، `features/habits/components/HabitManagerModal.tsx`، `features/projects/components/ProjectDetailsModal.tsx`، `features/billing/components/SubscriptionModal.tsx`، `components/PaywallModal.tsx`، `components/ProfileModal.tsx`، `features/chat/components/ChatHistoryDrawer.tsx`. اختیاری (DRY): همگام‌سازیِ `WeeklyReportModal.tsx` و `Onboarding.tsx` با لایه‌ی مرکزی.
- خارج از اسکوپ: `components/Modal.tsx` (مرده)، `components/Sidebar.tsx` (فایلِ خالی).

## ۱۳.و. نقشه‌ی تداخلِ فایل‌ها (Conflict Map — برای موازی‌نکردن)
- `index.css` فقط در **J1** و **پیش‌نیازِ همه** است → J1 باید اول و تنها اجرا شود.
- `BottomNav.tsx` فقط J2؛ `App.tsx` فقط J3 (هر دو به توکنِ `--bottom-nav-space` از J1 وابسته‌اند).
- ویوهای صفحه‌ای (`Dashboard`/`TasksView`/`NotesView`/`ProjectsView`) فقط در **J4**. توجه: `ProjectsView.tsx` همِ صفحه و همِ modalِ اینلاین دارد → **کلِ این فایل فقط در J4** اصلاح شود (نه در J5) تا یک فایل در دو تسک نباشد.
- مودال‌های مستقل (`TaskEditorModal`/`NoteEditorModal`/`HabitEditorModal`/`HabitManagerModal`/`ProjectDetailsModal`) فقط در **J5**.
- اورلی/کشو/سایر (`PaywallModal`/`ProfileModal`/`ChatHistoryDrawer`/`SubscriptionModal` + اختیاری‌ها) فقط در **J6**.
- هیچ فایلی در بیش از یک تسک ظاهر نمی‌شود → پس از J1، تسک‌های J4/J5/J6 روی فایل‌های مجزا هستند و در صورت نیاز می‌توانند موازی شوند؛ J2/J3 نیز مستقل‌اند.

## ۱۳.ز. سوپرسید (Supersede) — اصلاحِ قراردادهای قبلی
- **§۷.۵ (فاصله از Bottom Navigation):** عبارتِ «هر صفحه‌ی اسکرول‌دار باید `pb-24` داشته باشد» منسوخ است. از این پس مالکِ واحدِ فاصله‌ی نوار، `App main` با `.pb-bottom-nav` است و صفحات نباید فاصله‌ی نوار را تکرار کنند (Anti §۷۸/§۸۲).
- **§۷.۶ (Safe Area Insets):** مثالِ ناقص/خالیِ «Tailwind config یا inline» با لایه‌ی مشخصِ §۱۳.الف تکمیل و جایگزین می‌شود. مکانیزمِ رسمی = کلاس‌های `.pt-safe`/`.pb-safe`/`.pb-safe-content`/`.pb-bottom-nav` در `index.css`.
- **§۷.۳ (الگوی مودال):** «`pb-safe` برای notch» اکنون معنا دارد چون در §۱۳.الف واقعاً تعریف شده؛ مودال‌های بدونِ footerِ ثابت از `.pb-safe-content` استفاده می‌کنند.
