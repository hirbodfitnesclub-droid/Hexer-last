# tasks.md — بازطراحی کامل آنبوردینگ آموزشی (Educational Walkthrough)

> هدف: حذف کاملِ آنبوردینگِ فعلی (نام/وایب/هدف) و جایگزینی با یک Wizard آموزشی که فقط «نام و نام خانوادگی» را می‌گیرد، سپس کاربر بین «رد شدن» و دیدن ۵ اسلاید آموزشی انتخاب می‌کند.
>
> **بدون مایگریشن DB:** ستون‌های `full_name` و `onboarding_completed` از قبل در `profiles` موجودند. منبع حقیقتِ «دیده‌شدن آنبوردینگ» = `profiles.onboarding_completed`. **LocalStorage ممنوع (Anti-Pattern §۸).**

## محدودیت‌های سراسری (روی همه‌ی تسک‌ها اعمال می‌شود)
- **Tailwind:** فقط پله‌های رنگی معتبر `50,100,...,900,950`. کلاس‌هایی مثل `*-450`/`*-850`/`neutral-850` ممنوع (Anti §۲۰/§۲۲). آنبوردینگ قدیمی این باگ‌ها را داشت — تکرار نشود.
- **آیکون:** فقط از `components/icons.tsx`. **استفاده از اموجی به‌عنوان آیکون ممنوع (Anti §۲۱).**
- **انیمیشن:** فقط با `motion` (نصب‌شده). import: `import { motion, AnimatePresence } from 'motion/react'`. به CSSِ `animate-fade-in`/`animate-shake` تکیه نشود (در `index.css` تعریف نشده‌اند).
- **Mobile-only:** صفحه full-screen با `fixed inset-0`. از گریدهای Desktop (`md:`/`lg:`) برای چیدمان اصلی پرهیز شود (Anti §۲۶). رعایت Safe-Area (متغیرهای موجود در `index.css`).
- **RTL:** `dir="rtl"`. جهت آیکون «بازگشت» به سمت راست/شروع باشد؛ `ChevronRightIcon` برای بازگشت (Anti §۳۶). بدون Horizontal overflow: `max-w-full` + `min-w-0` (Anti §۳۵).
- **خطاها:** هر خطای شبکه/Supabase با پیام فارسی و افت تدریجی مدیریت شود؛ دکمه‌ی نهایی حالت loading داشته باشد (Anti §۲۱).
- **معماری:** هر فایل یک مسئولیت (Anti §۱۱). بیزینس‌لاجیک نوشتن DB در سرویس، نه در کامپوننت (Anti §۱۳).

---

## تسک ۱ — ماژول داده‌ی اسلایدها
**فایل جدید:** `features/onboarding/data/slides.tsx`
**راهنمای پیاده‌سازی:**
- یک type به نام `OnboardingSlide` تعریف کن: `{ id, Icon, title, body, highlight? }` که `Icon` کامپوننت آیکون از `components/icons.tsx` است.
- آرایه‌ی `ONBOARDING_SLIDES` با دقیقاً ۵ اسلاید بساز (متن فارسی، بدون اموجی):
  1. **معرفی و داشبورد** — آیکون `LayoutGridIcon`. خوش‌آمد + مرور سریع امکانات داشبورد.
  2. **مدیریت کارها** — آیکون `ListChecksIcon`. ساخت تسک، تعیین تاریخ/ساعت برای نوتیفیکیشن، اتصال به پروژه/یادداشت، زیرتسک‌ها (Subtasks)، فیلتر بر اساس اولویت و پروژه.
  3. **جادوی هوش مصنوعی** — آیکون `SparklesIcon` (و `MicrophoneIcon` به‌عنوان شاهد بصری). `highlight: true`. ارسال ویس برای ساخت خودکار تسک‌ها + Semantic Search با مثال ملموس: «اون روش برای بالا بردن سرعت سایت چی بود؟».
  4. **یادداشت‌ها** — آیکون `NotebookIcon`. ساخت یادداشت، لینک به پروژه/تسک، تگ‌ها.
  5. **پروژه‌ها** — آیکون `BriefcaseIcon`. ساخت پروژه، نمای یکپارچه‌ی تسک‌ها/یادداشت‌های متصل، درصد پیشرفت بر اساس تسک‌های انجام‌شده.
**محدودیت‌های تسک:** فقط داده و type؛ هیچ stateای، هیچ صدا زدن DOM/Supabase. متن‌ها ثابت و فارسی.
CONTEXT_FILES: ["components/icons.tsx", "types.ts"]

---

## تسک ۲ — سرویس پروفایل
**فایل جدید:** `services/profileService.ts`
**راهنمای پیاده‌سازی:**
- دقیقاً الگوی سرویس‌های موجود (`taskService.ts`, `noteService.ts`) را دنبال کن: import از `services/supabaseClient.ts`.
- تابع `completeOnboarding(fullName: string): Promise<void>` که روی جدول `profiles` این آپدیت را می‌زند: `{ full_name: fullName.trim(), onboarding_completed: true }` با `.eq('id', userId)`؛ `userId` را از `supabase.auth.getUser()` بگیر (یا به‌عنوان آرگومان بپذیر، هماهنگ با الگوی سرویس‌های دیگر). در صورت `error` آن را `throw` کن.
- منطق دقیقِ آپدیت را از آنبوردینگ قدیمی (`components/Onboarding.tsx > handleSubmit`) عیناً تکرار کن (همان دو ستون).
**محدودیت‌های تسک:** فقط لایه‌ی سرویس؛ بدون JSX. هیچ ستون اضافه‌ای آپدیت نشود (specialty/interests لازم نیستند چون از فلو حذف شده‌اند).
CONTEXT_FILES: ["services/supabaseClient.ts", "services/taskService.ts", "services/noteService.ts", "components/Onboarding.tsx"]

---

## تسک ۳ — کامپوننت ارائه‌ی یک اسلاید
**فایل جدید:** `features/onboarding/components/SlideCard.tsx`
**راهنمای پیاده‌سازی:**
- یک کامپوننت presentational بدون state که یک `OnboardingSlide` را می‌گیرد و نمایش می‌دهد: آیکون بزرگ داخل یک badge گرادینتیِ ملایم، تیتر `text-2xl/3xl font-black`، و متن `text-neutral-400`. اگر `highlight` بود، قاب/گلوی متمایز (مثلاً border با رنگ معتبر مثل `border-sky-500/40`).
- کاملاً responsive و mobile-first؛ `max-w-md mx-auto`.
**محدودیت‌های تسک:** بدون منطق ناوبری/state؛ فقط props → UI.
CONTEXT_FILES: ["features/onboarding/data/slides.tsx", "components/icons.tsx"]

