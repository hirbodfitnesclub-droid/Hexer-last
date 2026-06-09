# tasks.md — نقشه‌ی راه فاز F (Hexer AI)

> مرجع معماری: `PROJECT.md §۸` و `ARCHITECTURE.md §۹`. هر تسک با هویت و قوانین آن اسناد سازگار است.
> **قانون SQL:** هیچ فایل SQL موجود ویرایش نمی‌شود؛ فایل جدید با پیشوند `31`+ ساخته می‌شود و مالک آن را دستی در SQL Editor اجرا می‌کند.
> **قانون آیکون:** فقط از `components/icons.tsx` (نه ایموجی). **قانون Tailwind:** فقط مقادیر معتبر scale (نه `350/450/855`، نه `z-45`، نه `dir-rtl`).
> **اپ Mobile-Only است:** گرید/بریک‌پوینت دسکتاپ (`md:`/`lg:`) در لایه‌ی اصلی ممنوع.

---

## خلاصه‌ی فازهای پیشین (فقط برای زمینه — انجام‌شده)
- **معماری feature-based** پیاده شده: `DataContext` + `useDataManager` + `useRealtimeSync`؛ `App.tsx` فقط Provider/Routing/Global Modals.
- **بک‌اند پایدار:** RLS روی همه‌ی جداول کاربر، RPCهای اتمیک (`create_task_with_tags`, `hybrid_search`, `consume_ai_quota`, `get_usage_status`, `get_daily_usage`, لینک تسک↔نوت)، توابع لبه‌ی ماژولار `ai-assistant` + `vectorize` با مدل امبدینگ مشترک `text-embedding-004`.
- **فاز E (کارت‌به‌کارت) کامل:** `28_card_to_card_system.sql`، `30_telegram_notifications.sql` (جدول `telegram_settings` + تریگر تلگرام روی `payments`)، سرویس `billingService`، مودال‌های `SubscriptionModal`/`PaymentMethodModal`/`ReceiptUploadModal` و اکشن‌های ادمین (`list_manual_payments`/`approve`/`reject`).

> نقشه‌ی وابستگی فاز F: **F1, F2, F3, F4, F5, F6 مستقل‌اند** (می‌توانند جدا انجام شوند). **F7 → F8** متوالی (F8 به اسکیمای پروژه‌ی F7 وابسته است). **F9 مستقل** اما به الگوی تلگرام موجود متکی است.

---

### تسک F1 — PWA کامل + رفع باگ ویوپورت/هدر سافاری [انجام‌شده - COMPLETED]

**راهنمای پیاده‌سازی فنی:**
1. **آیکون‌ها:** تولید لوگوی هکسر و ساخت `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png` (۱۸۰×۱۸۰)، پس‌زمینه‌ی تیره برند.
2. **`public/manifest.webmanifest`:** طبق `ARCHITECTURE.md §۹.۱` (standalone، portrait، `theme/background = #09090b`، `dir=rtl`, `lang=fa`، آرایه‌ی icons شامل maskable).
3. **`index.html`:** افزودن `<link rel="manifest">`, `theme-color`, متاهای `apple-mobile-web-app-*`, `apple-touch-icon`، و اصلاح viewport به `viewport-fit=cover`.
4. **`public/sw.js`:** Service Worker سبک دست‌نویس؛ **network-first** برای navigate/داده، **cache-first** فقط asset ثابت؛ نسخه‌بندی `CACHE_VERSION` و پاک‌سازی کش قدیمی در `activate`؛ **هرگز** کش `*.supabase.co`.
5. **`index.tsx`:** ثبت SW پس از `load` با گارد `'serviceWorker' in navigator` و try/catch.
6. **رفع هدر سافاری:** در `App.tsx` کانتینر ریشه از `h-screen` به `h-[100dvh]`؛ در `index.css` افزودن `html,body{height:100%;overscroll-behavior-y:none;}` و متغیرهای `--safe-area-inset-*` در صورت نبود.

**محدودیت‌های اختصاصی تسک:**
- ✅ SW دست‌نویس و مینیمال. ✅ یک منبع واحد برای متادیتای PWA.
- ❌ افزودن کتابخانه‌ی PWA/workbox. ❌ کش تهاجمی HTML/API (ضدالگو ۳۳/۳۴). ❌ تغییر منطق احراز/داده.

CONTEXT_FILES: ["index.html", "index.tsx", "App.tsx", "index.css"]

