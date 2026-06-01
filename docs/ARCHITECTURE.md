# ARCHITECTURE.md — نقشه‌ی مهندسی این ریفکتور (Hexer AI)

> این سند «چه چیزی» و «چرا»ی ریفکتور جاری را تعریف می‌کند؛ «چگونگیِ» گام‌به‌گام در `tasks.md` (R1–R10).
> اصول حاکم (که از قبل پیاده شده‌اند و دست‌نخورده می‌مانند): **Server-Authoritative** (منطق پولی/مصرفی/امنیتی سمت سرور)، **RLS-First** (هر جدول قفل روی `auth.uid()=user_id`)، **Atomic via RPC** (نوشتن چندمرحله‌ای فقط در دیتابیس).

---

## ۱. وضعیت موجود (Snapshot — برای زمینه، نه برای تغییر)
> این بخش فقط برای آگاهی کدنویس است. این موارد **ساخته‌شده‌اند** و در این ریفکتور بازنویسی نمی‌شوند مگر صریحاً در یک تسک گفته شود.

- **جداول موجود (همه با `user_id` + RLS):** `profiles`, `plans`(+seed free/plus/pro)، `subscriptions`, `usage_counters`, `ai_requests_log`, `payments`, `projects`, `tasks`(با `checklist jsonb` و `embedding vector(768)`), `notes`(با `embedding vector(768)`), `habits`, `habit_completions`, `reminders`, `media_assets`.
- **RPC های موجود:** `handle_new_user`(تریگر ساخت اتمیک profile+subscription+usage)، `create_task_with_tags`، `create_note_with_tags`، `match_documents`(جستجوی برداری user-scoped)، `consume_ai_quota`(گیت اتمیک سهمیه، خروجی `{allowed, model, remaining, reason}`)، `activate_subscription`، `enqueue_vectorize`(تریگر `pg_net` روی tasks/notes).
- **توابع لبه‌ی موجود:** `ai-assistant`(مسیر بدون Base64، مدیا از Storage با Service Role)، `vectorize`(امبدینگ ۷۶۸)، `zibal-request`, `zibal-verify`.
- **Storage:** باکت‌های Private `chat-media` و `avatars` با ساختار مسیر `{user_id}/...`.
- **env هدف:** کلاینت `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` · توابع `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ZIBAL_MERCHANT`, `ZIBAL_CALLBACK_URL`.

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

### ۴.۱. جستجوی معنایی واقعی
- **مشکل:** embedding فقط روی یک فیلد ساخته می‌شد؛ جستجو عملاً کلیدواژه‌ای بود.
- **اصلاح `vectorize`:** متنِ امبدینگ از **ترکیب `title + description/content + tags`** ساخته می‌شود (نه یک فیلد)؛ بُعد دقیقاً ۷۶۸.
- **اصلاح جستجو:** ابتدا embedding کوئری گرفته می‌شود، سپس `hybrid_search(embedding, raw_text, k)` تا هم معنا و هم کلیدواژه پوشش یابد.

### ۴.۲. لینک هوشمند با AI
در حالت `action`، اگر کاربر بخواهد لینک کند، مدل به‌جای ساخت کور یک «اکشن جستجو» تولید می‌کند: `ai-assistant` تابع `hybrid_search` را روی notes/tasks می‌زند و **کاندیداها** را با `operation: 'suggest_link'` در `actionResults` برمی‌گرداند. انتخاب کاربر → کلاینت `link_task_note(...)` را صدا می‌زند (AI خودش نهایی نمی‌کند مگر کاندیدا یکتا و قطعی باشد).

### ۴.۳. استخراج با تأیید (Proposal Flow)
وقتی ورودی صوت/تصویر است، `ai-assistant` در حالت ویژه **هم تسک و هم یادداشت** استخراج می‌کند اما **هیچ‌چیز در DB نمی‌نویسد**؛ خروجی:
```jsonc
{ "proposals": [ { "kind": "task" | "note", "draft": { ...fields }, "confidence": 0.0-1.0 } ], "transcription": "..." }
```
کلاینت کارت‌های پیش‌نویس را با «تأیید/حذف» تک‌به‌تک و «تأیید همه» نشان می‌دهد؛ فقط در زمان تأیید، RPC اتمیک (`create_task_with_tags`/`create_note_with_tags`) صدا زده می‌شود. نوع کلاینت: `ExtractionProposal { id, kind, draft, confidence, status }`.

### ۴.۴. قرارداد پاسخ `ai-assistant`
خروجی JSON (سازگارِ عقب‌رو) شامل: `reply`, `citations`, `actionResults`(با `operation: 'create'|'update'|'suggest_link'`), `proposals`, `transcription`. همه‌ی فراخوانی‌ها از `services/geminiService.ts` عبور می‌کنند (ضدالگوی ۱۸).

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
