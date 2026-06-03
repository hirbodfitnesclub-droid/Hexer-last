# CURRENT_TASK.md — تمرکز فعلی: فاز E (کارت به کارت + رسید) — سهم کلاینت

> این سند، کلید کانتکست برای پیاده‌سازی فیچر «کارت به کارت + آپلود رسید» در کلاینت Hexer AI است.
> مرجع کامل: `PROJECT.md §۷` (دامنه/ضدالگوها) و `ARCHITECTURE.md §۸` (طراحی فنی) و `tasks.md` (فاز E / C1–C5).
> تسک‌های پنل ادمین خارج از این سند و منحصراً در `docs_of_manager_panel/` هستند.

---

## ۱. خلاصه‌ی فیچر در یک نگاه
افزودن یک مسیر پرداخت **آفلاین و موازی** (کارت به کارت با آپلود رسید) در کنار درگاه آنلاین زیبال، برای حفظ درآمد هنگام قطعی درگاه و مدیریت حجم Storage رایگان. درگاه آنلاین دست‌نخورده می‌ماند.

## ۲. درخت تمرکز (Focus Tree)
```text
/
├── supabase/sql/28_card_to_card_system.sql      ← (C1) جدید: columns + bucket + ۴ RPC
├── types.ts                                      ← (C2) ManualPaymentState
├── services/billingService.ts                    ← (C2) preview/submit/state + discount در checkout
├── components/ProfileModal.tsx                    ← (C3) ورود اشتراک از پروفایل
└── features/billing/components/
    ├── SubscriptionModal.tsx                      ← (C3) وضعیت + لیست پلن (تمدید/خرید)
    ├── PaymentMethodModal.tsx                     ← (C4) کد تخفیف + بای‌پس ۱۰۰٪ + ۲ شیوه
    └── ReceiptUploadModal.tsx                     ← (C5) آپلود رسید + قفل pending + بنر رد
```

## ۳. ترتیب اجرا (اجباری، متوالی)
1. **C1** — Migration دیتابیس/Storage و ۴ RPC (پایه‌ی مشترک با ادمین).
2. **C2** — تایپ‌ها و لایه‌ی سرویس (`previewDiscount`, `submitManualPayment`, `getManualPaymentState`, `startCheckout` با کد تخفیف).
3. **C3** — انتقال ورود اشتراک به مودال پروفایل + نمای وضعیت.
4. **C4** — مودال انتخاب شیوه‌ی پرداخت + کد تخفیف + بای‌پس ۱۰۰٪.
5. **C5** — مودال آپلود رسید + قفل «در انتظار تایید» + بنر رد.

## ۴. قوانین قرمز این سشن (از §۷.۵ و §۸)
- نوشتن در `payments` فقط از RPC (`submit_manual_payment`)؛ هیچ INSERT/UPDATE مستقیم کلاینت.
- رزرو/رول‌بک کوپن فقط سمت سرور؛ کلاینت فقط `preview_discount`.
- ضدِ Double-Count: تایید دستی با `activate_manual_subscription` (بدون لمس کوپن)، نه `activate_subscription`.
- رسید: گارد ۲MB + فشرده‌سازی <۵۰۰KB + باکت خصوصی `receipts` + بدون Base64.
- وضعیت `pending_manual` کاملاً قفل است (نه خرید، نه لغو).

## ۵. Definition of Done
- [ ] فایل `28_...sql` ساخته و Idempotent است (آماده‌ی اجرای دستی).
- [ ] کاربر می‌تواند از مودال پروفایل وضعیت اشتراک و پلن‌ها (تمدید/خرید) را ببیند.
- [ ] کد تخفیف ۱۰۰٪ → فعال‌سازی مستقیم بدون بانک؛ غیر آن → دو شیوه‌ی پرداخت.
- [ ] کارت‌به‌کارت: رسید فشرده <۵۰۰KB آپلود و کوپن (در صورت وجود) رزرو می‌شود؛ وضعیت `pending_manual` قفل.
- [ ] پس از رد ادمین، بنر «علت رد» نمایش و خرید مجدد باز می‌شود.
- [ ] `npm run build` بدون خطا؛ هیچ رگرسیون روی فلوی آنلاین زیبال.
