# CURRENT_TASK.md — تمرکز فعلی: فاز کارت به کارت (بازرسی رسیدهای آفلاین) — سهم پنل ادمین

> این سند، کلید کانتکست برای پیاده‌سازی بخش **تایید/رد پرداخت‌های دستی** در پنل مدیریت Hexer است.
> مرجع کامل: `PROJECT.md §۷.ب` و `ARCHITECTURE.md §۶`. گام‌به‌گام: `tasks.md` (TASK 5–6).
> تسک‌های سمت کاربر (کلاینت Hexer AI) در این پوشه نیستند؛ در `docs/` مخزن کلاینت‌اند.

---

## ۱. خلاصه‌ی فیچر در یک نگاه (سهم ادمین)
پنل باید لیست درخواست‌های کارت‌به‌کارتِ `pending_manual` را با رسید و مبلغ نشان دهد و امکان **تایید** (فعال‌سازی اشتراک + حذف فوری رسید) و **رد** (ثبت علت + رول‌بک کوپن + حذف رسید) را بدهد.

## ۲. درخت تمرکز (Focus Tree)
```text
/
├── supabase/functions/admin-api/index.ts          ← (T5) ۳ case جدید
└── src/
    ├── lib/supabase.ts                             ← (T6) فیلدهای DTO پرداخت دستی
    ├── lib/dataStore.ts                            ← (T6) get/approve/reject manual
    ├── store/adminStore.ts                         ← (T6) تب 'manual_payments'
    ├── App.tsx                                      ← (T6) رندر صفحه‌ی جدید
    ├── components/layout/AdminLayout.tsx           ← (T6) آیتم ناوبری
    ├── pages/ManualPaymentsManager.tsx             ← (T6) جدید: لیست تاییدات
    └── components/ui/
        ├── ReceiptViewerModal.tsx                  ← (T6) جدید: نمایش رسید
        └── RejectReasonModal.tsx                   ← (T6) جدید: مودال رد با علت
```

## ۳. ترتیب اجرا (اجباری، متوالی)
1. **TASK 5** — افزودن `list_manual_payments` / `approve_manual_payment` / `reject_manual_payment` به `admin-api`.
2. **TASK 6** — فرانت پنل: متدهای dataStore، تب و ناوبری، صفحه‌ی تاییدات و مودال‌های رسید/رد.

## ۴. قوانین قرمز این سشن
- تایید با `activate_manual_subscription` (نه `activate_subscription`) → جلوگیری از Double-Count کوپن.
- حذف رسید از باکت خصوصی `receipts` **پس از هر تایید و هر رد**، فقط با `service_role` داخل Edge Function.
- نمایش رسید فقط با **Signed URL کوتاه‌عمر**؛ URL مستقیم باکت private کار نمی‌کند.
- رد درخواست → ثبت `manual_decline_reason` + رول‌بک `used_count` (داخل RPC).
- بدون SQL جدید (فایل `28_...` در مخزن کلاینت است و قبلاً اجرا شده).

## ۵. Definition of Done
- [ ] لیست `pending_manual` با رسید (Signed URL) و مبلغ تومانی نمایش داده می‌شود.
- [ ] تایید → اشتراک فعال، پرداخت `paid`، رسید حذف، کوپن **بدون** افزایش دوباره.
- [ ] رد → پرداخت `failed`، علت ذخیره، کوپن رول‌بک، رسید حذف.
- [ ] هیچ caseی موجود `admin-api` رگرسیون نمی‌دهد؛ `npm run build` سبز.
