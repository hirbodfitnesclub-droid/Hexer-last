# ARCHITECTURE.md — لنگرگاه سیستمی (Hexer AI)

> نقشه مهندسی کامل بک‌اند از نقطه صفر. این سند «چه چیزی» و «چرا» را تعریف می‌کند؛ «چگونگیِ» گام‌به‌گام در `tasks.md` است.

---

## ۱. نمای کلان (High-Level)

```
[ React Client ]
   │  (1) آپلود مدیا مستقیم (RLS) ┌────────────────────┐
   ├────────────────────────────►│ Supabase Storage    │ (باکت chat-media / private)
   │                              └────────────────────┘
   │  (2) فراخوانی با مسیر فایل (نه Base64)
   ▼
[ Edge: ai-assistant ] ──(3) consume_ai_quota RPC──► [ Postgres: گیتِ اشتراک/مصرف ]
   │  (4) دانلود بایت‌های مدیا از Storage (Service Role)
   │  (5) Gemini (مدل بر اساس پلن) → استخراج/اکشن
   ▼
[ Postgres ] ◄──(6) RPC های اتمیک (create_task_with_tags ...) → Realtime (فیلترشده با user_id) ──► [ Client ]

[ React Client ] ─► [ Edge: zibal-request ] ─► زیبال ─► کاربر پرداخت ─► [ Edge: zibal-verify ] ─► activate_subscription RPC

[ Postgres: INSERT/UPDATE روی tasks|notes ] ──(تریگر + pg_net)──► [ Edge: vectorize ] ──► embedding(768) برمی‌گردد به همان ردیف
```

اصول حاکم: **Server-Authoritative** (منطق پولی/مصرفی/امنیتی سمت سرور)، **RLS-First** (هر جدول قفل)، **Atomic via RPC** (نوشتن چندمرحله‌ای فقط در دیتابیس).

---

## ۲. اسکیمای دیتابیس (Schema)

> همه‌ی جداولِ دادهٔ کاربر دارای `user_id uuid not null references auth.users(id) on delete cascade` و **RLS فعال** با پالیسی پایه `auth.uid() = user_id` هستند.
> امبدینگ‌ها: `vector(768)` (مطابق `text-embedding-004`).

### ۲.۱. هویت و پروفایل
**`profiles`** — یک ردیف به ازای هر کاربر (PK = `id` که همان `auth.users.id` است).
| ستون | نوع | توضیح |
|------|-----|------|
| id | uuid PK FK→auth.users | حذف آبشاری |
| full_name | text | |
| avatar_url | text | مسیر در باکت avatars |
| timezone | text default 'Asia/Tehran' | برای یادآوری‌ها |
| onboarding_completed | boolean default false | کنترل جریان Onboarding |
| created_at / updated_at | timestamptz | |

تریگر `handle_new_user` روی `auth.users` (AFTER INSERT): به‌صورت اتمیک می‌سازد → `profiles` + `subscriptions`(پلن free، انقضا = now()+۳ روز) + ردیف `usage_counters` اولیه.

### ۲.۲. اشتراک و مصرف (Billing Core)
**`plans`** — جدول مرجعِ پیکربندی (داده‌محور؛ مدل و سقف از کد جدا می‌شود). Seed ثابت:
| plan_code (PK) | display_name | price_irr (bigint) | monthly_quota | period_days | ai_model |
|------|------|------|------|------|------|
| free | آزمایشی | 0 | 30 | 3 | gemini-2.5-flash-lite |
| plus | پلاس | 990000 | 400 | 30 | gemini-2.5-flash-lite |
| pro | پرو | 2990000 | 1000 | 30 | gemini-3.1-flash-lite |

> توجه: مبالغ به **ریال** ذخیره می‌شوند (۹۹٬۰۰۰ تومان = ۹۹۰٬۰۰۰ ریال، ۲۹۹٬۰۰۰ تومان = ۲٬۹۹۰٬۰۰۰ ریال). درگاه زیبال مبلغ را به ریال می‌گیرد.