---

### تسک F2 — اصلاح جهت آیکون بازگشت در RTL [انجام‌شده - COMPLETED]

**راهنمای پیاده‌سازی فنی:**
1. در مودال‌هایی که دکمه‌ی «بازگشت» دارند، آیکونی که به سمت داخل/چپ اشاره می‌کند با `ChevronRightIcon` (موجود در `icons.tsx`) جایگزین شود تا در RTL به **راست** (لبه‌ی شروع) اشاره کند.
2. هدف اصلی: `features/notes/components/NoteEditorModal.tsx` (الگوی `ChevronDownIcon` + `rotate-90`). بررسی و در صورت وجود همین مشکل، اصلاح `features/projects/components/ProjectDetailsModal.tsx` و `features/chat/components/MoreCitationsModal.tsx`.

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط جهت/آیکون بازگشت. ✅ حفظ کلاس‌های اندازه و رفتار onClick.
- ❌ تغییر چیدمان کلی هدر. ❌ ترفند `rotate-90` برای جهت‌دهی (ضدالگو ۳۶).

CONTEXT_FILES: ["components/icons.tsx", "features/notes/components/NoteEditorModal.tsx", "features/projects/components/ProjectDetailsModal.tsx", "features/chat/components/MoreCitationsModal.tsx"]

---

### تسک F3 — رفع اسکرول افقی اشتراک + نمایش مصرف در اشتراک

**راهنمای پیاده‌سازی فنی:**
1. **اسکرول افقی:** در `SubscriptionPage.tsx` گرید دسکتاپ‌محور به `grid-cols-1` تبدیل شود؛ کارت‌ها/باکس فاکتور `min-w-0` + `max-w-full` + شکست متن بگیرند. در `App.tsx` روی `<main>` کلاس `overflow-x-hidden` افزوده شود. ممیزی `SubscriptionModal.tsx`, `PaymentMethodModal.tsx`, `ReceiptUploadModal.tsx` برای حذف هر عرض ثابتِ بزرگ‌تر از ویوپورت.
2. **نمایش مصرف:** افزودن `UsageMeter` به بالای محتوای `SubscriptionModal` فقط در حالت عادی/active (نه در حالت قفل `pending_manual`).

**محدودیت‌های اختصاصی تسک:**
- ✅ بازاستفاده از `UsageMeter` موجود. ✅ استاندارد اپل/ریسپانسیو بدون بیرون‌زدگی عرضی (ضدالگو ۳۵).
- ❌ گرید/بریک‌پوینت دسکتاپ (ضدالگو ۲۶). ❌ نمایش `UsageMeter` در حالت `pending` قفل‌شده. ❌ تغییر منطق پرداخت.

CONTEXT_FILES: ["App.tsx", "features/billing/pages/SubscriptionPage.tsx", "features/billing/components/SubscriptionModal.tsx", "features/billing/components/PaymentMethodModal.tsx", "features/billing/components/ReceiptUploadModal.tsx", "features/billing/components/UsageMeter.tsx"]

---

### تسک F4 — رفع باگ دکمه‌های حالت AI + نمایش مصرف در چت

**راهنمای پیاده‌سازی فنی:**
1. **باگ حالت:** در `features/chat/ChatView.tsx` فراخوانی‌های `ModeChip` با `m=` به `mode=` تصحیح شوند. در `ModeChip.tsx` کلاس نامعتبر `ring-sky-450/55` به `ring-sky-400/50` اصلاح و کنتراست حالت فعال واضح شود (دقیقاً یک حالت فعال).
2. **مصرف در چت:** نمای فشرده‌ی مصرف در هدر `ChatView` یا empty-state. برای پرهیز از کوئری تکراری، یا پراپ `compact` به `UsageMeter` افزوده شود یا کامپوننت سبک فقط با `get_usage_status`. deps پایدار، بدون لوپ رندر (ضدالگو ۳).

**محدودیت‌های اختصاصی تسک:**
- ✅ «دقیقاً یک حالت فعال» با highlight واضح (ضدالگو ۳۷). ✅ کلاس Tailwind معتبر.
- ❌ تغییر منطق ارسال پیام/سشن. ❌ فچ مصرف داخل بدنه‌ی رندر بدون deps پایدار.

CONTEXT_FILES: ["features/chat/ChatView.tsx", "features/chat/components/ModeChip.tsx", "features/billing/components/UsageMeter.tsx", "types.ts"]

