# tasks.md — نقشه راه مرجع (Hexer AI → Production)

> ترتیب تسک‌ها **متوالی و عمدی** است. تسک‌هایی که روی فایل‌های یکسان می‌نویسند موازی نمی‌شوند.
> مدل کدنویس باید قبل از هر تسک، فقط فایل‌های `CONTEXT_FILES` آن را بخواند و دقیقاً در مسیرهای گفته‌شده خروجی بدهد.
> یادآوری: هیچ تسکی از `supabase` CLI استفاده نمی‌کند؛ همه فایل خام برای اجرای دستی در پنل آنلاین تولید می‌کنند.

---

## فاز ۱ — پایهٔ دیتابیس و امنیت

### تسک ۱: پایهٔ هویت و بیلینگ (Extensions + Profiles + Billing Core)
**راهنمای پیاده‌سازی فنی:**
1. `supabase/sql/00_extensions.sql`: فعال‌سازی `create extension if not exists vector;` (و در صورت نیاز `pgcrypto`).
2. `supabase/sql/01_profiles.sql`: جدول `profiles` (PK = id → auth.users، حذف آبشاری) + ستون‌های `full_name, avatar_url, timezone default 'Asia/Tehran', onboarding_completed default false, created_at, updated_at`. فعال‌سازی RLS با پالیسی «کاربر فقط ردیف خودش». تابع `handle_new_user()` با `SECURITY DEFINER` که به‌صورت اتمیک profile + subscription(free, expires=now()+interval '3 days') + usage_counter می‌سازد، و تریگر `AFTER INSERT ON auth.users`.
3. `supabase/sql/02_billing.sql`: جدول `plans` + درج Seed دقیقاً مطابق `ARCHITECTURE.md §2.2` (free/plus/pro با مبالغ **ریالی** 0/990000/2990000 و سقف 30/400/1000 و دوره 3/30/30 و مدل‌های مشخص). جداول `subscriptions`, `usage_counters`, `ai_requests_log` + RLS.

**محدودیت‌های اختصاصی تسک:**
- همه‌چیز Idempotent (`if not exists`, `create or replace`, `drop policy if exists` قبل از create).
- مبالغ `bigint` ریالی. ساعت پیش‌فرض `Asia/Tehran`.
- این تسک هیچ جدول دامنه‌ای (tasks/notes/...) نمی‌سازد.
- توابع RPC پیچیده (`consume_ai_quota` و ...) در این تسک نوشته **نمی‌شوند** (تسک ۴).

`CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "types.ts"]`

---

### تسک ۲: جداول دامنهٔ اصلی محصول (Core Domain + Indexes)
**راهنمای پیاده‌سازی فنی:**
1. `supabase/sql/03_core.sql`: ساخت `projects`, `tasks`, `notes`, `habits`, `habit_completions`, `media_assets` دقیقاً مطابق `ARCHITECTURE.md §2.4 و §2.5`.
2. ستون‌های کلیدی: `tasks.checklist jsonb default '[]'::jsonb`، `tasks.embedding vector(768)`، `notes.embedding vector(768)`، `tags text[]`. روابط FK با رفتار حذف صحیح (`project_id` → `set null`، `habit_id` → `cascade`).
3. ایندکس‌ها: روی همهٔ `user_id` ها، روی `reminders` بعداً، و ایندکس برداری `ivfflat`/`hnsw` با `vector_cosine_ops` روی دو ستون embedding.
4. فعال‌سازی RLS + پالیسی پایهٔ `auth.uid() = user_id` برای تمام این جداول.

**محدودیت‌های اختصاصی تسک:**
- بُعد بردار **دقیقاً ۷۶۸** (سازگار با `text-embedding-004`).
- نام ستون عادت `name` است (نه title) — مطابق `habitService.ts` و `types.ts`.
- هیچ RPC در این تسک نوشته نمی‌شود.

`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "types.ts", "services/taskService.ts", "services/habitService.ts"]`

---

### تسک ۳: جداول پرداخت و یادآوری (Payments + Reminders)
**راهنمای پیاده‌سازی فنی:**
1. `supabase/sql/04_payments.sql`: جدول `payments` مطابق `§2.3` + RLS (کاربر فقط ردیف‌های خودش را می‌خواند؛ **INSERT/UPDATE حساس فقط سمت سرور** — برای کاربر فقط SELECT مجاز باشد).
2. `supabase/sql/05_reminders.sql`: جدول `reminders` مطابق `§2.5` + ایندکس `(user_id, remind_at)` + RLS کامل (CRUD برای صاحب ردیف).
3. `supabase/sql/12_rls.sql`: فایل تضمینِ نهایی که `alter table ... enable row level security` و پالیسی‌های همهٔ جداول ساخته‌شده تا اینجا را به‌صورت Idempotent جمع می‌کند (به‌عنوان مرجع و تورِ ایمنی).