**`subscriptions`** — وضعیت پلن جاری کاربر (یک ردیف فعال به‌ازای هر کاربر).
| ستون | نوع | توضیح |
|------|-----|------|
| id | uuid PK | |
| user_id | uuid (unique) | یک اشتراک فعال در لحظه |
| plan_code | text FK→plans | |
| status | text | active / expired / canceled / pending |
| started_at | timestamptz | |
| expires_at | timestamptz | free: signup+۳روز، paid: +۳۰روز |
| updated_at | timestamptz | |

**`usage_counters`** — شمارندهٔ مصرف AI در دورهٔ جاری (مبنای اعمال سقف).
| ستون | نوع | توضیح |
|------|-----|------|
| user_id | uuid PK FK | |
| period_start | timestamptz | شروع دورهٔ شمارش |
| period_end | timestamptz | پایان دوره (= expires_at دورهٔ فعلی) |
| request_count | int default 0 | تعداد درخواست مصرف‌شده |
| updated_at | timestamptz | |

**`ai_requests_log`** (اختیاری ولی توصیه‌شده برای ��سابرسی) — `id, user_id, mode, model, tokens_estimate, created_at`. فقط INSERT از سمت سرور؛ کاربر فقط ردیف‌های خودش را می‌خواند.

### ۲.۳. پرداخت
**`payments`** — هر تراکنش زیبال.
| ستون | نوع | توضیح |
|------|-----|------|
| id | uuid PK | order_id ارسالی به زیبال |
| user_id | uuid FK | |
| plan_code | text FK→plans | |
| amount_irr | bigint | مبلغ به ریال |
| gateway | text default 'zibal' | |
| track_id | text | trackId بازگشتی از زیبال |
| ref_number | text | شماره پیگیری پس از verify |
| status | text | pending / paid / failed / canceled |
| created_at / paid_at | timestamptz | |

### ۲.۴. دامنهٔ اصلی محصول
**`projects`**: id, user_id, title, description, status, priority, color, created_at, updated_at.
**`tasks`**: id, user_id, project_id (FK→projects, nullable, `on delete set null`), title, description, status, priority, due_date, completed_at, tags `text[]`, **checklist `jsonb` default '[]'**, **embedding `vector(768)`**, created_at, updated_at.
**`notes`**: id, user_id, project_id (FK, nullable), title, content, tags `text[]`, **embedding `vector(768)`**, created_at, updated_at.
**`habits`**: id, user_id, name, description, frequency, target_count, created_at, updated_at.
**`habit_completions`**: id, user_id, habit_id (FK→habits, `on delete cascade`), completion_date `date`, created_at — با `UNIQUE(habit_id, completion_date)`.

### ۲.۵. یادآوری/اعلان و مدیا
**`reminders`**: id, user_id, title, body, remind_at `timestamptz`, type (task/habit/custom), related_entity_type, related_entity_id, is_sent boolean, is_read boolean, created_at.
**`media_assets`** (رهگیری فایل‌های آپلودی برای پاکسازی): id, user_id, bucket, path, mime_type, size_bytes, purpose (chat_audio/chat_image/avatar), created_at.

### ۲.۶. ایندکس‌ها (الزامی برای مقیاس)
- `tasks(user_id)`, `notes(user_id)`, `projects(user_id)`, `habits(user_id)`, `habit_completions(user_id)`, `reminders(user_id, remind_at)`.
- ایندکس برداری **IVFFlat/HNSW** روی `tasks.embedding` و `notes.embedding` با `vector_cosine_ops`.

---

## ۳. RPC ها و توابع دیتابیس (منطق سمت سرور)