---

### تسک F5 — اصلاح جایگاه دکمه‌های لینک تسک↔یادداشت

**راهنمای پیاده‌سازی فنی:**
1. در `TaskEditorModal.tsx`: انتقال `LinkNotePicker` از بخش view-mode به **داخل فرم اصلی edit-mode** در جایگاهی منطقی (پس از فیلدهای اصلی/کنار انتخاب پروژه). برای تسک جدید بدون `id`، یا لینک پس از اولین ذخیره فعال شود یا با راهنمای کوتاه غیرفعال نمایش داده شود.
2. در `NoteEditorModal.tsx`: انتقال `LinkTaskPicker` به جایگاه در‌دسترس‌تر داخل فرم (نه انتهای canvas).
3. حفظ اتصال‌ها از `services/linkService.ts` (`linkTaskNote`/`unlinkTaskNote`/`getLinked*`). اصلاح کلاس نامعتبر `text-zinc-350` در `LinkNotePicker.tsx` به `text-zinc-300`.

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط جابه‌جایی/بهبود UX و کلاس معتبر. ✅ حفظ رفتار لینک/آنلینک فعلی.
- ❌ تغییر بک‌اند یا امضای سرویس لینک. ❌ ساخت RPC جدید.

CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/tasks/components/LinkNotePicker.tsx", "features/notes/components/NoteEditorModal.tsx", "features/notes/components/LinkTaskPicker.tsx", "services/linkService.ts"]

---

### تسک F6 — فید (محو نرم) لبه‌های لیست‌های اسکرول‌خور

**راهنمای پیاده‌سازی فنی:**
1. افزودن یک کلاس کمکی در `index.css` با `mask-image`/`-webkit-mask-image` به‌صورت `linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)` برای محو لبه‌های بالا/پایین ناحیه‌ی اسکرول.
2. اعمال روی کانتینر اسکرول `features/notes/NotesView.tsx` و `features/projects/ProjectsView.tsx` (و در صورت نیاز `features/tasks/TasksView.tsx`). جایگزین کات سخت قبلی.

**محدودیت‌های اختصاصی تسک:**
- ✅ هماهنگی با پس‌زمینه‌ی هر صفحه. ✅ حفظ عملکرد اسکرول/کلیک.
- ❌ شکستن چیدمان sticky هدر/FAB. ❌ overlayای که کلیک آیتم‌ها را بگیرد (از `pointer-events-none` استفاده شود).

CONTEXT_FILES: ["index.css", "features/notes/NotesView.tsx", "features/projects/ProjectsView.tsx", "features/tasks/TasksView.tsx"]

---

### تسک F7 — بک‌اند RAG پروژه‌ها (اسکیما + وکتورایز)

**راهنمای پیاده‌سازی فنی:**
1. فایل جدید `supabase/sql/31_rag_projects.sql` (Idempotent، اجرای دستی):
   - `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS embedding vector(768);`
   - تریگر `enqueue_vectorize` روی `projects` با `type='project'` (الگوی `22_fix_vectorize_webhook.sql`).
   - بازنویسی `hybrid_search` (`create or replace`) با افزودن `UNION ALL` پروژه‌ها (`type='project'`, `snippet=COALESCE(description,'')`)، همان آستانه‌ها/RFF و `where user_id = auth.uid()`.
   - `NOTIFY pgrst, 'reload schema';`
2. `supabase/functions/vectorize/index.ts`: افزودن شاخه‌ی `type==='project'` → `table='projects'`, `combinedText = title + ' ' + description (+ tags اگر بود)`.

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط فایل SQL جدید `31_...`. ✅ Idempotent، امبدینگ ۷۶۸، مدل مشترک از `_shared/gemini-client.ts`.
- ❌ ویرایش SQL موجود. ❌ trigger وکتورایز از کلاینت (ضدالگو ۴۰/۱۵). ❌ تغییر آستانه‌ها برای tasks/notes موجود.

CONTEXT_FILES: ["supabase/sql/26_update_hybrid_search.sql", "supabase/sql/22_fix_vectorize_webhook.sql", "supabase/sql/20_refactor_schema.sql", "supabase/functions/vectorize/index.ts", "supabase/functions/_shared/gemini-client.ts"]

---

### تسک F8 — زمینه‌ی پروژه‌محور AI + گیت Intent (ضدِ پیشنهاد خودسرانه)