**محدودیت‌های اختصاصی تسک:**
- روی `payments` نباید به کاربر اجازهٔ INSERT/UPDATE وضعیت پرداخت داده شود (ضدالگوی شمارهٔ ۳ در PROJECT.md).
- `12_rls.sql` نباید جدول جدیدی بسازد؛ فقط RLS/پالیسی.

`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "docs/PROJECT.md", "types.ts"]`

---

### تسک ۴: توابع و تراکنش‌های اتمیک (RPC Layer)
**راهنمای پیاده‌سازی فنی:** در `supabase/sql/10_functions.sql`:
1. `create_task_with_tags(title, description, project_id, due_date, priority, tags, checklist)` — درج اتمیک تسک **به‌همراه checklist** و `user_id := auth.uid()`؛ بازگرداندن ردیف کامل (الگوی فعلی insert+update جداگانه حذف می‌شود).
2. `create_note_with_tags(title, content, project_id, tags)` — مشابه، اتمیک.
3. `match_documents(query_embedding vector(768), match_threshold float, match_count int)` — جستجوی برداری روی tasks+notes با cosine، **اجباراً `where user_id = auth.uid()`**، خروجی `(id, type, content, similarity)`.
4. `consume_ai_quota()` — `SECURITY DEFINER`؛ ردیف usage را `for update` قفل می‌کند؛ پلن فعال و `expires_at` را می‌خواند؛ اگر free منقضی → `allowed=false, reason='trial_expired'`؛ اگر دورهٔ paid گذشته → ریست شمارنده و دوره؛ اگر `request_count >= monthly_quota` → `allowed=false, reason='quota_exceeded'`؛ در غیر این صورت `request_count += 1` و خروجی `(allowed, model, remaining, reason)`.
5. `activate_subscription(p_user_id, p_plan_code, p_payment_id)` — `SECURITY DEFINER`؛ فعال‌سازی اتمیک پلن، `expires_at = now() + period_days`، **ریست `usage_counters`**، Idempotent نسبت به پرداخت تکراری.
6. **اصلاحیه منطق تاریخ در consume_ai_quota:** وقتی سقف مصرف پولی تمام شد و نیاز به ریست شدن داشت، حتماً علاوه بر صفر کردن کانتر، مقدار `period_start` را برابر `now()` و `period_end` را برابر `now() + interval '1 month'` قرار بده تا سیکل مالی خراب نشود.
7. **تریگر Vectorize:** یک تریگر و وبهوک با استفاده از pg_net (یا http_request) بنویس که بعد از هر INSERT یا UPDATE روی جداول `tasks` و `notes`، به‌طور خودکار Edge Function مربوط به vectorize را فراخوانی کند.

**محدودیت‌های اختصاصی تسک:**
- `consume_ai_quota` و `activate_subscription` حتماً `SECURITY DEFINER` با `search_path` امن.
- منطق دوره: free تجمعی بدون ریست؛ plus/pro ماهانه با ریست در عبور از `period_end` (مطابق `ARCHITECTURE.md §3`).
- این تسک به جداول تسک‌های ۱–۳ وابسته است؛ نباید قبل از آن‌ها اجرا شود.

`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "supabase/functions/ai-assistant/index.ts", "services/taskService.ts", "services/noteService.ts"]`

---

### تسک ۵: ذخیره‌سازی فایل و امنیت آن (Storage Buckets + Policies)
**راهنمای پیاده‌سازی فنی:** در `supabase/sql/11_storage.sql`:
1. ساخت باکت‌های Private `chat-media` و `avatars` (insert در `storage.buckets` با `public=false`، Idempotent).
2. پالیسی‌های `storage.objects` برای هر باکت: کاربر فقط در پوشه‌ای که نام آن `auth.uid()::text` است اجازهٔ `insert/select/delete` دارد — با `(storage.foldername(name))[1] = auth.uid()::text`.

**محدودیت‌های اختصاصی تسک:**
- باکت‌ها **هرگز Public نشوند**.
- فقط SQL؛ هیچ کد کلاینت/تابع در این تسک.

`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "docs/PROJECT.md"]`

---

## فاز ۲ — توابع لبه (Edge Functions)

