---

## فاز E — پرداخت «کارت به کارت + رسید» (سهم کلاینت Hexer AI)

---
###یادآوری نکته مهم:
 تو هیچ وقت نباید یک فایل sql رو ویرایش کنی. چون ما در سوپابیس این فایل ها را از طریق sql editor دیپلوی میکنیم و این فایلقبلا دیپلوی شده؛ پس باید برای ایجاد تغییرات یک فایل کاملا جدید بسازی که با دیپلوی کردنش تغییراتی که نیاز داریم انجام بشه.


> مرجع معماری: `ARCHITECTURE.md §۸`. تسک‌های ادمین در `docs_of_manager_panel/tasks.md` (TASK 5–6).
> ترتیب اجبارا متوالی: C1 → C2 → C3 → C4 → C5. تسک‌هایی که روی فایل‌های یکسان می‌نویسند موازی نشده‌اند.

---

### تسک C1 — Migration دیتابیس و Storage (پایه‌ی مشترک)

**راهنمای پیاده‌سازی فنی:**
فایل جدید `supabase/sql/28_card_to_card_system.sql` بساز (Idempotent، اجرای دستی توسط مالک):
1. `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS offline_receipt_url TEXT;` و `... manual_decline_reason TEXT;`
2. باکت خصوصی: `INSERT INTO storage.buckets (id, name, public) VALUES ('receipts','receipts',false) ON CONFLICT (id) DO NOTHING;` (RLS سراسری `storage.objects` از قبل own-folder را پوشش می‌دهد؛ policy جدید لازم نیست).
3. RPC `preview_discount(p_plan_code text, p_code text)` — فقط خواندنی؛ خروجی `(valid bool, reason text, plan_price bigint, discount_amount bigint, final_amount bigint, is_full_discount bool)`. منطق محاسبه‌ی تخفیف **عیناً** مثل `zibal-request` (درصدی/مبلغی، cap روی قیمت پلن).
4. RPC `submit_manual_payment(p_plan_code text, p_code text, p_receipt_path text) RETURNS uuid` — طبق `ARCHITECTURE.md §۸.۳`: گارد یک `pending_manual` باز، خواندن قیمت پلن، رزرو کوپن با `FOR UPDATE` و `used_count++`، خطا اگر `final_amount=0`، درج ردیف با `status='pending_manual'`, `gateway='card_to_card'`, `user_id=auth.uid()`.
5. RPC `activate_manual_subscription(p_payment_id uuid) RETURNS boolean` — اعتبار `pending_manual`؛ `paid`+upsert subscription+ریست usage؛ **بدون لمس کوپن**.
6. RPC `reject_manual_payment(p_payment_id uuid, p_reason text) RETURNS boolean` — `failed`+`manual_decline_reason`؛ رول‌بک `used_count = greatest(0, used_count-1)` اگر کوپن داشت.
7. انتها: `NOTIFY pgrst, 'reload schema';`

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط فایل `28_...` جدید. ✅ همه چیز Idempotent (`IF NOT EXISTS`/`create or replace`). ✅ پول `bigint` ریالی.
- ❌ هیچ فایل SQL موجود ویرایش نشود. ❌ `activate_subscription` و `زیبال` دست نخورند. ❌ RLS جداول تغییر نکند. ❌ INSERT/UPDATE policy کلاینت روی `payments` اضافه نشود (RPC کافی است).

CONTEXT_FILES: ["supabase/sql/04_payments.sql", "supabase/sql/23_add_discount_system.sql", "supabase/sql/02_billing.sql", "supabase/sql/11_storage.sql"]

---

### تسک C2 — تایپ‌ها و لایه‌ی سرویس کلاینت

**راهنمای پیاده‌سازی فنی:**
1. `types.ts`: افزودن `'pending_manual'` به اتحاد وضعیت در صورت نیاز نمایش؛ افزودن تایپ `ManualPaymentState = { state: 'none' | 'pending' | 'rejected'; reason?: string }`.
2. `services/billingService.ts`:
   - `startCheckout(planCode, discountCode?)`: آرگومان اختیاری اضافه شود و در `body` به `zibal-request` پاس داده شود (`{ plan_code, discount_code }`).
   - `previewDiscount(planCode, code)` → `supabase.rpc('preview_discount', { p_plan_code, p_code })`.
   - `submitManualPayment(planCode, code, file)`: گارد >۲MB، فشرده‌سازی <۵۰۰KB با حلقه روی `compressImage`، `dataURLtoBlob`، آپلود به `receipts/{uid}/{uuid}.jpg`، سپس `supabase.rpc('submit_manual_payment', {...})`.
   - `getManualPaymentState()`: آخرین ردیف `gateway='card_to_card'` کاربر را بخواند و `ManualPaymentState` برگرداند.