**راهنمای پیاده‌سازی فنی:**
1. `supabase/functions/ai-assistant/lib/meta-context.ts`: هنگام واکشی پروژه‌ها، `description` نیز خوانده و خلاصه‌ای از هدف هر پروژه به context افزوده شود (برای تصمیم درست لینک نوت/تسک به پروژه).
2. `supabase/functions/ai-assistant/lib/system-prompt.ts`:
   - معرفی پروژه‌ها به‌عنوان موجودیت قابل‌مرجع.
   - **Intent-gating:** قانون صریح که پیشنهاد دیتای مرتبط و `SUGGEST_LINK` فقط هنگام نیت آشکارِ جستجو/پیدا کردن/ساختن/پیگیری/لینک مجاز است؛ در گفت‌وگوی معمولی هیچ پیشنهاد اضافه تولید نشود.
3. `supabase/functions/ai-assistant/lib/action-processor.ts`: مدیریت ایمن `type='project'` در نتایج `SUGGEST_LINK` (بدون شکستن مسیر task/note).
4. سازگاری کلاینت: اگر citation با `type='project'` آمد، کلیک آن در `ChatView`/`CitationCard` کرش نکند (افت تدریجی).

**محدودیت‌های اختصاصی تسک:**
- ✅ حفظ قرارداد API (`reply/citations/actionResults/proposals`). ✅ افت تدریجی خطا (return `''`/`[]`).
- ❌ ذخیره‌ی بی‌اجازه‌ی خروجی AI (ضدالگو ۱۷). ❌ پیشنهاد خودسرانه (ضدالگو ۳۸). ❌ هاردکد نام مدل.

CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/meta-context.ts", "supabase/functions/ai-assistant/lib/system-prompt.ts", "supabase/functions/ai-assistant/lib/action-processor.ts", "supabase/functions/ai-assistant/lib/rag-context.ts", "features/chat/ChatView.tsx", "features/chat/components/CitationCard.tsx"]

---

### تسک F9 — سیستم ثبت تیکت پشتیبانی (DB + ادمین + کلاینت)

**راهنمای پیاده‌سازی فنی:**
1. فایل جدید `supabase/sql/32_support_tickets.sql` (Idempotent، اجرای دستی):
   - جدول `support_tickets` طبق `ARCHITECTURE.md §۹.۹.۱` با RLS مالک‌محور (SELECT/INSERT روی `auth.uid()=user_id`؛ بدون UPDATE/DELETE کلاینت).
   - تابع و تریگر `notify_telegram_on_new_ticket()` دقیقاً مثل `notify_telegram_on_manual_payment` در `30_telegram_notifications.sql` (همان `telegram_settings`، پیام HTML فارسی، `net.http_post`). تریگر `AFTER INSERT`.
   - `NOTIFY pgrst, 'reload schema';`
2. `supabase/functions/admin-api/index.ts`: افزودن اکشن `list_tickets` (الگوی `list_manual_payments`) با join دستی `profiles`.
3. کلاینت:
   - `services/ticketService.ts` (جدید): `submitTicket(subject, message)` با INSERT مالک‌محور (RLS کافی است) و `getMyTickets()` اختیاری.
   - `components/SupportTicketModal.tsx` (جدید): فرم عنوان + توضیحات + اعتبارسنجی + Toast موفقیت، و دکمه‌ی **«گفتگو در تلگرام»** (باز کردن لینک چت پشتیبانی در تب جدید).
   - `components/ProfileModal.tsx`: افزودن آیتم «پشتیبانی و ارسال تیکت» که `SupportTicketModal` را باز می‌کند (جایگزین یک placeholder غیرفعال).

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط SQL جدید `32_...`. ✅ RLS مالک‌محور. ✅ z-index طبق §۷.۲ (تیکت روی ProfileModal).
- ❌ ویرایش SQL موجود. ❌ توکن/چت‌آیدی بات تلگرام در کلاینت (ضدالگو ۳۹/۹). ❌ مشاهده‌ی همه‌ی تیکت‌ها از کلاینت (فقط `admin-api`).

CONTEXT_FILES: ["supabase/sql/32_support_tickets.sql", "supabase/sql/30_telegram_notifications.sql", "supabase/functions/admin-api/index.ts", "components/ProfileModal.tsx", "services/billingService.ts", "services/supabaseClient.ts"]