### تسک ۶: ارتقای توابع AI و حذف کامل Base64
**راهنمای پیاده‌سازی فنی:**
1. `supabase/functions/ai-assistant/index.ts` را بازنویسی کن:
   - ورودی جدید: `{ message, history, mode, audioPath?, imagePath? }` — **حذف کامل** پارامترهای `audio`/`image` به‌صورت Base64.
   - ابتدا `consume_ai_quota()` را صدا بزن؛ اگر `allowed=false` → پاسخ `402` با `{ error, reason }`.
   - مالکیت مسیر را چک کن (با `user.id` شروع شود)؛ بایت‌های مدیا را با کلاینت **Service Role** از باکت `chat-media` دانلود و به‌صورت `inlineData` به Gemini بده.
   - مدل را از `consume_ai_quota.model` انتخاب کن (داینامیک، نه هاردکد).
   - بقیهٔ منطق (RAG با `match_documents`، تجزیهٔ اکشن‌ها، فراخوانی `create_task_with_tags`/`create_note_with_tags`) حفظ شود.
2. `supabase/functions/vectorize/index.ts`: هماهنگ‌سازی نام env به `SUPABASE_SERVICE_ROLE_KEY` و اطمینان از بُعد ۷۶۸؛ منطق fire-and-forget حفظ شود.

**محدودیت‌های اختصاصی تسک:**
- هیچ مسیر Base64 باقی نماند (ضدالگوی ۵).
- `service_role` فقط از `Deno.env`.
- خروجی JSON و قرارداد پاسخ (`reply, citations, actionResults, transcription`) با کلاینت سازگار بماند تا تسک ۸ ساده شود.
- حیاتی: برای دانلود فایلهای رسانه از باکتِ Private (chat-media)، کلاینتِ Supabase در داخل تابع لبه باید با کلید SUPABASE_SERVICE_ROLE_KEY ساخته شود، در غیر این صورت دسترسی مسدود خواهد شد.

`CONTEXT_FILES: ["supabase/functions/ai-assistant/index.ts", "supabase/functions/vectorize/index.ts", "docs/ARCHITECTURE.md", "components/ChatView.tsx"]`

---

### تسک ۷: توابع پرداخت زیبال (Request + Verify)
**راهنمای پیاده‌سازی فنی:**
1. `supabase/functions/zibal-request/index.ts`: ورودی `{ plan_code }`؛ کاربر را از JWT بگیر؛ مبلغ را از جدول `plans` بخوان (**نه از کلاینت**)؛ ردیف `payments`(pending) بساز؛ به `https://gateway.zibal.ir/v1/request` با `merchant=ZIBAL_MERCHANT`, `amount`, `callbackUrl=ZIBAL_CALLBACK_URL`, `orderId=payments.id` درخواست بده؛ `trackId` را ذخیره و `{ payUrl: 'https://gateway.zibal.ir/start/'+trackId }` را برگردان.
2. `supabase/functions/zibal-verify/index.ts`: ورودی `{ trackId }` (یا کوئری‌پارام callback)؛ به `https://gateway.zibal.ir/v1/verify` درخواست بده؛ اگر `result==100` → `payments.status=paid, ref_number, paid_at` و `activate_subscription(user_id, plan_code, payment_id)` را صدا بزن؛ **Idempotent** (اگر قبلاً paid بود دوباره فعال نکن).

**محدودیت‌های اختصاصی تسک:**
- نتیجهٔ پرداخت فقط با Verify سمت سرور نهایی شود (ضدالگوی ۴).
- مبلغ هرگز از کلاینت گرفته نشود.
- این تسک به `activate_subscription` (تسک ۴) و جدول `payments` (تسک ۳) وابسته است.

`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "supabase/sql/10_functions.sql", "supabase/sql/04_payments.sql"]`

---

## فاز ۳ — فرانت‌اند و یکپارچه‌سازی

### تسک ۸: بازطراحی خط لولهٔ مدیا در کلاینت (Storage Upload Pipeline)
**راهنمای پیاده‌سازی فنی:**
1. `services/supabaseClient.ts`: انتقال URL/AnonKey هاردکد به `import.meta.env.VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY`.
2. `services/mediaService.ts` (جدید): تابع `uploadChatMedia(blob, ext)` که به `chat-media/{user.id}/{uuid}.{ext}` آپلود می‌کند و `path` را برمی‌گرداند (و در `media_assets` ثبت می‌کند).
3. `components/ChatView.tsx`: حذف `compressImage→base64`/`blobToBase64` در مسیر ارسال؛ به‌جای آن فایل به Storage آپلود و فقط `audioPath`/`imagePath` به `ai-assistant` ارسال شود. مدیریت خطای `402` (نمایش پیام «سقف مصرف/پایان دوره آزمایشی» و دکمهٔ ارتقا).

