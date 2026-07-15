# فاز O2 — پایداری UX استاندارد اپل [DONE]

> جزئیات کامل: docs/PROJECT.md بخش O2 ، docs/ARCHITECTURE.md بخش O2 ، docs/tasks.md فاز O2.
> پیش‌نیاز انجام‌شده: فاز O (O-1…O-3) Task Update Integrity.

## وضعیت
- [x] O2-8 نوتیفیکیشن foreground (status !== done + permission guard)
- [x] O2-2 کلیک سطر TodaysPlan → رویداد hexer:open-task-editor
- [x] O2-3 حلقه وضعیت هفته = weekly progress
- [x] O2-4 glance: مهم/تعداد امروز + میله 30٪ empty و fill واقعی
- [x] O2-1 Toast موبایل bottom / دسکتاپ top
- [x] O2-5 Zen portal به document.body
- [x] O2-6 حذف عدد دقیقه زیر دکمه استراحت
- [x] O2-7 کوچک‌کردن اعداد روز WeekCalendar

## ترتیب انجام‌شده
O2-8 → O2-2 → O2-3 → O2-4 → O2-1 → O2-5 → O2-6 → O2-7

## فایل‌های تغییر کرده
- hooks/useReminderScheduler.ts
- features/dashboard/components/TodaysPlan.tsx
- features/dashboard/components/StatsOverview.tsx
- components/ui/ToastNotifications.tsx
- features/dashboard/components/FocusTimer.tsx
- features/dashboard/components/WeekCalendar.tsx

## خلاصه اجرا
1. O2-8 — فیلتر task.status !== 'done'؛ early-return اگر permission granted نباشد.
2. O2-2 — کلیک کارت → hexer:open-task-editor؛ checkbox با stopPropagation.
3. O2-3 — حلقه = done/total تسک‌های due هفته جلالی (شنبه→جمعه)، مستقل از selectedDate؛ درصد فارسی.
4. O2-4 — مهم = high-priority tasks امروز؛ fillRatio با empty=30٪؛ label داخل fill.
5. O2-1 — موبایل bottom-above-nav؛ lg: top + safe-area.
6. O2-5 — zen / task picker / duration picker با createPortal(document.body).
7. O2-6 — فقط متن استراحت/فوکوس در bottom bar.
8. O2-7 — day number: text-xs sm:text-sm md:text-base.

## نکته باقی‌مانده (خارج اسکوپ)
اگر push وقتی اپ kill است هنوز fail بود → بررسی Layer B / VAPID با معمار (بدون دست زدن SQL/Edge در این فاز).