> نکته: فایل `supabase/sql/32_support_tickets.sql` هنوز وجود ندارد و در همین تسک ساخته می‌شود؛ مسیر در CONTEXT_FILES به‌عنوان مقصدِ ساخت آمده تا کدنویس الگوی `30_telegram_notifications.sql` را عیناً دنبال کند.

---
###یادآوری نکته مهم:
 تو هیچ وقت نباید یک فایل sql رو ویرایش کنی. چون ما در سوپابیس این فایل ها را از طریق sql editor دیپلوی میکنیم و این فایلقبلا دیپلوی شده؛ پس باید برای ایجاد تغییرات یک فایل کاملا جدید بسازی که با دیپلوی کردنش تغییراتی که نیاز داریم انجام بشه."

---


---

# tasks.md — نقشه‌ی راه فاز G (Hexer AI)

> فاز G = ۵ قابلیت UX/Feature. هر تسک خرد، متوالی و دارای آرایه‌ی `CONTEXT_FILES` با مسیرهای واقعیِ موجود است. تسک‌هایی که فایل مشترک (به‌ویژه `App.tsx`) را Read/Write می‌کنند **هرگز موازی نمی‌شوند**. جزئیات معماری در `ARCHITECTURE.md §۱۰`.

## خلاصه‌ی نگاشت درخواست‌ها به تسک‌ها
- تسک ۱ (نوتیفیکیشن) ⇒ G1.1 … G1.5
- تسک ۲ (آکاردئون پروژه‌ها) ⇒ G2
- تسک ۳ (مودال‌های موقت) ⇒ G3
- تسک ۴ (لینک تسک↔یادداشت) ⇒ G4.1 … G4.3
- تسک ۵ (داشبورد عادات) ⇒ G5.1 … G5.3

---

## G1 — سیستم نوتیفیکیشن هوشمند تسک‌ها

### تسک G1.1 — هندلرهای Push در Service Worker
- **راهنمای پیاده‌سازی:** در `public/sw.js` افزودن `self.addEventListener('push', e => { const d = e.data?.json(); self.registration.showNotification(d.title, { body: d.body, dir: 'rtl', tag: d.tag, data: d.data }) })` و `notificationclick` (بستنِ notification، `clients.matchAll` برای focus، در نبودِ کلاینت `clients.openWindow('/')`). بامپ `CACHE_VERSION`.
- **محدودیت‌ها:** فقط افزودن دو هندلر؛ استراتژی‌های cache/fetch موجود دست‌نخورده. هیچ pushِ واقعی اینجا ساخته نمی‌شود.
- `CONTEXT_FILES: ["public/sw.js", "public/manifest.webmanifest"]`

### تسک G1.2 — اسکیمای Push Subscriptions + RPC (SQL)
- **راهنمای پیاده‌سازی:** ساخت `supabase/sql/34_push_subscriptions.sql` طبق `ARCHITECTURE.md §۱۰.۱` (جدول `push_subscriptions` + index + RLS بر `auth.uid()=user_id` + RPC `upsert_push_subscription` با `security definer`). فایل کاملاً Idempotent و آماده‌ی اجرای دستی در پنل Supabase.
- **محدودیت‌ها:** بدون اتکا به CLI. `notify pgrst, 'reload schema'` در انتها. هیچ policy خواندنِ public.
- `CONTEXT_FILES: ["supabase/sql/05_reminders.sql", "supabase/sql/30_telegram_notifications.sql"]`

### تسک G1.3 — زمان‌بند سررسید + Edge `push-dispatch`
- **راهنمای پیاده‌سازی:** ساخت `supabase/sql/35_reminder_dispatch.sql` (تابع/ویوِ یافتن تسک‌های زمان‌دارِ سررسیده‌ی پنجره‌ی جاری + دِدوپ با `reminders.is_sent` + زمان‌بندِ `pg_cron` که هر دقیقه با `net.http_post` تابع لبه را صدا می‌زند). ساخت `supabase/functions/push-dispatch/index.ts` که با `service_role` و VAPID از `Deno.env`، Web Push به subscriptionها می‌فرستد و `is_sent` را ست می‌کند؛ تلنگر روزانه را هم پوشش دهد.
- **محدودیت‌ها:** کلید خصوصی VAPID فقط `Deno.env`. ارسال push فقط اینجا. هم‌سبکِ تریگر تلگرامِ موجود.
- **وابستگی:** پس از G1.2.
- `CONTEXT_FILES: ["supabase/sql/34_push_subscriptions.sql", "supabase/sql/30_telegram_notifications.sql", "supabase/sql/05_reminders.sql", "services/reminderService.ts"]`