---

## تسک ۴ — اسلایدر با انیمیشن (SlideViewer)
**فایل جدید:** `features/onboarding/components/SlideViewer.tsx`
**راهنمای پیاده‌سازی:**
- props: `{ onFinish: () => void; onSkip: () => void }`. اسلایدها را از `ONBOARDING_SLIDES` بخوان.
- index داخلی با `useState`. از `AnimatePresence` + `motion.div` برای ترانزیشن slide+fade استفاده کن (در RTL: ورود از سمت شروع، با `mode="wait"`).
- نوار پیشرفت (progress dots/bar)، دکمه‌های «بعدی»/«قبلی»، و یک لینک «رد شدن» همیشه‌حاضر در هدر. در آخرین اسلاید دکمه‌ی اصلی = «بزن بریم تو کارش» که `onFinish` را صدا می‌زند؛ «رد شدن» → `onSkip`.
- جهت آیکون‌ها مطابق RTL (Anti §۳۶).
**محدودیت‌های تسک:** نوشتن در DB ممنوع (آن کارِ کانتینر است). فقط ناوبریِ بین اسلایدها + فراخوانی callback.
CONTEXT_FILES: ["features/onboarding/data/slides.tsx", "features/onboarding/components/SlideCard.tsx", "components/icons.tsx", "package.json"]

---

## تسک ۵ — مرحله‌ی نام و صفحه‌ی انتخاب
**فایل‌های جدید:**
- `features/onboarding/components/NameStep.tsx`
- `features/onboarding/components/WelcomeChoice.tsx`
**راهنمای پیاده‌سازی:**
- `NameStep`: دو input «نام» و «نام خانوادگی»، props: `{ onSubmit: (fullName: string) => void }`. اعتبارسنجی: هر دو غیرخالی؛ مقدار نهایی = `\`${first} ${last}\`.trim()` (در ستون موجود `full_name` ذخیره می‌شود؛ بدون مایگریشن). دکمه‌ی «ادامه» تا معتبر شدن disabled. خطای فارسی با `motion` نمایش داده شود.
- `WelcomeChoice`: props: `{ name: string; onSeeWalkthrough: () => void; onSkip: () => void }`. پیام «سلام {name}! دوست داری ببینی چطور می‌تونی بهتر با برنامه کار کنی؟» + دو دکمه: «آره، نشونم بده» و «رد کن و برو به برنامه».
**محدودیت‌های تسک:** بدون صدا زدن Supabase؛ فقط UI + callback. کلاس‌های Tailwind معتبر.
CONTEXT_FILES: ["components/icons.tsx"]

---

## تسک ۶ — کانتینر / ماشین‌حالت آنبوردینگ
**فایل جدید:** `features/onboarding/Onboarding.tsx`
**راهنمای پیاده‌سازی:**
- props دقیقاً مثل قبل: `{ userId: string; onComplete: () => void }` و `export const Onboarding` + `export default`.
- state فاز: `'name' | 'choice' | 'slides'`. نام در state نگه داشته شود.
- `finishOnboarding()` مشترک برای هر دو مسیر (Skip بعد از نام، و اتمام اسلایدها): `setLoading(true)` → `await profileService.completeOnboarding(fullName)` → در موفقیت `onComplete()`؛ در خطا پیام فارسی + بازماندن در همان فاز.
- ترانزیشن بین فازها با `AnimatePresence`. کانتینر `fixed inset-0` با تم تیره و رعایت Safe-Area.
- چون Skip و اتمام اسلایدها هر دو `onboarding_completed=true` را ست می‌کنند، آنبوردینگ دیگر تکرار نمی‌شود.
**محدودیت‌های تسک:** کل نوشتن DB فقط از `profileService` (Anti §۱۳). این فایل ارکستریتور است؛ UIِ جزئیات در تسک‌های ۳/۴/۵ ساخته شده.
CONTEXT_FILES: ["features/onboarding/components/NameStep.tsx", "features/onboarding/components/WelcomeChoice.tsx", "features/onboarding/components/SlideViewer.tsx", "services/profileService.ts", "components/icons.tsx"]

---

## تسک ۷ — اتصال به App و حذف آنبوردینگ قدیمی
**فایل‌های هدف:** `App.tsx` (ویرایش)، `components/Onboarding.tsx` (حذف)
**راهنمای پیاده‌سازی:**
- در `App.tsx` فقط خط import را عوض کن: `import { Onboarding } from './components/Onboarding'` → `import { Onboarding } from './features/onboarding/Onboarding'`. بلوک استفاده (`if (isOnboarding && user) return <Onboarding userId={user.id} onComplete={...} />`) بدون تغییر می‌ماند.
- فایل `components/Onboarding.tsx` را حذف کن.
- مطمئن شو هیچ import دیگری به `components/Onboarding` در پروژه نمانده باشد (جستجوی سراسری).
**محدودیت‌های تسک:** منطق گیت (`isOnboarding` از `useDataManager`) دست‌نخورده بماند. `App.tsx` نباید متورم شود (Anti §۱۱).
CONTEXT_FILES: ["App.tsx", "features/onboarding/Onboarding.tsx", "components/Onboarding.tsx"]

---

# فاز H — نقشهٔ راهِ مرجع (نوتیفیکیشن، آفلاین/PWA، پرفورمنس)

> مرجعِ کامل: `PROJECT.md §فاز H` و `ARCHITECTURE.md §۱۱`. تسک‌هایی که روی فایلِ یکسان تداخلِ خواندن/نوشتن دارند **موازی نمی‌شوند** (نقشهٔ تداخل در `ARCHITECTURE.md §۱۱.د`).
> یادآوریِ کدنویس: مثلِ یک سنیور کد بزن، اما دقیقاً همین اسکوپ را؛ نه کمتر، نه بیشتر. تمامِ متن‌های فارسی از util موجود، آیکون فقط از `components/icons.tsx`، انیمیشن فقط با `motion`.

## ترتیبِ اجرا (وابستگی‌ها)
گروهِ نوتیفیکیشن (H1→H2→H3→H4) · گروهِ پرفورمنس‌پایه (H5→H6→H7a→H7b) · گروهِ آفلاین (H8→H9→H10) — H9/H10 به H6 وابسته‌اند. H11 (مجوز/iOS) بعد از H1. H12 تستِ یکپارچه آخر.

---