**محدودیت‌های اختصاصی تسک:**
- ✅ بازاستفاده از `utils/imageUtils.ts` (نساختن فشرده‌ساز جدید). ✅ همه‌ی نوشتن‌ها از RPC.
- ❌ نوشتن مستقیم در `payments`. ❌ تغییر/رزرو کوپن سمت کلاینت. ❌ تغییر UI در این تسک.

CONTEXT_FILES: ["types.ts", "services/billingService.ts", "services/supabaseClient.ts", "utils/imageUtils.ts", "supabase/functions/zibal-request/index.ts"]

---

### تسک C3 — انتقال ورود اشتراک به مودال پروفایل + نمای وضعیت

**راهنمای پیاده‌سازی فنی:**
1. `SubscriptionModal.tsx` جدید در `features/billing/components/`: نمای وضعیت فعلی (پلن/انقضا یا «در انتظار تایید» یا بنر «رد + علت» از `getManualPaymentState`)، سپس لیست پلن‌ها با دکمه‌ی «تمدید» (اشتراک active) یا «خرید». در وضعیت `pending` دکمه‌ها قفل.
2. `ProfileModal.tsx`: دکمه‌ی badge پلن، به‌جای trigger مستقیم Paywall، `SubscriptionModal` را باز کند.
3. هندل state machine نمایش طبق `ARCHITECTURE.md §۸.۵`.

**محدودیت‌های اختصاصی تسک:**
- ✅ رعایت الگوی مودال موبایل §۷.۳ و z-index §۷.۲. ✅ RTL با `dir="rtl"`.
- ❌ منطق پرداخت/کوپن اینجا پیاده نشود (مال C4/C2 است). ❌ کلاس Tailwind نامعتبر.

CONTEXT_FILES: ["components/ProfileModal.tsx", "features/billing/pages/SubscriptionPage.tsx", "services/billingService.ts", "types.ts"]

---

### تسک C4 — مودال انتخاب شیوه پرداخت + کد تخفیف + بای‌پَس ۱۰۰٪

**راهنمای پیاده‌سازی فنی:**
1. `PaymentMethodModal.tsx` جدید: فیلد کد تخفیف → `previewDiscount`. اگر `is_full_discount` → تنها دکمه‌ی «فعال‌سازی رایگان» (`startCheckout(plan, code)` → bypass). در غیر این صورت دو دکمه: «پرداخت آنلاین زیبال» (`startCheckout(plan, code)`) و «کارت به کارت».
2. اتصال از `SubscriptionModal` (انتخاب پلن → باز شدن این مودال).

**محدودیت‌های اختصاصی تسک:**
- ✅ نمایش مبلغ نهایی پس از تخفیف از خروجی `preview_discount`. ✅ پیام خطای فارسی برای کد نامعتبر.
- ❌ محاسبه‌ی نهایی تخفیف سمت کلاینت معتبر تلقی نشود (سرور مرجع است).

CONTEXT_FILES: ["features/billing/components/SubscriptionModal.tsx", "services/billingService.ts", "components/PaywallModal.tsx"]

---

### تسک C5 — مودال آپلود رسید + قفل «در انتظار تایید» + بنر رد

**راهنمای پیاده‌سازی فنی:**
1. `ReceiptUploadModal.tsx` جدید: اطلاعات کارت مقصد، فایل‌پیکر `accept="image/*"`، گارد ۲MB، پیش‌نمایش، دکمه‌ی ثبت → `submitManualPayment`. روی موفقیت → بستن و رفتن به وضعیت `pending`.
2. در `SubscriptionModal`: وضعیت `pending` → فقط پیام «در انتظار تایید» بدون هیچ دکمه (نه لغو، نه خرید). وضعیت `rejected` → بنر قرمز با علت + باز شدن مجدد خرید.

**محدودیت‌های اختصاصی تسک:**
- ✅ فشرده‌سازی پیش از آپلود (از سرویس C2). ✅ مدیریت خطای آپلود با پیام فارسی.
- ❌ دکمه‌ی لغو/انصراف در وضعیت `pending` ساخته نشود (طبق محصول). ❌ آپلود فایل غیرتصویری یا >۲MB.

CONTEXT_FILES: ["features/billing/components/PaymentMethodModal.tsx", "features/billing/components/SubscriptionModal.tsx", "services/billingService.ts", "utils/imageUtils.ts"]

---

## نقشه وابستگی (فاز E)
C1 (DB/Storage) → C2 (types+service) → C3 (relocation+status) → C4 (payment method+discount) → C5 (receipt+lock+banner)

> C1 پیش‌نیاز همه است (RPCها). C2 پیش‌نیاز C3/C4/C5 است (سرویس). C3→C4→C5 به‌خاطر اشتراک فایل `SubscriptionModal` متوالی‌اند.