### تسک G1.4 — لایه‌ی سرویس کلاینت + متن تلنگر
- **راهنمای پیاده‌سازی:** ویرایش `services/reminderService.ts`: افزودن `subscribeToPush(vapidPublicKey)` (استفاده از `serviceWorker.ready.pushManager.subscribe`)، `saveSubscription()` (صدا زدن RPC `upsert_push_subscription`)، و `showViaSW(title, body)`. ساخت `utils/notificationCopy.ts` (توابع خالص، آرایه‌ی کوچک کپی صمیمیِ نسل‌Z، چرخش بدون رباتیک‌بودن).
- **محدودیت‌ها:** کلید عمومی VAPID از `import.meta.env.VITE_*`. خطا silent نه — مدیریت با پیام فارسی. متن‌ها فقط از util.
- **وابستگی:** پس از G1.2 (RPC).
- `CONTEXT_FILES: ["services/reminderService.ts", "services/supabaseClient.ts", "utils/dateUtils.ts", "vite.config.ts"]`

### تسک G1.5 — هوک زمان‌بندِ Foreground + اتصال در App
- **راهنمای پیاده‌سازی:** ساخت `hooks/useReminderScheduler.ts` (لایه A: `setTimeout` برای تسک‌های زمان‌دارِ امروز + تلنگر روزانه با ضدِ تکرارِ `localStorage` به‌وقت Tehran؛ پاکسازی timeoutها در cleanup؛ واکنش به `visibilitychange`/`online`). اتصال هوک در `App.tsx` و درخواست permission در لحظه‌ی طبیعی؛ ثبت subscription با `reminderService` اگر مرورگر پشتیبانی می‌کند.
- **محدودیت‌ها:** هیچ نوتیفیکیشن دوتایی؛ تلنگر حداکثر ۱/روزِ Tehran؛ افت تدریجی اگر Push پشتیبانی نشد (فقط لایه A).
- **وابستگی:** پس از G1.1 و G1.4. **روی `App.tsx` با G3/G4.1/G5 سریال است.**
- `CONTEXT_FILES: ["App.tsx", "hooks/useReminderScheduler.ts", "services/reminderService.ts", "utils/notificationCopy.ts", "utils/dateUtils.ts", "contexts/DataContext.tsx", "hooks/useDataManager.ts"]`

---

## G2 — آکاردئون لیست پروژه‌ها

### تسک G2 — آیتم آکاردئونی پروژه + بازآرایی ProjectsView
- **راهنمای پیاده‌سازی:** ساخت `features/projects/components/ProjectAccordionItem.tsx` (هدر کلیک‌پذیر با نقطه‌ی رنگ + نام + `ChevronDownIcon` چرخان + شمارنده از `calculateProjectStats`؛ بدنه‌ی collapsible با لیستِ inlineِ فشرده‌ی تسک‌های پروژه — چک‌باکس toggle و کلیک برای باز کردن `TaskEditorModal`). ویرایش `features/projects/ProjectsView.tsx`: state `expandedIds: Set<string>` با پیش‌فرض **خالی** (همه بسته)؛ map روی `ProjectAccordionItem`؛ فیلتر `task.project_id === project.id`؛ گروه اختیاری «بدون پروژه».
- **محدودیت‌ها:** پیش‌فرض همه بسته. `aria-expanded` + tap target ≥۴۴px. کلاس‌های Tailwind معتبر، single-column (mobile-only). توگل کامل از روی نام یا فلش. ماندگاریِ expanded فقط در `localStorage` (UI-only).
- `CONTEXT_FILES: ["features/projects/ProjectsView.tsx", "features/projects/components/ProjectCard.tsx", "features/projects/utils/projectStats.ts", "features/tasks/components/TaskCard.tsx", "features/tasks/components/TaskEditorModal.tsx", "components/icons.tsx", "contexts/DataContext.tsx", "types.ts"]`

---

## G3 — سیستم مودال‌های موقت (Announcements)

