<!--
  tasks.md — نقشه‌ی راهِ مرجع
  فاز فعال: J — رفع ریشه‌ای Safe Area / Bottom Nav (Edge Insets)
  مرجع معماری: docs/ARCHITECTURE.md §۱۳ — مرجع هویت: docs/PROJECT.md «فاز J»
  (فاز I — جستجوی هیبریدی — تکمیل و آرشیو شده است.)
-->

# فاز J — نقشه‌ی راهِ مرجع (رفع ریشه‌ای Safe Area / Bottom Nav)

## محدودیت‌های سراسریِ فاز J (روی همه‌ی تسک‌ها)
- **به `h-[100dvh]`، `sm:h-auto`، `max-h-*`، `min-h-0`، `overflow-y-auto` دست نزن** (محافظت از رفتار درست کیبورد مجازی — Anti-Pattern §۷۵).
- منبع حقیقت Safe Area فقط کلاس‌های `index.css` است؛ هاردکد `env()` پراکنده ممنوع (§۷۴)، عدد جادوییِ کلیرنس ممنوع (§۷۳).
- `tailwind.config` اضافه نکن؛ Tailwind همان CDN فعلی می‌ماند (§۷۲).
- اپ Mobile-Only است؛ گرید/بریک‌پوینت دسکتاپ اضافه نکن.
- فقط فایل‌های فهرست‌شده در `CONTEXT_FILES` هر تسک را بخوان و فقط فایل هدف همان تسک را ویرایش کن.

## ترتیبِ اجرا (وابستگی‌ها)
`J1` پیش‌نیاز قطعیِ همه است. سپس `J2`→`J3`→`J4`→`J5`→`J6` (روی فایل‌های مجزا؛ موازی نشوند چون کدنویس واحد است، اما تداخل نوشتن ندارند). در پایان `J7` (تست دستی).

---

## تسک J1 — پایه: تعریف منبع واحد حقیقت در `index.css`
**راهنمای پیاده‌سازی:** بلوک CSS فاز J (متغیرها + کلاس‌های `.pt-safe`، `.pb-safe`، `.pb-safe-lg`، `.pb-bottom-nav`، `.bottom-nav-inset`) را عیناً مطابق `ARCHITECTURE.md §۱۳.۱` به **انتهای** `index.css` اضافه کن. متغیرهای قدیمیِ `--safe-area-*` را دست‌نخورده بگذار (سازگاری). چیزی حذف نکن.
**محدودیت اختصاصی:** فقط افزودن؛ مقادیر طراحی (هدر ۲rem، فوتر ۱rem) و `!important` را عیناً نگه‌دار. این تسک هیچ فایل دیگری را تغییر نمی‌دهد.
**خروجی موردانتظار:** بلافاصله تمام `pt-safe`/`pb-safe` موجود (No-Op) فعال می‌شوند.
`CONTEXT_FILES: ["index.css", "index.html", "docs/ARCHITECTURE.md"]`

---

## تسک J2 — بالا بردن BottomNav از روی Home Indicator
**راهنمای پیاده‌سازی:** در `components/BottomNav.tsx`، به کانتینر بیرونیِ `fixed bottom-0 right-0 left-0 h-20 px-4 z-50` کلاس `bottom-nav-inset` را اضافه کن (این کلاس `bottom` را به `var(--safe-bottom)` می‌برد و کل نوار شناور را بالای Home Indicator می‌نشاند). ساختار قرص داخلی، گرید ۵ستونه و دکمه‌ی مرکزی را تغییر نده.
**محدودیت اختصاصی:** هیچ عدد جادویی جدید اضافه نکن؛ فقط همین یک کلاس. `z-50` و `h-20` بمانند.
`CONTEXT_FILES: ["components/BottomNav.tsx", "index.css"]`

---