## تسک H1 — تثبیتِ کلید VAPID و راه‌اندازیِ Push (کلاینت)
**راهنمای پیاده‌سازی:**
1. در `App.tsx`، در `setupPushManager` کلیدِ عمومیِ هاردکدِ fallback (`'BFgEnQ8...'`) را کاملاً حذف کن؛ فقط `import.meta.env.VITE_VAPID_PUBLIC_KEY` خوانده شود.
2. اگر این env خالی بود → بدونِ `subscribeToPush` با `console.warn` برگرد (افتِ تدریجی به Foreground).
3. در `useDataManager.ts` فراخوانیِ `requestNotificationPermission()` داخلِ `loadInitial` را حذف کن (درخواستِ تکراریِ بدونِ gesture).
**محدودیت‌های تسک:** فقط تثبیتِ کلید و حذفِ درخواستِ تکراری؛ منطقِ subscribe/save دست‌نخورده. UIِ مجوز در H11 ساخته می‌شود. کلید هرگز هاردکد نشود.
CONTEXT_FILES: ["App.tsx", "services/reminderService.ts", "hooks/useDataManager.ts", "docs/PROJECT.md", "docs/ARCHITECTURE.md"]

## تسک H2 — تثبیتِ خطِ دیسپچِ سرور (SQL + Edge مشاهده‌پذیری)
**راهنمای پیاده‌سازی:**
1. فایلِ جدیدِ Idempotent `supabase/sql/41_fix_push_dispatch_transport.sql`: `create extension if not exists pg_net;` و `pg_cron;`.
2. آدرسِ پروژه و `service_role_key` را از **Supabase Vault** بخوان (`vault.decrypted_secrets`) به‌جای `current_setting('app.settings.*')`؛ کرانهٔ `push-dispatch-cron` (هر دقیقه) با `net.http_post` و `Authorization: Bearer <key>` ساخته شود (با `cron.unschedule` در بلاکِ ایمن قبلش).
3. جدولِ `push_dispatch_log` (RLS فقط service_role) + ایندکسِ `idx_tasks_due_pending on tasks(due_date) where completed_at is null`.
4. در `supabase/functions/push-dispatch/index.ts` فقط نوشتنِ یک ردیفِ لاگ با `sent/failed/cleaned` در پایانِ اجرا اضافه شود (منطق دست‌نخورده).
5. در ابتدای فایلِ SQL کامنتِ دستورالعملِ استقرار: فعال‌سازیِ `pg_cron`+`pg_net` در داشبورد و ست‌کردنِ یک‌بارهٔ سکرت‌های Vault. **جفت‌بودنِ `VITE_VAPID_PUBLIC_KEY` با `VAPID_PRIVATE_KEY` را هم یادآوری کن.**
**محدودیت‌های تسک:** فقط لایهٔ انتقال/مشاهده‌پذیری؛ ساختارِ view/dedupِ موجود تغییر نکند. SQL باید idempotent و آمادهٔ اجرای دستی باشد (بدون اتکا به CLI).
CONTEXT_FILES: ["supabase/sql/35_reminder_dispatch.sql", "supabase/sql/35.5_fix_security_definer_view.sql", "supabase/sql/34_push_subscriptions.sql", "supabase/functions/push-dispatch/index.ts", "docs/ARCHITECTURE.md"]

## تسک H3 — بازنویسیِ اسکجولرِ Foreground (قطعی هنگام بازبودنِ اپ)
**راهنمای پیاده‌سازی:**
1. در `hooks/useReminderScheduler.ts` یک تابعِ واحدِ `evaluate()` بساز که: (الف) برای تسک‌های زمان‌دارِ امروزِ بدونِ تکمیل که سررسیدشان در آیندهٔ نزدیک است `setTimeout` بگذارد، (ب) catch-up کند: تسک‌های سررسیدگذشتهٔ امروزِ بدونِ نوتیفِ قبلی → فوری `showViaSW`.
2. یک `setInterval` هر ۶۰ ثانیه که `evaluate()` را صدا بزند (حذفِ اتکا به تایمرِ بلند).
3. `handleSyncReset`ِ فعلی (که فقط clear می‌کند) را با فراخوانیِ `evaluate()` (clear + reschedule + catch-up) جایگزین کن؛ `visibilitychange` را روی `document` بایند کن و `focus`/`online` روی `window`.
4. dedup: `Set` از taskIdهای امروز + کلیدِ روزانهٔ nudge در `localStorage` (transient/مجاز). تمام timeout/interval‌ها در cleanup پاک شوند.
**محدودیت‌های تسک:** فقط لایهٔ Foreground؛ به Push/Edge دست نزن. متن‌ها از `utils/notificationCopy.ts`. هیچ نوتیفیکیشنِ تکراری.
CONTEXT_FILES: ["hooks/useReminderScheduler.ts", "services/reminderService.ts", "utils/notificationCopy.ts", "utils/dateUtils.ts", "contexts/DataContext.tsx", "docs/ARCHITECTURE.md"]

## تسک H4 — مسیرِ واحدِ نمایش و dedup بین لایه‌ها
**راهنمای پیاده‌سازی:**
1. در `hooks/useRealtimeSync.ts` لیسنرِ INSERTِ `reminders`: اگر `document.visibilityState==='visible'` فقط `addNotification` (Toast) بزن و **`sendBrowserNotification` را در این حالت حذف کن**؛ اگر hidden، نوتیفِ OS را به لایهٔ Push/SW واگذار کن.
2. اطمینان از یکتاییِ `tag` (`task-<id>`, `daily-nudge-<uid>-<date>`) در همهٔ مسیرها برای coalesce.
**محدودیت‌های تسک:** فقط منطقِ نمایش/dedup؛ فیلترِ `user_id=eq.<uid>` کانال‌ها حفظ شود (Anti-Pattern §۷).
CONTEXT_FILES: ["hooks/useRealtimeSync.ts", "services/reminderService.ts", "public/sw.js", "docs/ARCHITECTURE.md"]

## تسک H5 — ایندکس‌ها و RPCِ بهینهٔ لیست (SQL)
**راهنمای پیاده‌سازی:**
1. فایلِ جدیدِ Idempotent `supabase/sql/42_list_query_optimization.sql`: ایندکس‌های ترکیبی `tasks(user_id, created_at desc)`, `notes(user_id, created_at desc)`, `tasks(user_id, due_date)`, `habit_completions(habit_id, completion_date)`.
2. (اختیاری ولی توصیه‌شده) RPCِ `get_habits_with_recent_completions(p_days int)` با `security definer` که عادت‌ها + تکمیل‌های پنجرهٔ اخیر را در یک رفت‌وبرگشت برمی‌گرداند.
**محدودیت‌های تسک:** فقط ایندکس/RPC؛ بدونِ تغییرِ اسکیمای ستون‌ها. idempotent و دستی.
CONTEXT_FILES: ["supabase/sql/03_core.sql", "supabase/sql/21_refactor_functions.sql", "docs/ARCHITECTURE.md"]

