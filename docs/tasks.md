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