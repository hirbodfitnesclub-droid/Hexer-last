# 🎯 تسک جاری: رفع ریشه‌ای Safe Area / Bottom Nav (فاز J)

> مرجع کامل: `docs/tasks.md` (فاز J) و `docs/ARCHITECTURE.md §۱۳`. هویت/نبایدها: `docs/PROJECT.md` «فاز J».

## 🌲 درخت تمرکز (Focus Tree)
1. **J1 (پایه، پیش‌نیاز همه):** افزودن منبع واحد حقیقت به `index.css` (متغیرها + کلاس‌های `.pt-safe`/`.pb-safe`/`.pb-safe-lg`/`.pb-bottom-nav`/`.bottom-nav-inset`).
2. **J2:** `components/BottomNav.tsx` ← کلاس `bottom-nav-inset`.
3. **J3:** `App.tsx <main>` ← `pb-24`→`pb-bottom-nav`.
4. **J4:** حذف `pb-24`/`pb-32` جادویی در `TasksView`/`NotesView`/`ProjectsView`/`Dashboard`.
5. **J5:** Safe Area روی شیت‌های تمام‌قد (Task/Note/Habit/HabitManager/ProjectDetails).
6. **J6:** کشو/اورلی/مودال ایجاد پروژه (ChatHistoryDrawer/PaywallModal/ProjectsView-create/SubscriptionModal).
7. **J7:** تست دستی پایان‌به‌پایان.

## 📌 ریشه‌ی باگ (تثبیت‌شده از کد)
- `pt-safe`/`pb-safe` تعریف‌نشده بودند (Tailwind CDN، بدون config) → Safe Area عملاً صفر.
- BottomNav بدون حریم امن؛ کلیرنس صفحات با اعداد جادویی بدون `env()`.
- الگوی درست فقط در `Onboarding` و `WeeklyReportModal` وجود داشت.

## ✅ اصل راه‌حل
یک منبع واحد در `index.css` که نام‌های موجود (`pt-safe`/`pb-safe`) را واقعی می‌کند، و کلیرنس BottomNav را به توکن `--bottom-nav-space` گره می‌زند. بدون دست‌زدن به `h-[100dvh]`/`overflow-y-auto` (محافظت از کیبورد مجازی).

## 📡 رله‌ی کانتکست (Context Relay)
- وضعیت: تسک‌ها خرد و آماده‌ی پیاده‌سازی‌اند. کدنویس باید از J1 شروع و به ترتیب پیش رود.
- چک‌لیست نهایی در `docs/tasks.md` تسک J7.
