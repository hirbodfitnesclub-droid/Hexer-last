# 🎯 تسک جاری: فاز J — لایه‌ی حریم امن سراسری (شروع از تسک J1)

> فازِ قبلی (I — جستجوی هیبریدی) نهایی شده بود. فازِ فعال اکنون **J** است: رفعِ ریشه‌ایِ حبس‌شدنِ دکمه‌ها/محتوا پشتِ BottomNav و Home Indicator روی موبایل‌های مدرن.
> مرجعِ کامل: `docs/PROJECT.md` فاز J، `docs/ARCHITECTURE.md` §۱۳، و `docs/tasks.md` فاز J (تسک‌های J1–J7).

## 🌲 درخت تمرکز (Focus Tree)
```
index.css                                  ← [J1] هسته: تعریفِ .pt-safe/.pb-safe/.pb-safe-content/.pb-bottom-nav + توکن --bottom-nav-space
components/BottomNav.tsx                    ← [J2] بالا آوردن نوار از Home Indicator
App.tsx                                     ← [J3] main: pb-24 → pb-bottom-nav (مالکِ واحدِ فاصله)
features/dashboard/Dashboard.tsx            ← [J4] حذفِ pb-24 زائد
features/tasks/TasksView.tsx                ← [J4] pb-32→pb-4 + FAB
features/notes/NotesView.tsx                ← [J4] حذفِ pb-32 + FAB
features/projects/ProjectsView.tsx          ← [J4] صفحه + modalِ اینلاین
features/tasks/components/TaskEditorModal.tsx        ← [J5] footer pb-safe + هدر pt-safe
features/notes/components/NoteEditorModal.tsx        ← [J5] pb-20→pb-safe
features/habits/components/HabitEditorModal.tsx      ← [J5] اسکرول pb-safe-content
features/habits/components/HabitManagerModal.tsx     ← [J5] اسکرول pb-safe-content
features/projects/components/ProjectDetailsModal.tsx ← [J5] اسکرول pb-safe-content
features/billing/components/SubscriptionModal.tsx    ← [J6] تأیید pb-safe (فعال‌شده با J1)
features/chat/components/ChatHistoryDrawer.tsx        ← [J6] pb-safe-content
components/PaywallModal.tsx                  ← [J6] pt-safe + pb-safe-content
components/ProfileModal.tsx                  ← [J6] pb-safe-content
```

## 📋 اولین گامِ اجرایی: تسک J1
**این تسک پیش‌نیازِ همه است و باید اول و تنها اجرا شود.** افزودنِ توکن `--bottom-nav-space: 5rem` و چهار کلاسِ حریم امن (با `!important` و fallbackِ `0px`) به `index.css`، دقیقاً مطابقِ `docs/ARCHITECTURE.md` §۱۳.الف. این تسک به‌تنهایی ۶ هدرِ `pt-safe` و footerِ `SubscriptionModal` را که امروز بی‌اثرند، فعال می‌کند.

## ⚠️ یادآوریِ قوانینِ سراسری
- هیچ `tailwind.config`/PostCSS؛ تنها فایلِ تعریف `index.css` است (Anti §۸۰).
- هیچ عددِ جادویی (`pb-24/32/20`) و هیچ افستِ سخت‌کدِ اندیکیتور (Anti §۷۸/§۸۳).
- `h-[100dvh]`/`min-h-0`/`z-index` دست‌نخورده (قراردادِ ضدِّ کیبورد — Anti §۸۱).
- صفرِ رگرسیون روی دستگاه بدونِ notch (مقادیرِ پایه معادلِ پدینگِ فعلی‌اند).

## 📡 رله‌ی کانتکست
پس از اتمامِ هر تسک، نتیجه و هر انحراف را اینجا ثبت کن و به تسکِ بعدی در `docs/tasks.md` فاز J برو. ترتیب: J1 → (J2∥J3∥J4∥J5∥J6) → J7 (تستِ نهایی).