| تابع | نوع | مسئولیت | نکتهٔ امنیتی |
|------|-----|---------|--------------|
| `handle_new_user()` | trigger, SECURITY DEFINER | ساخت اتمیک profile + subscription(free) + usage_counter | روی `auth.users` |
| `create_task_with_tags(...)` | RPC | ساخت تسک + `checklist` در **یک** تراکنش، `user_id := auth.uid()` | جایگزین الگوی insert+update فعلی |
| `create_note_with_tags(...)` | RPC | ساخت یادداشت اتمیک، `user_id := auth.uid()` | |
| `match_documents(query_embedding, match_threshold, match_count)` | RPC | جستجوی برداری روی tasks+notes | **باید** داخل تابع با `where user_id = auth.uid()` فیلتر شود |
| `consume_ai_quota()` | RPC, SECURITY DEFINER | گیتِ اتمیک: قفل ردیف usage (`for update`)، چک انقضای پلن + سقف، ریست دوره در صورت لزوم، افزایش شمارنده. خروجی: `{allowed boolean, model text, remaining int, reason text}` | بدون پارامتر؛ کاربر از `auth.uid()` |
| `activate_subscription(p_user_id, p_plan_code, p_payment_id)` | RPC, SECURITY DEFINER | فعال‌سازی اتمیک پلن + تمدید `expires_at` + **ریست `usage_counters`** | فقط از داخل Edge با Service Role فراخوانی شود |
| `enqueue_vectorize()` | trigger fn, SECURITY DEFINER | پس از `INSERT`/`UPDATE` روی `tasks` و `notes`، تابع لبهٔ `vectorize` را با `pg_net` (`net.http_post`) به‌صورت غیرمسدودکننده صدا می‌زند و `{table, id}` را پاس می‌دهد | تریگر `AFTER INSERT OR UPDATE OF title, description, content` |

> منطق دوره برای `free`: شمارش **تجمعی** تا سقف ۳۰ در بازهٔ ۳ روزه (بدون ریست). برای `plus/pro`: سقف ماهانه؛ با عبور از `period_end`، دوره ریست و شمارنده صفر می‌شود.

### ۳.۱. تریگر برداری‌سازی خودکار (Vectorize Webhook)
چون دیتابیس از صفر ساخته می‌شود، فراخوانی `vectorize` نباید به کلاینت سپرده شود. مکانیسم رسمی:
- افزونهٔ **`pg_net`** فعال می‌شود (در `00_extensions.sql`).
- تابع `enqueue_vectorize()` با `net.http_post(url := '<SUPABASE_URL>/functions/v1/vectorize', headers := jsonb(Authorization: Bearer <service_role>), body := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id))` فراخوانی غیرهمزمان انجام می‌دهد (شکست شبکه ردیف اصلی را Rollback نمی‌کند).
- تریگر فقط روی تغییر ستون‌های متنی (`title/description` برای tasks، `title/content` برای notes) فعال می‌شود تا از حلقهٔ بی‌نهایت هنگام نوشتن خودِ `embedding` جلوگیری شود.
- آدرس `SUPABASE_URL` و `service_role` به‌صورت تنظیمات دیتابیس (`current_setting('app.settings.*')` یا مقداردهی مستقیم هنگام اجرای SQL) تأمین می‌شوند؛ هرگز در ستون‌های جدول ذخیره نمی‌شوند.

---

## ۴. ذخیره‌سازی فایل (Storage)
- باکت **`chat-media`** (Private): ورودی‌های صوتی/تصویری چت. ساختار مسیر اجباری: `{user_id}/{uuid}.{ext}`.
- باکت **`avatars`** (Private): تصویر پروفایل، مسیر `{user_id}/avatar.{ext}`.
- پالیسی‌های `storage.objects`: کاربر فقط در پوشه‌ای که نام آن `auth.uid()` است می‌تواند `insert/select/delete` کند (`(storage.foldername(name))[1] = auth.uid()::text`).
- Edge Function `ai-assistant` بایت‌های فایل را با **Service Role** از Storage دانلود می‌کند (نه از کلاینت).

---

## ۵. جریان داده (Data Flows)

### ۵.۱. پردازش هوش مصنوعی (مسیر بدون Base64)
1. کلاینت فایل را مستقیم با `supabase.storage.from('chat-media').upload('{uid}/{uuid}.webm', blob)` آپلود می‌کند.
2. کلاینت `ai-assistant` را با بدنهٔ `{ message, mode, history, audioPath?, imagePath? }` صدا می‌زند (**هیچ Base64**).
3. تابع ابتدا `consume_ai_quota()` را صدا می‌زند؛ اگر `allowed=false` → پاسخ `402` با `reason` (مثلاً `quota_exceeded` یا `trial_expired`).
4. تابع مالکیت مسیر را اعتبارسنجی می‌کند (`path` باید با `user.id` شروع شود)، سپس بایت‌ها را از Storage دانلود و به Gemini می‌دهد.
5. مدل Gemini از خروجی `consume_ai_quota.model` انتخاب می‌شود (داینامیک بر اساس پلن).
6. اکشن‌ها از طریق RPC های اتمیک نوشته می‌شوند؛ Realtime نتیجه را به کلاینت می‌رساند.

