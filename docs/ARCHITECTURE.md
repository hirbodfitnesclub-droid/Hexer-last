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