## تسک H6 — لاغرسازیِ سرویس‌ها: ستون‌های صریح + صفحه‌بندی
**راهنمای پیاده‌سازی:**
1. در `taskService.getTasks` و `noteService.getNotes` و `projectService.getProjects`، `select('*')` را با لیستِ ستونِ صریح **بدونِ `embedding`** جایگزین کن و `.order('created_at',{ascending:false}).range(0, limit-1)` با پارامترِ `limit` بگذار.
2. سیم‌کشیِ `tasksLimit/notesLimit` از `useDataManager` به این سرویس‌ها؛ `loadMoreTasks/loadMoreNotes` واقعی شوند.
3. `habitService.getHabits` را به پنجرهٔ محدود یا RPCِ H5 منتقل کن (حذفِ کشیدنِ کلِ تاریخچه).
**محدودیت‌های تسک:** فقط لایهٔ سرویس و امضای تابع؛ منطقِ CRUDِ خوش‌بینانه دست‌نخورده. ستونِ `embedding` هرگز به کلاینت نیاید (§۵۶).
CONTEXT_FILES: ["services/taskService.ts", "services/noteService.ts", "services/projectService.ts", "services/habitService.ts", "hooks/useDataManager.ts", "types.ts", "supabase/sql/42_list_query_optimization.sql"]

## تسک H7a — پایپ‌لاینِ Build: حذفِ importmap و Tailwind build-time
**راهنمای پیادهسازی:**
1. `<script type="importmap">` و `<script src="cdn.tailwindcss.com">` را از `index.html` حذف کن.
2. **Tailwind build-time (مسیر اصلی):** `tailwindcss@3.4` + `postcss` + `autoprefixer` را به devDependencies اضافه کن؛ `tailwind.config.js` و `postcss.config.js` را بساز.
3. در `index.css`: دایرکتیوهای `@tailwind base/components/utilities` را اضافه کن. Safe-Area Insets و Autofill Override و انیمیشنها حفظ شوند.
4. **[الزامی] safelistِ کلاسهای داینامیک** طبق `ARCHITECTURE.md §۱۱.هـ` در `tailwind.config.js` اضافه شود؛ بدونِ آن اپ بیاستایل بالا میآید.
5. حفظِ فونت Vazirmatn با `display=swap` و preload.
**محدودیتهای تسک:** هرگز از Tailwind v4 استفاده نشود. این تسک باید ایزوله و قابل برگشت باشد.
CONTEXT_FILES: ["index.html", "vite.config.ts", "package.json", "index.css", "docs/PROJECT.md", "docs/ARCHITECTURE.md"]

## تسک H7b — Code-Splitting صفحات سنگین
**راهنمای پیاده‌سازی:** در `App.tsx`، `Chat`, `Projects`, `Subscription` و مودال‌های سنگین را با `React.lazy` + `<Suspense fallback=...>` تنبل کن؛ `Dashboard` eager بماند.
**محدودیت‌های تسک:** فقط lazy/Suspense؛ منطقِ روتینگ و DataContext دست‌نخورده. fallback باید همان اسپینرِ سبکِ موجود باشد، نه قفلِ تمام‌صفحه.
CONTEXT_FILES: ["App.tsx", "features/chat/ChatView.tsx", "features/projects/ProjectsView.tsx", "features/billing/pages/SubscriptionPage.tsx", "docs/ARCHITECTURE.md"]

## تسک H8 — پایهٔ آفلاین: IndexedDB + Snapshot + Outbox
**راهنمای پیاده‌سازی:** پوشهٔ جدیدِ `services/offline/`:
1. `idb.ts` — wrapperِ سبکِ دست‌نویس (بدونِ کتابخانه): `openDB` با دو store `snapshot` و `outbox`؛ توابعِ get/getAll/put/delete/clear.
2. `snapshot.ts` — `saveSnapshot/loadSnapshot(userId, entity, rows)`.
3. `outbox.ts` — مدلِ mutation و توابعِ `enqueue/listPending/remove/bumpRetry/remapTempId`.
**محدودیت‌های تسک:** فقط ماژول‌های مستقلِ آفلاین؛ هنوز به UI وصل نشو. سیاستِ تعارض LWW بر اساس `updated_at`. فقط CRUDِ مجاز (§۵۹). بدونِ کش در SW (§۳۳).
CONTEXT_FILES: ["services/supabaseClient.ts", "hooks/useDataManager.ts", "types.ts", "docs/ARCHITECTURE.md"]

## تسک H9 — بوتِ Stale-While-Revalidate (هیدریت از اسنپ‌شات)
**راهنمای پیاده‌سازی:**
1. در `useDataManager.loadInitial`: ابتدا از `loadSnapshot` هیدریت کن و `loadingData=false` را سریع ست کن؛ سپس در پس‌زمینه از شبکه (سرویس‌های H6) رِواِلیدِیت و `saveSnapshot` را به‌روز کن.
2. اولویتِ مسیرِ بحرانی: profile+subscription+تسک‌های امروز/اخیر اول؛ بقیه تنبل.
3. در `services/supabaseClient.ts` گزینه‌های `auth:{persistSession:true, autoRefreshToken:true}` صریح شوند.
**محدودیت‌های تسک:** هیچ گیتِ تمام‌صفحه (§۵۸). همان فایلِ `useDataManager` در H10 ادامه می‌یابد → این تسک قبل از H10 و **سری**.
CONTEXT_FILES: ["hooks/useDataManager.ts", "contexts/DataContext.tsx", "services/offline/snapshot.ts", "services/offline/idb.ts", "services/supabaseClient.ts", "App.tsx"]

## تسک H10 — صفِ نوشتنِ آفلاین + موتورِ سینک
**راهنمای پیاده‌سازی:**
1. در CRUDهای `useDataManager`: در `catch`، اگر آفلاین/خطای شبکه بود به‌جای rollback، `outbox.enqueue` کن و state+snapshot را حفظ کن (§۵۴).
2. `hooks/useOfflineSync.ts`: روی `online` و در بوت، صف را به‌ترتیب flush کن؛ پس از create، `tempId→realId` را در state و opهای وابسته remap کن؛ retry با backoff؛ drop+Toast برای خطای دائمی.
3. `App.tsx`: mountِ `useOfflineSync`؛ پاس‌دادنِ تعدادِ pending به `NetworkBanner`. `NetworkBanner` وضعیتِ واقعی را نشان دهد.
**محدودیت‌های تسک:** فقط CRUDِ مجاز در صف؛ AI/مدیا/پرداخت مستثنا و در آفلاین پیامِ مناسب. ترتیبِ صف حفظ شود.
CONTEXT_FILES: ["hooks/useDataManager.ts", "hooks/useOfflineSync.ts", "services/offline/outbox.ts", "services/offline/snapshot.ts", "components/NetworkBanner.tsx", "hooks/useNetworkStatus.ts", "App.tsx"]