### تسک G3.1 — اسکلت پوشه، تایپ، config و storage
- **راهنمای پیاده‌سازی:** ساخت `features/announcements/types.ts` (`AnnouncementMeta`), `features/announcements/config.ts` (۳ بازه‌ی Asia/Tehran + `MAX_PER_DAY=3`), `features/announcements/storage.ts` (هلپرهای `localStorage` کلیدخورده با `getTehranDateString`: impression هر بازه + `dismissedIds`+version), و `features/announcements/TemporaryModals/_Example.tsx` (الگوی `export default` + `export const meta`), و `features/announcements/TemporaryModals/archive/.gitkeep`.
- **محدودیت‌ها:** مرز روز فقط با `utils/dateUtils.ts`. `localStorage` فقط برای ردگیری نمایش (مجاز). الگوی نمونه باید با `components/Modal.tsx` بسازد.
- `CONTEXT_FILES: ["components/Modal.tsx", "utils/dateUtils.ts", "components/icons.tsx"]`

### تسک G3.2 — کنترلر AnnouncementManager + اتصال در App
- **راهنمای پیاده‌سازی:** ساخت `features/announcements/AnnouncementManager.tsx` با کشف خودکار `import.meta.glob('./TemporaryModals/*.tsx', { eager: true })` (آرشیو خودکار مستثنا)؛ اعمال سیاست ۳/روز در ۳ بازه؛ انتخاب بر اساس `priority`/`version`؛ رندر مودال منتخب و ثبت impression. اتصال `<AnnouncementManager />` در `App.tsx` (هم‌تراز مودال‌های سراسری).
- **محدودیت‌ها:** بدون رجیستری دستی. مودال‌های `archive/` هرگز نمایش داده نشوند. سقف ۳/روز نشکند. **روی `App.tsx` با G1.5/G4.1/G5 سریال است.**
- **وابستگی:** پس از G3.1.
- `CONTEXT_FILES: ["App.tsx", "features/announcements/config.ts", "features/announcements/storage.ts", "features/announcements/types.ts", "components/Modal.tsx", "utils/dateUtils.ts"]`

---

## G4 — بازطراحی فلوی لینک تسک↔یادداشت

### تسک G4.1 — لایه‌ی داده: بازگشتِ موجودیت ساخته‌شده
- **راهنمای پیاده‌سازی:** ویرایش `hooks/useDataManager.ts`: در `addTask` و `addNote` پس از موفقیت `return newTask;` / `return newNote;`. ویرایش هندلرهای save در `App.tsx` (`handleSaveModalTask`/`handleSaveModalNote`) و `features/projects/ProjectsView.tsx` تا موجودیتِ ذخیره‌شده را `return`/`await` کنند (قرارداد `onSave: => Promise<Task|Note>`).
- **محدودیت‌ها:** فقط افزودن مقدار برگشتی و propagate آن؛ هیچ رگرسیون در optimistic UI. **هاتْ‌اسپات `App.tsx` — با G1.5/G3.2/G5 سریال.**
- `CONTEXT_FILES: ["hooks/useDataManager.ts", "App.tsx", "features/projects/ProjectsView.tsx", "services/taskService.ts", "services/noteService.ts", "types.ts"]`

### تسک G4.2 — لینک در حالت ایجاد + refactor LinkNotePicker (مودال تسک)
- **راهنمای پیاده‌سازی:** ویرایش `features/tasks/components/LinkNotePicker.tsx` به الگوی انتخاب‌گر با callbackِ `onSelect` (عدم صدای مستقیم linkService در حالت draft). ویرایش `features/tasks/components/TaskEditorModal.tsx`: state `pendingLinkIds`؛ در حالت new انتخاب‌ها در pending جمع و به‌صورت چیپ نمایش؛ هنگام Save پس از دریافت `saved.id` لینک‌ها commit شوند؛ حالت ویرایش بدون تغییرِ منطق فعلی.
- **محدودیت‌ها:** commit لینک فقط پس از insert موفق. استفاده از RPC `link_task_note` اتمیک. بدون رگرسیون UI ویرایش.
- **وابستگی:** پس از G4.1. (با G4.3 فایل مشترک ندارد ⇒ قابل‌موازی.)
- `CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/tasks/components/LinkNotePicker.tsx", "services/linkService.ts", "utils/dateUtils.ts", "types.ts"]`