### ۵.۲. پرداخت زیبال
1. کلاینت `zibal-request` را با `{ plan_code }` صدا می‌زند.
2. تابع مبلغ را از `plans` می‌خواند (نه از کلاینت)، ردیف `payments`(pending) می‌سازد، به `https://gateway.zibal.ir/v1/request` درخواست می‌دهد، `trackId` و URL پرداخت را برمی‌گرداند.
3. کاربر در زیبال پرداخت می‌کند و به `callbackUrl` بازمی‌گردد.
4. `zibal-verify` با `https://gateway.zibal.ir/v1/verify` تأیید سمت سرور می‌کند؛ در صورت موفقیت `payments.status=paid` و `activate_subscription(...)` را فراخوانی می‌کند (**Idempotent**: اگر قبلاً paid بود، دوباره فعال نمی‌کند).

### ۵.۳. Realtime
هر کانال با فیلتر کاربر ساخته می‌شود:
`supabase.channel('tasks:'+uid).on('postgres_changes', { event:'*', schema:'public', table:'tasks', filter: 'user_id=eq.'+uid }, cb)`.

---

## ۶. قوانین درخت فایل (File Tree Rules)
این پروژه **از قبل موجود** است؛ کل درخت بازترسیم نمی‌شود. منطق مسیردهی:

- **SQL بک‌اند:** همهٔ فایل‌ها در `supabase/sql/` با **پیشوند عددیِ ترتیبِ اجرا** و Idempotent. (فایل‌های خراب فعلی `supabase/schema.sql` و `sql/02_add_checklist_column.sql` منسوخ‌اند و جایگزین می‌شوند).
- **توابع لبه:** هر تابع در `supabase/functions/<name>/index.ts`. توابع موجود (`ai-assistant`, `vectorize`) ویرایش می‌شوند؛ توابع جدید (`zibal-request`, `zibal-verify`) ساخته می‌شوند.
- **سرویس‌های دادهٔ کلاینت:** همهٔ دسترسی‌های دیتابیس در `services/*.ts`. سرویس‌های جدید: `services/mediaService.ts`، `services/billingService.ts`، `services/reminderService.ts`.
- **هوک‌ها:** منطق سراسری مثل وضعیت شبکه در `hooks/` (مثلاً `hooks/useNetworkStatus.ts`).
- **کامپوننت‌ها:** UI جدید (Paywall، Onboarding، NetworkBanner، Reminders) در `components/`.
- **تایپ‌ها:** همهٔ تایپ‌های مشترک در `types.ts` (افزودن `Plan`, `Subscription`, `UsageStatus`, `Reminder`).

### نقشهٔ فایل‌های SQL هدف (در `supabase/sql/`)
```
00_extensions.sql        -- pgvector و افزونه‌های لازم
01_profiles.sql          -- profiles + تریگر handle_new_user
02_billing.sql           -- plans(+seed) + subscriptions + usage_counters + ai_requests_log
03_core.sql              -- projects, tasks, notes, habits, habit_completions, media_assets + ایندکس‌ها
04_payments.sql          -- payments
05_reminders.sql         -- reminders
10_functions.sql         -- create_task_with_tags, create_note_with_tags, match_documents, consume_ai_quota, activate_subscription
11_storage.sql           -- ساخت باکت‌ها + پالیسی‌های storage.objects
12_rls.sql               -- فعال‌سازی RLS و پالیسی‌های همهٔ جداول (یا co-located داخل هر فایل؛ این فایل تضمین نهایی است)
```
> هر فایل باید مستقل و چندبار-اجراپذیر باشد. RLS می‌تواند کنار تعریف هر جدول بیاید؛ `12_rls.sql` به‌عنوان تضمین/مرجع نهایی نگه داشته می‌شود.

### متغیرهای محیطی هدف
- **کلاینت (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Edge Functions (Deno):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ZIBAL_MERCHANT`, `ZIBAL_CALLBACK_URL`.