## تسک J3 — کلیرنس واحدِ صفحات روی پوسته‌ی اپ
**راهنمای پیاده‌سازی:** در `App.tsx`، در `<main ... className="flex-1 overflow-y-auto overflow-x-hidden pb-24">`، کلاس `pb-24` را با `pb-bottom-nav` جایگزین کن. این تنها منبع کلیرنسِ BottomNav برای همه‌ی ویوها می‌شود (هم ویوهای `h-full` و هم Dashboard جریانی).
**محدودیت اختصاصی:** فقط همین یک کلاس عوض شود؛ `h-[100dvh]` روت و ساختار مودال‌های سراسری دست‌نخورده.
`CONTEXT_FILES: ["App.tsx", "index.css"]`

---

## تسک J4 — حذف کلیرنس‌های جادوییِ تکراری در ویوها
**راهنمای پیاده‌سازی:** پس از J3، کلیرنس از `main` می‌آید؛ پس کلیرنس‌های تکراری حذف شوند:
- `features/tasks/TasksView.tsx` (اسکرولر داخلی): `pb-32` → `pb-4`.
- `features/notes/NotesView.tsx` (روت `min-h-full pb-32 ...`): `pb-32` را حذف کن.
- `features/projects/ProjectsView.tsx` (روت `min-h-full pb-32 ...`): `pb-32` را حذف کن.
- `features/dashboard/Dashboard.tsx` (روت `<div className="pb-24">`): `pb-24` را حذف کن.
هدرهای این ویوها از قبل `pt-safe` دارند و اکنون خودکار درست‌اند — آن‌ها را تغییر نده. `DashboardHeader.tsx` نیز `pt-safe` دارد و خودکار درست است؛ اگر فاصله‌ی بالای هدر بیش‌ازحد شد، فقط padding داخلیِ محتوای هدر را تنظیم کن (نه خود `pt-safe`).
**محدودیت اختصاصی:** فقط حذف/کوچک‌کردنِ `pb` صفحه؛ به `flex-1 overflow-y-auto`، `h-full`، `sticky`، یا `pt-safe` دست نزن.
`CONTEXT_FILES: ["features/tasks/TasksView.tsx", "features/notes/NotesView.tsx", "features/projects/ProjectsView.tsx", "features/dashboard/Dashboard.tsx", "features/dashboard/components/DashboardHeader.tsx", "index.css"]`

---

## تسک J5 — اعمال Safe Area روی مودال‌های شیتِ تمام‌قد
**راهنمای پیاده‌سازی:** برای هر مودال، طبق نوعش:
- `features/tasks/components/TaskEditorModal.tsx`: هدر (div `p-4 sm:p-6 ... shrink-0`، حدود خط ۳۰۳) → افزودن `pt-safe`. فوتر (div `p-4 sm:p-6 border-t ... shrink-0`، حدود خط ۶۳۰) → افزودن `pb-safe`. در محتوای اسکرول، `pb-24 sm:pb-6` (خط ۳۲۲) را به `pb-4 sm:pb-6` کاهش بده (فوتر اکنون فاصله را مدیریت می‌کند).
- `features/notes/components/NoteEditorModal.tsx`: هدر `shrink-0` (حدود ۱۸۴) → `pt-safe`. فوترِ متادیتا (`shrink-0 ... p-4 sm:p-6 pb-20 sm:pb-6`، حدود ۲۳۵) → `pb-20 sm:pb-6` را با `pb-safe` جایگزین کن.
- `features/habits/components/HabitEditorModal.tsx`: هدر (حدود ۷۰) → `pt-safe`. ناحیه‌ی اسکرول (`flex-1 overflow-y-auto min-h-0 p-6 ...`، حدود ۸۸) → افزودن `pb-safe-lg` (دکمه‌ها داخل اسکرول‌اند، فوتر ثابت ندارد).
- `features/habits/components/HabitManagerModal.tsx`: هدر (حدود ۹۷) → `pt-safe`. ناحیه‌ی اسکرول (`flex-1 overflow-y-auto min-h-0 p-5`، حدود ۱۱۵) → افزودن `pb-safe-lg`.
- `features/projects/components/ProjectDetailsModal.tsx`: هدر (حدود ۸۸) → `pt-safe`. ناحیه‌ی اسکرول (`flex-1 overflow-y-auto min-h-0 p-5 sm:p-6`، حدود ۱۱۶) → افزودن `pb-safe-lg` (فوتر ثابت ندارد).
**محدودیت اختصاصی:** فقط افزودنِ کلاس‌های سمنتیک؛ ساختار شیت، `h-[100dvh] sm:h-auto`، `min-h-0`، انیمیشن‌ها و `z-index`ها دست‌نخورده. کلاس‌های padding افقیِ موجود (`px-*`) را حذف نکن.
`CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/notes/components/NoteEditorModal.tsx", "features/habits/components/HabitEditorModal.tsx", "features/habits/components/HabitManagerModal.tsx", "features/projects/components/ProjectDetailsModal.tsx", "index.css", "docs/ARCHITECTURE.md"]`

