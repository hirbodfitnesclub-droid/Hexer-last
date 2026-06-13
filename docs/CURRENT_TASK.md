# CURRENT_TASK.md — پیاده‌سازی تسک‌های ۵ تا ۷ آنبوردینگ جدید (Educational Walkthrough)

> هدف در این گام: پیاده‌سازی کامل بخش دوم از بازطراحی آنبوردینگ شامل تسک‌های ۵ و ۶ و ۷ (پیاده‌سازی مراحل نام و صفحه‌ی انتخاب، کانتینر/ماشین‌حالت اصلی، و هدایت جریان آنبوردینگ و اتصال به App و پاک‌سازی نهایی).

---

## وضعیت تسک‌ها (تسک‌های ۱ تا ۴ با موفقیت پیاده‌سازی شدند)
- [x] **تسک ۱ — ماژول داده‌ی اسلایدها** (انجام شد) -> `features/onboarding/data/slides.tsx`
- [x] **تسک ۲ — سرویس پروفایل** (انجام شد) -> `services/profileService.ts`
- [x] **تسک ۳ — کامپوننت ارائه‌ی یک اسلاید** (انجام شد) -> `features/onboarding/components/SlideCard.tsx`
- [x] **تسک ۴ — اسلایدر با انیمیشن (SlideViewer)** (انجام شد) -> `features/onboarding/components/SlideViewer.tsx`
- [x] **تسک ۵ — مرحله‌ی نام و صفحه‌ی انتخاب** (انجام شد) -> `features/onboarding/components/NameStep.tsx` و `WelcomeChoice.tsx`
- [x] **تسک ۶ — کانتینر / ماشین‌حالت آنبوردینگ** (انجام شد) -> `features/onboarding/Onboarding.tsx`
- [x] **تسک ۷ — اتصال به App و حذف آنبوردینگ قدیمی** (انجام شد) -> `App.tsx` و حذف `components/Onboarding.tsx`
- [x] **تسک ۸ — بهبود زبان و کپی رایتینگ آنبوردینگ** (انجام شد) -> بومی‌سازیِ روان‌تر متون، اختیاری کردن نام خانوادگی، تغییر پلیس‌هولدرها به «سینا / رادمان»، بومی‌سازی خطاهای بارگذاری و ارتقای حس «دستیار هوشمند شخصی هکسر»
- [x] **تسک ۹ — بازطراحی آیکون هوش مصنوعی بدون ماه و تغییر لوگوی Auth** (انجام شد) -> تبدیل آیکون قدیمی هلال ماه (موجود در SparklesIcon) به آیکون مدرن و پرابهت سه ستاره‌ (مشابه موتور جمینی)، جایگزین کردن هر دو لوگو با نشان اصلی آیکون برنامه در Auth.tsx و متناسب‌سازی آیکون در بخش آنبوردینگ هوش مصنوعی. 
- [x] **تسک ۱۰ — شخصی‌سازی پیام خوش‌آمدگویی داشبورد** (انجام شد) -> تغییر عنوان ثابت «سلام رفیق» به عنوان داینامیک «سلام {نام_کاربر}» بر اساس نام استخراج‌شده (فقط بخش اول نام قبل از کاراکتر فاصله جهت صمیمیت و سادگی بیشتر برای تمامی کاربران با هر حجم نامی).

---

## محدودیت‌های سراسری (روی همه‌ی تسک‌ها اعمال می‌شود)
- **Tailwind:** فقط پله‌های رنگی معتبر `50,100,...,900,950`. کلاس‌هایی مثل `*-450`/`*-850`/`neutral-850` ممنوع (Anti §۲۰/§۲۲).
- **آیکون:** فقط از `components/icons.tsx`. **استفاده از اموجی به‌عنوان آیکون ممنوع (Anti §۲۱).**
- **انیمیشن:** فقط با `motion` (نصب‌شده). import: `import { motion, AnimatePresence } from 'motion/react'`. به CSSِ `animate-fade-in`/`animate-shake` تکیه نشود (در `index.css` تعریف نشده‌اند).
- **Mobile-only:** صفحه full-screen با `fixed inset-0`. از گریدهای Desktop (`md:`/`lg:`) برای چیدمان اصلی پرهیز شود (Anti §۲۶). رعایت Safe-Area (متغیرهای موجود در `index.css`).
- **RTL:** `dir="rtl"`. جهت آیکون «بازگشت» به سمت راست/شروع باشد؛ `ChevronRightIcon` برای بازگشت (Anti §۳۶). بدون Horizontal overflow: `max-w-full` + `min-w-0` (Anti §۳۵).
- **خطاها:** هر خطای شبکه/Supabase با پیام فارسی و افت تدریجی مدیریت شود؛ دکمه‌ی نهایی حالت loading داشته باشد (Anti §۲۱).
- **معماری:** هر فایل یک مسئولیت (Anti §۱۱). بیزینس‌لاجیک نوشتن DB در سرویس، نه در کامپوننت (Anti §۱۳).

---

## تسک ۵ — مرحله‌ی نام و صفحه‌ی انتخاب (گام بعدی)
**فایل‌های جدید:**
- `features/onboarding/components/NameStep.tsx`
- `features/onboarding/components/WelcomeChoice.tsx`
**راهنمای پیاده‌سازی:**
- `NameStep`: دو input «نام» و «نام خانوادگی»، props: `{ onSubmit: (fullName: string) => void }`. اعتبارسنجی: هر دو غیرخالی؛ مقدار نهایی = `${first} ${last}`.trim() (در ستون موجود `full_name` ذخیره می‌شود؛ بدون مایگریشن). دکمه‌ی «ادامه» تا معتبر شدن disabled. خطای فارسی با `motion` نمایش داده شود.
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