### تسک G4.3 — لینک در ایجاد + جابه‌جایی UI + refactor LinkTaskPicker (مودال یادداشت)
- **راهنمای پیاده‌سازی:** ویرایش `features/notes/components/LinkTaskPicker.tsx` به الگوی `onSelect`. ویرایش `features/notes/components/NoteEditorModal.tsx`: (الف) `pendingLinkIds` و commit پس از `saved.id` مشابه G4.2؛ (ب) **انتقال** بلوک «کارهای لینک‌شده + picker» از میان عنوان/بدنه به ناحیه‌ی متادیتای پایین (کنار تگ‌ها/پروژه)، هم‌ساختار با `TaskEditorModal`.
- **محدودیت‌ها:** بخش لینک نباید در ناحیه‌ی نوشتنِ متن باشد. commit فقط پس از insert موفق. ناحیه‌ی نوشتن = فقط عنوان + بدنه.
- **وابستگی:** پس از G4.1. (با G4.2 قابل‌موازی.)
- `CONTEXT_FILES: ["features/notes/components/NoteEditorModal.tsx", "features/notes/components/LinkTaskPicker.tsx", "features/tasks/components/TaskEditorModal.tsx", "services/linkService.ts", "utils/dateUtils.ts", "types.ts"]`

---

## G5 — داشبورد و مدیریت جامع عادات

### تسک G5.1 — توابع خالص آماری عادت
- **راهنمای پیاده‌سازی:** ساخت `utils/habitStats.ts`: `computeStreaks`, `weekdayBreakdown`, `monthlyTrend`, `weeklyHeatmap` — ورودی `completedDates: string[]` (YYYY-MM-DD)، همه Tehran-aware با `utils/dateUtils.ts`.
- **محدودیت‌ها:** توابع کاملاً خالص و بدون side-effect؛ هیچ I/O؛ مرز روز/ماه با منطقه‌ی Tehran.
- `CONTEXT_FILES: ["utils/dateUtils.ts", "services/habitService.ts", "types.ts"]`

### تسک G5.2 — نمای آماری + فرم مشترک عادت
- **راهنمای پیاده‌سازی:** ساخت `features/habits/components/HabitStatsView.tsx` (heatmap هفتگی، میله‌های ماهانه، نوار روزهای هفته، streak — همه با **SVG/CSS سبک**). استخراج فرم ویرایش به `features/habits/components/HabitForm.tsx` از روی `features/habits/components/HabitEditorModal.tsx`.
- **محدودیت‌ها:** بدون کتابخانه‌ی چارت. کلاس‌های Tailwind معتبر، single-column. منطق آماری فقط از `utils/habitStats.ts`.
- **وابستگی:** پس از G5.1.
- `CONTEXT_FILES: ["utils/habitStats.ts", "features/habits/components/HabitEditorModal.tsx", "components/icons.tsx", "types.ts"]`

### تسک G5.3 — مودال مدیر عادت + سوییچ در App
- **راهنمای پیاده‌سازی:** ساخت `features/habits/components/HabitManagerModal.tsx` (new ⇒ فقط `HabitForm`؛ موجود ⇒ تب «آمار» با `HabitStatsView` و تب «مدیریت» با `HabitForm` + حذف کامل با تأیید؛ استفاده از `habitService`). ویرایش `App.tsx`: سوییچ مودال `editingHabit` از `HabitEditorModal` به `HabitManagerModal` (همان state `editingHabit`/`setEditingHabit`).
- **محدودیت‌ها:** حذف با تأیید. بدون supabase مستقیم در کامپوننت. **هاتْ‌اسپات `App.tsx` — با G1.5/G3.2/G4.1 سریال.**
- **وابستگی:** پس از G5.2.
- `CONTEXT_FILES: ["App.tsx", "features/habits/components/HabitManagerModal.tsx", "features/habits/components/HabitStatsView.tsx", "features/habits/components/HabitForm.tsx", "services/habitService.ts", "contexts/DataContext.tsx", "features/dashboard/components/HabitTracker.tsx", "types.ts"]`

---

## ترتیب اجرای پیشنهادی (سریال‌سازیِ هاتْ‌اسپات `App.tsx`)
1) G1.1 → G1.2 → G1.3 → G1.4 → G1.5
2) G4.1 → (G4.2 ∥ G4.3)
3) G3.1 → G3.2
4) G5.1 → G5.2 → G5.3
5) G2 (مستقل، هر زمان پس از آزاد بودن منابع)
> همه‌ی تسک‌هایی که `App.tsx` را ویرایش می‌کنند (G1.5, G3.2, G4.1, G5.3) باید نسبت به هم **متوالی** اجرا شوند.