## تسک H11 — UXِ مجوزِ نوتیفیکیشن + راهنمای iOS
**راهنمای پیاده‌سازی:** یک کارتِ یک‌بارهٔ «روشن‌کردنِ یادآوری‌ها» که `requestNotificationPermission` را **فقط با کلیکِ کاربر** صدا بزند؛ اگر iOS و `navigator.standalone===false` بود، به‌جای تلاشِ شکست‌خورده راهنمای «افزودن به صفحهٔ اصلی» نشان بده.
**محدودیت‌های تسک:** آیکون از `components/icons.tsx`؛ انیمیشن با `motion`؛ بعد از H1.
CONTEXT_FILES: ["App.tsx", "services/reminderService.ts", "components/icons.tsx", "components/Modal.tsx", "docs/ARCHITECTURE.md"]

## تسک H12 — تستِ یکپارچهٔ سه بحران (دستی، چک‌لیست)
**راهنمای پیاده‌سازی:** سناریوهای تأیید: (الف) Push با اپ‌بسته (لاگِ `push_dispatch_log`)، Foreground با اپ‌باز، عدمِ تکرار؛ (ب) ورودِ تسک در آفلاین → بستن/بازکردن → سینکِ خودکار در online، بدونِ گم‌شدن؛ (ج) لودِ اولیه با دیتای زیاد: first-paint سریع، نبودِ `embedding` در پیلود، صفحه‌بندیِ واقعی.
**محدودیت‌های تسک:** بدونِ کد جدید؛ فقط راستی‌آزمایی و ثبتِ نتیجه در `CURRENT_TASK.md`. هر رگرسیون = برگشت به تسکِ مربوطه.
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md"]


---

# فاز H — اصلاحیهٔ گاردریل (Revision H.2)
> این بخش بندهای زیر را به تسک‌های موجود **می‌افزاید/سفت‌تر می‌کند** (مرجع: `ARCHITECTURE.md §۱۱.هـ` و `PROJECT.md §H.۶`). کدنویس باید این قیود را روی همان تسک‌ها اعمال کند.

**به‌روزرسانیِ H2 (SQL دیسپچ):** هیچ فایلِ SQLِ قبلی (`35`/`35.5`/...) ویرایش نشود؛ فقط فایلِ جدیدِ `supabase/sql/41_fix_push_dispatch_transport.sql` (Anti-Pattern §۶۱). نامِ پیشنهادی هم‌خانواده: می‌تواند `41_setup_pg_net_and_push.sql` باشد.

**به‌روزرسانیِ H4 (dedup):** علاوه بر `tag`، یک `messageId` قطعی (`task-<id>-<dueEpoch>`، `nudge-<uid>-<tehranDate>`) و دفترِ `shown` در IndexedDB پیاده شود؛ هر سه مسیر (scheduler، Realtime، `sw.js push`) پیش از نمایش `shown` را چک کنند (§۱۱.هـ.۳، Anti-Pattern §۶۳). `sw.js` هم باید `shown` را بخواند/بنویسد.
CONTEXT_FILES (به‌روز): ["hooks/useRealtimeSync.ts", "services/reminderService.ts", "public/sw.js", "services/offline/idb.ts", "utils/dateUtils.ts", "docs/ARCHITECTURE.md"]

**به‌روزرسانیِ H6 (select صریح):** دقیقاً لیستِ ستون‌های `ARCHITECTURE.md §۱۱.هـ.۱` کپی شود (هیچ فیلدی جا نیفتد؛ `embedding` هرگز)؛ `habit_completions` با پنجرهٔ ۹۰ روزه/RPC (Anti-Pattern §۶۴).

**بهروزرسانیِ H7a (Tailwind — اصلاحِ H.3):** مسیرِ اصلی = `tailwindcss@3.4` build-time با `postcss`+`autoprefixer`+`tailwind.config.js` (بدونِ تغییرِ معناییِ کلاس)، نه v4. safelist با آرایه در `tailwind.config.js` اجباری است. **این تسک باید اولین تسکِ اجراشده، روی برنچ/کامیتِ مجزا و قابلِبرگشت باشد؛ اگر UI شکست، rollback فوری.**

**بهروزرسانیِ H8 (storeها):** IndexedDB چهار store دارد: `snapshot`, `outbox`, `shown`, `failed`. تابعِ `pruneShown()` در بوت. SW دیتابیس را بدون version باز میکند.

**بهروزرسانیِ H10 (dead-letter + cascade):** خطای دائمیِ غیرauth → انتقال به `failed` (نه delete) + انتقالِ cascadeِ opهای وابسته. فقط `getSession()` چک شود؛ `refreshSession()` دستی force نشود. 401/403 قابل retry است.

**ترتیبِ نهاییِ فاز H:** **H7a (اول، ایزوله، قابلِبرگشت)** → H1→H2→H3→H4 → H5→H6→H7b → H8→H9→H10 → H11 → H12.


---

# فاز I — نقشه‌ی راهِ مرجع (جستجوی هیبریدی Zero-Cost: FTS/`tsvector` + RRF + استخراج فیلتر)

> مرجعِ کامل: `docs/ARCHITECTURE.md` §۱۲ و `docs/PROJECT.md` فاز I. هدف: دقتِ بالاتر با هزینه‌ی LLMِ صفر. **هیچ فایل SQL قدیمی ویرایش نمی‌شود** و **مدلِ امبدینگ تغییر نمی‌کند.**

## محدودیت‌های سراسریِ فاز I (روی همه‌ی تسک‌ها)
- تمام تغییرِ دیتابیس فقط در فایلِ جدیدِ `supabase/sql/43_fulltext_hybrid_search.sql`؛ Idempotent و قابلِ اجرای دستی در SQL Editor (بدون اتکا به CLI).
- پیکربندیِ متن همیشه صریحِ `'simple'`؛ کوئریِ کاربر فقط با `websearch_to_tsquery` (نباید `to_tsquery` خام).
- سه پارامترِ اولِ `hybrid_search` و ترتیبشان ثابت؛ فیلترها فقط `DEFAULT NULL` در انتها (Anti §۷۶).
- ممنوع: `pg_trgm`/`similarity` برای متن (§۷۱)، تغییرِ خط لوله‌ی `vectorize`/مدلِ امبدینگ (§۷۵).