**محدودیت‌های اختصاصی تسک:**
- فشرده‌سازی تصویر قبل از آپلود مجاز است؛ اما تبدیل نهایی به Base64 برای ارسال شبکه‌ای ممنوع.
- قرارداد UI پیام‌ها/سیتیشن‌ها حفظ شود.

`CONTEXT_FILES: ["components/ChatView.tsx", "services/supabaseClient.ts", "supabase/functions/ai-assistant/index.ts", "supabase/sql/11_storage.sql"]`

---

### تسک ۹: اشتراک، Paywall و بازگشت از پرداخت (Billing UI)
**راهنمای پیاده‌سازی فنی:**
1. `types.ts`: افزودن `Plan`, `Subscription`, `UsageStatus`.
2. `services/billingService.ts` (جدید): `getSubscription()`, `getUsage()`, `startChekout(plan_code)` (صدا زدن `zibal-request` و ریدایرکت به `payUrl`), `verifyPayment(trackId)` (صدا زدن `zibal-verify`).
3. `components/PaywallModal.tsx` (جدید): نمایش سه پلن از `plans`، مصرف باقیمانده، و دکمهٔ ارتقا.
4. مدیریت بازگشت کاربر از زیبال (خواندن `trackId` از URL در ورود اپ و فراخوانی verify + نمایش نتیجه).

**محدودیت‌های اختصاصی تسک:**
- هیچ مبلغ/مدلی در کلاینت هاردکد نشود؛ همه از `plans`/`subscriptions` خوانده شود.
- کلاینت هرگز اشتراک را مستقیماً فعال نمی‌کند (فقط verify سمت سرور).

`CONTEXT_FILES: ["types.ts", "services/supabaseClient.ts", "contexts/AuthContext.tsx", "components/Modal.tsx", "components/icons.tsx", "App.tsx"]`

---

### تسک ۱۰: تجربهٔ Production (Onboarding + Reminders + Realtime امن + افت تدریجی)
**راهنمای پیاده‌سازی فنی:**
1. **Realtime امن:** در `App.tsx` همهٔ کانال‌ها با `filter: 'user_id=eq.'+user.id` بازنویسی شوند (ضدالگوی ۹).
2. **Onboarding:** کامپوننت `components/Onboarding.tsx` که اگر `profiles.onboarding_completed=false` بود نمایش داده می‌شود و در پایان آن را `true` می‌کند.
3. **Reminders:** `services/reminderService.ts` + UI سبک برای ساخت/نمایش یادآوری‌ها؛ استفاده از Web Notifications API و Realtime روی `reminders`.
4. **افت تدریجی (Graceful Degradation):** `hooks/useNetworkStatus.ts` (online/offline) + `components/NetworkBanner.tsx`؛ افزودن تایم‌اوت/تلاش‌مجدد و Toast فارسی به فراخوانی‌های Supabase؛ تضمین عدم کرش هنگام قطع اینترنت.

**محدودیت‌های اختصاصی تسک:**
- این تسک `App.tsx` را ویرایش می‌کند؛ نباید هم‌زمان با تسک ۹ (که نیز ممکن است `App.tsx` را لمس کند) اجرا شود — ابتدا ۹ سپس ۱۰.
- هیچ خطایی نباید بی‌صدا بلعیده شود؛ همه پیام فارسی + قابلیت تلاش مجدد داشته باشند.

`CONTEXT_FILES: ["App.tsx", "contexts/AuthContext.tsx", "hooks/useDataManager.ts", "components/BottomNav.tsx", "services/supabaseClient.ts", "types.ts"]`

---

## فاز ۴ — انتشار (Launch Checklist)
این فاز تسکِ کدنویسی نیست؛ چک‌لیست عملیاتی پیش از لانچ است که کاربر (مالک محصول) انجام می‌دهد:
1. اجرای ترتیبیِ `supabase/sql/00 → 12` در SQL Editor پنل آنلاین.
2. آپلود توابع `ai-assistant`, `vectorize`, `zibal-request`, `zibal-verify` و ست‌کردن Secrets (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZIBAL_MERCHANT`, `ZIBAL_CALLBACK_URL`).
3. تست RLS با دو کاربر مجزا (کاربر A نباید دادهٔ B را ببیند).
4. تست کامل چرخهٔ پرداخت در سندباکس زیبال (merchant=`zibal`) و سپس مرچنت واقعی.
5. تست سناریوهای خطا: قطع اینترنت، تایم‌اوت، سقف مصرف، انقضای دورهٔ آزمایشی.
6. ست‌کردن متغیرهای محیطی کلاینت (`VITE_*`) و بیلد Production با Vite.