---

## تسک J6 — کشوها، اورلی‌ها و مودال ایجادِ پروژه
**راهنمای پیاده‌سازی:**
- `features/chat/components/ChatHistoryDrawer.tsx`: ناحیه‌ی اسکرول (`p-4 overflow-y-auto ... flex-1`، حدود ۶۲) → افزودن `pb-safe-lg`.
- `components/PaywallModal.tsx`: روت اسکرولِ تمام‌صفحه (`fixed inset-0 ... overflow-y-auto px-5 py-6`، حدود ۱۰۹) → افزودن `pt-safe`؛ بلوک داخلیِ پایانی (`... min-h-full justify-between pb-8`، حدود ۱۱۵) → `pb-8` را با `pb-safe-lg` جایگزین کن.
- `features/projects/ProjectsView.tsx` (مودال ایجادِ inline): هدر (`p-5 border-b ... shrink-0`، حدود ۱۲۸) → `pt-safe`؛ فوتر (`p-5 border-t ... shrink-0`، حدود ۱۹۰) → `pb-safe`.
- `features/billing/components/SubscriptionModal.tsx`: هدر (`p-4 border-b ... flex-shrink-0`، حدود ۱۲۶) → `pt-safe`. فوتر از قبل `pb-safe` دارد (خط ۳۱۲) و با J1 خودکار درست می‌شود — تغییرش نده.
**محدودیت اختصاصی:** فقط افزودن/جایگزینیِ کلاس‌های سمنتیک؛ ساختار overlay و `z-index`ها دست‌نخورده.
`CONTEXT_FILES: ["features/chat/components/ChatHistoryDrawer.tsx", "components/PaywallModal.tsx", "features/projects/ProjectsView.tsx", "features/billing/components/SubscriptionModal.tsx", "index.css"]`

---

## تسک J7 — تست یکپارچه‌ی پایان‌به‌پایان (دستی، چک‌لیست)
**راهنمای پیاده‌سازی:** روی شبیه‌ساز/دستگاهِ دارای Notch + Home Indicator (مثلاً iPhone 15، اندروید با نوار ژست) در حالت PWA standalone، موارد زیر را تأیید کن:
1. BottomNav کاملاً بالای Home Indicator است و هیچ آیتمی پشت آن نمی‌رود.
2. در `TaskEditorModal`/`NoteEditorModal`/مودال ایجاد پروژه/`SubscriptionModal`: دکمه‌ی ذخیره/تأیید/انصرافِ فوتر کاملاً بالای Home Indicator و قابل‌کلیک است.
3. در `HabitEditorModal`/`HabitManagerModal`/`ProjectDetailsModal`/`ChatHistoryDrawer`: اسکرول تا انتها، آخرین آیتم/دکمه را کاملاً نمایان می‌کند.
4. هدرهای ویوها و شیت‌ها زیر Notch/Dynamic Island نمی‌روند.
5. کیبورد مجازی: باز/بسته‌شدن کیبورد در ادیتورها هنوز درست کار می‌کند و فوتر بیرون نمی‌زند (رگرسیون نکرده).
6. صفحه‌های کوتاه (iPhone SE فاقد inset): فاصله‌های اضافیِ نامتعارف ایجاد نشده (چون `env()` صفر است).
**محدودیت اختصاصی:** بدون تغییر کد؛ صرفاً ارزیابی و ثبت نتیجه در `docs/CURRENT_TASK.md`.
`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "docs/PROJECT.md", "index.css"]`