## ترتیبِ اجرا (وابستگی‌ها)
**I1 (مستقل) ∥ I2 (یک فایل، اتمیک)** → **I3** → I4 (اختیاری) → I5 (اختیاری/بعدی) → **I6 (تستِ نهایی)**.
> I1 و I2 روی فایل‌های جدا کار می‌کنند و می‌توانند موازی باشند. I3 فقط پس از اتمامِ هر دو. تمام زیرگام‌های دیتابیس داخلِ I2 هستند و **نباید موازی** شوند.

## تسک I1 — ماژولِ خالصِ استخراجِ فیلتر از کوئری (`query-parser.ts`)
**راهنمای پیاده‌سازی:**
1. فایلِ جدید `supabase/functions/ai-assistant/lib/query-parser.ts` با یک تابعِ خالص بساز:
   `export function parseSearchQuery(raw: string): { cleanText: string; filterType: 'task'|'note'|'project'|null; tags: string[]; dateFrom: string|null; dateTo: string|null }`.
2. استخراجِ نوع با Regex: الگوی `(?:نوع|type)\s*[:：]\s*(...)` و نگاشتِ کلمات → `task` (کار/تسک/task)، `note` (یادداشت/نوت/note)، `project` (پروژه/پروجکت/project).
3. استخراجِ تگ‌ها: تمام تطابق‌های `#([^\s#]+)` (هشتگ‌ها) در آرایه‌ی `tags`.
4. استخراجِ بازه‌ی تاریخ از کلیدواژه‌ها (به افقِ زمانیِ Asia/Tehran و خروجیِ ISO): «امروز/today»، «دیروز/yesterday»، «این هفته/this week»، «هفته گذشته/last week»، «این ماه/this month»، «ماه گذشته/last month». فقط `created_at` هدف است (نه `due_date`).
5. `cleanText` = `raw` پس از حذفِ تمام توکن‌های تطبیق‌یافته و `trim`. اگر چیزی استخراج نشد، همه‌ی فیلدها `null`/`[]` و `cleanText = raw`.
**محدودیت‌های تسک:** تابعِ **خالص** بدونِ هیچ I/O، بدونِ `import` از Supabase/Deno. نباید کلمات را پاک کند اگر مطمئن نیست (false-positive بدتر از false-negative است). فقط TypeScript خالص و قابلِ تست.
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/rag-context.ts", "supabase/functions/ai-assistant/index.ts", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک I2 — مهاجرتِ دیتابیس: FTS + بازنویسیِ `hybrid_search` (فایلِ واحدِ `43`)
**راهنمای پیاده‌سازی:** (همه در یک فایل، به‌ترتیب)
1. تابعِ `public.hexer_fa_normalize(text) RETURNS text LANGUAGE sql IMMUTABLE` (یکسان‌سازیِ ی/ك عربی→فارسی، حذفِ اعراب/کشیده، نیم‌فاصله→فاصله، `lower`) — دقیقاً مطابقِ §۱۲.۱ گام ۱.
2. افزودنِ ستونِ `search_vector tsvector GENERATED ALWAYS AS (...) STORED` به `tasks`، `notes`، `projects` با `setweight` (عنوان=A، بدنه=B، تگ=C؛ projects بدونِ C) — §۱۲.۱ گام ۲.
3. ایندکسِ GIN روی هر `search_vector` — §۱۲.۱ گام ۳.
4. `DROP INDEX IF EXISTS` برای چهار ایندکسِ `idx_*_trgm` — §۱۲.۱ گام ۴.
5. `CREATE OR REPLACE FUNCTION public.hybrid_search(...)` با امضای جدید و سه پارامترِ فیلترِ `DEFAULT NULL`؛ منطق دقیقاً مطابقِ §۱۲.۲: حذفِ کاملِ آستانه‌های `>=0.25` و `>=0.01`، سقفِ `LIMIT 100` در هر CTE، مسیرِ متن با `ts_rank_cd` روی `websearch_to_tsquery('simple', hexer_fa_normalize(p_query_text))`، تلفیقِ RRF با `k=60`، پشتیبانی از سه جدول (مثلِ ۳۱). شاخه‌ی projects هنگام `p_tags IS NOT NULL` کنار گذاشته شود.
6. پایان: `NOTIFY pgrst, 'reload schema';`.
**محدودیت‌های تسک:** فقط همین فایلِ جدید؛ فایل‌های ۲۲/۲۶/۳۱ و `03_core.sql`/`20_refactor_schema.sql` **دست‌نخورده**. ستونِ `GENERATED` باید عبارتِ `IMMUTABLE` داشته باشد (وگرنه خطا). ستون‌های بازگشتی و `SECURITY DEFINER SET search_path=public` و گاردِ `auth.uid()` حفظ شوند. خروجیِ تابع `(id,type,title,snippet,score)` تغییر نکند. در ساعتِ کم‌ترافیک اجرا شود (ADD COLUMN جدول را بازنویسی می‌کند).
CONTEXT_FILES: ["supabase/sql/31_rag_projects.sql", "supabase/sql/26_update_hybrid_search.sql", "supabase/sql/03_core.sql", "supabase/sql/20_refactor_schema.sql", "supabase/sql/00_extensions.sql", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک I3 — اتصالِ `rag-context.ts` به parser و امضای جدید
**راهنمای پیاده‌سازی:**
1. `parseSearchQuery(message)` را در ابتدای `buildRagContext` فراخوان کن.
2. امبدینگ را از `cleanText` بساز: `generateEmbedding(ai, cleanText, 'query')` (پیشوندِ `'query'` حفظ شود).
3. `supabaseClient.rpc('hybrid_search', { p_query_embedding, p_query_text: cleanText, p_match_count: 15, p_filter_type, p_date_from, p_date_to, p_tags })`.
4. اگر `cleanText` پس از حذف تهی شد ولی فیلتری وجود داشت، اجازه بده مسیرِ وکتور با `cleanText` (حتی تهی) و فیلترها کار کند؛ قرارداد خطا و `try/catch`ِ موجود حفظ شود.
**محدودیت‌های تسک:** قراردادِ خروجی (`{ contextString, citations }`) و نگاشتِ citations دست‌نخورده. وابسته به اتمامِ **I1 و I2**. هیچ فراخوانیِ امبدینگِ اضافه‌ای ساخته نشود (§۷۵).
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/rag-context.ts", "supabase/functions/ai-assistant/lib/query-parser.ts", "supabase/functions/_shared/gemini-client.ts", "docs/ARCHITECTURE.md"]

## تسک I4 — (اختیاری) پاک‌سازیِ کوئریِ `SUGGEST_LINK` در `action-processor.ts`
**راهنمای پیاده‌سازی:** در شاخه‌ی `SUGGEST_LINK`، `queryText` را با `parseSearchQuery` پاک کن و فیلترهای استخراج‌شده را به همان `hybrid_search` (با `p_match_count=5`) پاس بده. اگر فیلتری نبود، رفتارِ فعلی بدونِ تغییر بماند.
**محدودیت‌های تسک:** نشکستنِ امضا و سازگاریِ رو به عقب. تغییرِ حداقلی؛ این تسک non-blocking است و می‌تواند به بعد موکول شود.
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/action-processor.ts", "supabase/functions/ai-assistant/lib/query-parser.ts", "docs/ARCHITECTURE.md"]

## تسک I5 — (اختیاری/بعدی) دکمه‌های Toggle فیلتر در UIِ جستجوی معنایی
**راهنمای پیاده‌سازی:** در سطحِ چتِ «memory» (یا هرجا که `searchSemantic` در آینده وصل شود)، دکمه‌های Toggle برای «امروز/هفته گذشته» و «نوع: یادداشت/کار/پروژه» اضافه کن که توکنِ متناظر را به پیام پیش‌اضافه می‌کنند یا فیلترِ ساختاری را مستقیماً پاس می‌دهند.
**محدودیت‌های تسک:** فقط با کلاس‌های معتبرِ Tailwind v3 و الگوی Mobile-Only (Anti §۲۲/§۲۶). چون `searchSemantic` فعلاً فراخوان ندارد، این تسک خارج از هسته است و فقط پس از تصمیمِ محصول اجرا شود.
CONTEXT_FILES: ["services/geminiService.ts", "features/chat/ChatView.tsx", "components/icons.tsx", "docs/PROJECT.md"]

## تسک I6 — تستِ یکپارچه‌ی پایان‌به‌پایان (دستی، چک‌لیست)
**راهنمای پیاده‌سازی:** پس از اعمالِ `43` و دیپلویِ Edge: (الف) جستجوی واژه‌ی کلیدیِ خاص (شماره/نام) باید رکوردِ دقیق را بالا بیاورد؛ (ب) `نوع: یادداشت` فقط یادداشت‌ها را برگرداند؛ (ج) `#تگ` فیلتر شود؛ (د) «هفته گذشته» بازه‌ی درست را اعمال کند؛ (ه) کوئریِ تهی/پرنویز نباید خطا دهد (مسیرِ وکتور سالم بماند)؛ (و) رکورد بدونِ `embedding` همچنان از مسیرِ متن یافت شود. نتایج در `docs/CURRENT_TASK.md` ثبت شود.
**محدودیت‌های تسک:** بدونِ کدِ جدید؛ فقط راستی‌آزمایی. هر رگرسیون = بازگشت به تسکِ مربوطه.
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md"]


---

# فاز I — نقشهٔ راهِ مرجع (جستجوی هیبریدی Zero-Cost: FTS/tsvector + RRF + استخراج فیلتر)

> هدف: افزایش شدید دقتِ RAG با صفر هزینهٔ AI. جزئیاتِ معماری در `ARCHITECTURE.md §۱۲` و نبایدها در `PROJECT.md §۴ (۷۱–۷۵)`.

## ترتیبِ اجرا (وابستگی‌ها)
**I1 → I2 → I3 → (I4 اختیاری).** هیچ دو تسکی هم‌زمان روی یک فایل نمی‌نویسند. I3 به RPCِ I1 و ماژولِ I2 وابسته است.

> برای کدنویس (مثل توضیح به یک متخصص که باید قدم‌به‌قدم بفهمد): «جستجوی متنی» یعنی پیداکردنِ کلمه‌ها همان‌طور که نوشته شده‌اند (مثل پیداکردنِ یک نام یا شماره). الان این کار با روشِ «شکستن کلمه به تکه‌های سه‌حرفی» انجام می‌شود که در متن‌های بلند کلی نتیجهٔ بی‌ربط می‌آورد. ما این را با موتورِ متنیِ خودِ دیتابیس (tsvector) عوض می‌کنیم که کلمه‌ها را کامل می‌فهمد. ضمناً به‌جای اینکه دستی بگوییم «نتایجِ ضعیف‌تر از فلان عدد را دور بریز»، اجازه می‌دهیم هر دو موتور (معنایی و متنی) ۱۰۰ نتیجهٔ برترشان را بدهند و یک فرمولِ ساده (RRF) آن‌ها را تلفیق کند.

## تسک I1 — مهاجرت دیتابیس: نرمال‌سازی فارسی + ستون‌های tsvector + بازنویسی hybrid_search [SQL]
**راهنمای پیاده‌سازی:**
1. فایلِ **جدید** `supabase/sql/43_fts_hybrid_search.sql` بساز (فایل‌های قدیمی را دست نزن — Anti §۷۵). همه‌چیز Idempotent و قابلِ‌اجرای دستی در SQL Editor باشد.
2. تابعِ `public.hexer_fa_normalize(text)` را `IMMUTABLE` بساز (ی/ک عربی→فارسی، ZWNJ→فاصله). دقیقاً طبق `ARCHITECTURE.md §۱۲.الف-۱`.
3. سه ستونِ `search_vector tsvector GENERATED ALWAYS AS (...) STORED` با `setweight` و کانفیگِ `'simple'` روی `tasks`(title A/description B/tags C)، `notes`(title A/content B/tags C)، `projects`(title A/description B — **بدون tags**). طبق §۱۲.الف-۲.
4. سه ایندکس GIN روی `search_vector` بساز و چهار ایندکسِ `idx_*_trgm` را `DROP IF EXISTS` کن. طبق §۱۲.الف-۳.
5. `public.hybrid_search` را با امضای جدید (۴ پارامترِ فیلترِ `DEFAULT NULL`) بازنویسی کن: مسیر متنی با `ts_rank_cd` + `websearch_to_tsquery('simple', hexer_fa_normalize(...))` و شرطِ `@@`؛ هر دو مسیر `LIMIT 100`؛ حذفِ هر دو آستانهٔ `>=`؛ RRF با `k=60`؛ خروجی `(id,type,title,snippet,score)` بدون تغییر. عیناً طبق §۱۲.ب.
6. در پایان `NOTIFY pgrst, 'reload schema';`.

**راهنمای پیاده‌سازی (بازپرکردنِ داده‌های موجود):** ستون‌های GENERATED برای ردیف‌های موجود به‌صورت خودکار محاسبه می‌شوند؛ نیازی به backfill دستیِ tsvector نیست. (embedding ردیف‌های قدیمی هم دست‌نخورده باقی می‌ماند.)

**محدودیت‌های تسک:** فقط همین یک فایلِ SQL. **مدلِ embedding و تریگرِ `enqueue_vectorize` و خطِ `vectorize` لمس نشود (Anti §۷۳).** کانفیگِ FTS فقط `'simple'` (Anti §۷۴). نسخهٔ پایه باید سه‌جدولیِ `31` باشد نه دوجدولیِ `26`. افزونهٔ `pg_trgm` حذف نشود (فقط ایندکس‌ها). امضای خروجی نباید تغییر کند (سازگاری با هر دو مصرف‌کننده).
CONTEXT_FILES: ["supabase/sql/31_rag_projects.sql", "supabase/sql/26_update_hybrid_search.sql", "supabase/sql/03_core.sql", "supabase/sql/00_extensions.sql", "supabase/sql/20_refactor_schema.sql", "supabase/sql/10_functions.sql", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک I2 — ماژولِ خالصِ استخراجِ فیلتر با Regex [TS]
**راهنمای پیاده‌سازی:**
1. فایلِ **جدید** `supabase/functions/ai-assistant/lib/query-parser.ts` با تابعِ خالصِ `parseSearchQuery(raw: string, now = new Date())` که `{ cleanText, filterType, tags, dateFrom, dateTo }` برمی‌گرداند (`filterType: 'task'|'note'|'project'|null`؛ `tags: string[]|null`؛ تاریخ‌ها ISO یا null).
2. استخراجِ نوع با Regex: `نوع:`/`type:` + مقدار (یادداشت/نوت/note، تسک/کار/task، پروژه/project)؛ و نیز `پروژه:`/`project:` مستقل → `filterType='project'`. مقدارها به سه مقدارِ متعارف نگاشت شوند.
3. استخراجِ تگ: الگوی `#کلمه` (شاملِ حروف فارسی/لاتین/عدد/زیرخط) → آرایهٔ `tags`. توکن‌های مصرف‌شده از متن حذف شوند.
4. استخراجِ زمان: «امروز/today»، «دیروز/yesterday»، «این هفته/this week»، «هفته گذشته/last week»، «این ماه/this month» → بازهٔ `dateFrom..dateTo` بر اساس `now` (با timezone محلی؛ برای سادگی مرزِ روز با `now` محاسبه شود).
5. `cleanText` = متنِ اصلی منهای همهٔ توکن‌های استخراج‌شده، trim‌شده و فشرده‌سازیِ فاصله‌ها.

**محدودیت‌های تسک:** تابع باید **خالص و بدونِ I/O** باشد (نه Supabase، نه fetch، نه DOM) تا قابلِ‌تستِ واحد باشد. هیچ توکنِ AI مصرف نشود (Anti §۷۳). اگر هیچ الگویی پیدا نشد، `filterType=null, tags=null, dateFrom=null, dateTo=null` و `cleanText = raw`. Regexها باید روی ورودیِ خالی/عجیب امن باشند (throw نکنند).
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/rag-context.ts", "supabase/functions/ai-assistant/lib/action-processor.ts", "types.ts", "docs/ARCHITECTURE.md"]

## تسک I3 — اتصالِ parser به مصرف‌کنندگانِ RAG و عبورِ فیلترها به RPC [TS]
**راهنمای پیاده‌سازی:**
1. در `rag-context.ts`: ابتدا `parseSearchQuery(message)` فراخوانی شود. `cleanText` به `generateEmbedding(ai, cleanText, 'query')` و به `p_query_text` داده شود؛ و `filterType/dateFrom/dateTo/tags` به پارامترهای جدیدِ `hybrid_search` (`p_filter_type/p_date_from/p_date_to/p_tags`) پاس داده شوند. `p_match_count=15` بدون تغییر.
2. لبهٔ خاص: اگر `cleanText` خالی شد، برای embedding از `message` اصلی استفاده شود (جلوگیری از embeddingِ خالی)؛ این رفتار صریح کامنت شود.
3. در `action-processor.ts` (اکشنِ `SUGGEST_LINK`): فراخوانیِ `generateEmbedding(ai, queryText)` به `generateEmbedding(ai, queryText, 'query')` اصلاح شود (هم‌سان‌سازیِ task-type با مسیرِ RAG → دقتِ بازیابیِ بهتر، صفر هزینه). در صورت تمایل می‌تواند از parser هم استفاده کند؛ ولی پارامترهای فیلتر اختیاری‌اند و عبورندادنشان مشکلی ایجاد نمی‌کند (DEFAULT NULL).

**محدودیت‌های تسک:** فقط لایهٔ اتصال؛ ساختارِ خروجیِ `citations`/`contextString` و `match_count`ها تغییر نکند. هیچ embeddingِ اضافه‌ای نباید اضافه شود (همان یک فراخوانیِ کوئری). به `_shared/gemini-client.ts` و خطِ `vectorize` دست نزن (Anti §۷۳). RPC باید با همان نامِ تابع و پارامترهای نام‌دار صدا زده شود.
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/query-parser.ts", "supabase/functions/ai-assistant/lib/rag-context.ts", "supabase/functions/ai-assistant/lib/action-processor.ts", "supabase/functions/_shared/gemini-client.ts", "supabase/functions/ai-assistant/index.ts", "docs/ARCHITECTURE.md"]

## تسک I4 (اختیاری/بعدی) — فیلترهای سریعِ UI روی جستجوی معنایی [TS/TSX]
**راهنمای پیاده‌سازی:**
1. `searchSemantic(query, filters?)` در `services/geminiService.ts` پارامترِ اختیاریِ فیلتر بگیرد و آن را در body به ai-assistant بفرستد (که سپس به `hybrid_search` می‌رسد).
2. یک ردیفِ دکمه‌های Toggle (مثلاً «امروز»، «هفته گذشته»، «فقط یادداشت‌ها») در سطحِ مناسبِ UIِ جستجو اضافه شود که مقادیرِ فیلتر را به‌صورت ساختاریافته پاس دهد (هم‌سان با خروجیِ `parseSearchQuery`).

**محدودیت‌های تسک:** چون `searchSemantic` فعلاً بدونِ مصرف‌کننده است، این تسک **آخر** و کم‌اولویت است و نباید مسیرِ چتِ موجود را بشکند. فقط کلاس‌های Tailwindِ معتبر (Anti §۲۲)، اپ Mobile-Only (Anti §۲۶). هیچ توکنِ AI اضافه مصرف نشود.
CONTEXT_FILES: ["services/geminiService.ts", "features/chat/ChatView.tsx", "components/icons.tsx", "docs/ARCHITECTURE.md"]
