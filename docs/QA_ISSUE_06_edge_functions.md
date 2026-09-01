# 🐛 پیشنویس مورد اصلاحی ۰۶ — Edge Functions: موارد متوسط و جزئی

**تاریخ ثبت:** 2026-08-23
**وضعیت:** برای تصمیم آرش (فیکس‌ها نیازمند deploy هستند)
**کشف:** subagent edge-functions-qa (پوشش کامل ۳۳/۳۳)

---

## خبرهای خوب ✅ (رد شده‌های adversarial)

- **پرداخت zibal سالم است:** قیمت فقط از جدول plans خوانده می‌شود، verify سه چک متقاطع دارد (orderId/amount/refNumber با gateway واقعی)، double-verify اشتراک را stack نمی‌کند، تخفیف یک‌بار مصرف است.
- **مسیر traversal ادعای فاز ۱.۵ رد شد:** media-handler الان `%2e%2e` و `..` را می‌گیرد — اصلاح شده.
- **هر ۴ worker secret check دارند** قبل از هر کاری؛ vault fallback سالم است.
- **Feature flags fail-closed هستند** — خطای DB یا flag غایب یعنی mutation انجام نمی‌شود.
- **مالکیت در action-processor دو لایه چک می‌شود** (resolveOwned + eq user_id) — هر ۱۹ اکشن سالم.
- **Quota reservation leak حداکثر ۱۰ دقیقه است** — قفل دائمی کاربر ناممکن.

## موارد باز

### ⚠️ A. Rate limiter بی‌اثر + قابل جعل (security.ts:6,143-157)
Map درون‌حافظه در serverless با هر cold start ریست می‌شود + کلید از اولین عضو X-Forwarded-For که کلاینت کنترلش می‌کند ساخته می‌شود. در sms-hook سد دیتابیسی جایگزین داریم ولی در zibal-request این تنها سد ساخت رکورد پرداخت هرز است.

### ⚠️ B. admin-api: کوئری‌ها بدون limit + listUsers کامل
همه‌ی list اکشن‌ها select(*) بدون limit و join در حافظه O(n×m). الان با ۱۲ کاربر بی‌خطر است؛ با رشد، هر باز شدن پنل ادمین اسکن کامل چند جدول است. authZ خود پنل سالم است (app_metadata role + MFA aal2).

### ⚠️ C. sms-hook fail-open اگر SEND_SMS_HOOK_SECRET ست نباشد (sms-hook:37-50)
بدون secret، بدنه‌ی خام هر فرستنده‌ای پذیرفته می‌شود (سدهای ثانویه: تطابق phone با auth، cap 3/10min). تنظیم فعلی env از بیرون قابل تأیید نیست → توصیه: fail-closed شود.
**به‌روزرسانی 2026-08-24:** سکرت ست شد (بخش امنیتی حل شد) + یک باگ عملکردی جدید کشف شد (OTP شماره‌ی جدید → خطای hook 403). جزئیات کامل و کارهای باقی‌مانده: [SMS_HOOK_STATUS_2026-08-24.md](SMS_HOOK_STATUS_2026-08-24.md)
**فیکس کد نوشته شد (2026-08-24، منتظر deploy):** تابع الان fail-closed است (secret غایب → خطا، نه پذیرش بی‌امضا) و برای کاربر ناموجودِ ثبت‌نامی، امضای معتبر Standard Webhooks جایگزین چک مالکیت شد — cap 3/10min و replay-guard سر جایشان. تست انسانی پس از deploy: ثبت‌نام شماره‌ی جدید، فراموشی رمز شماره‌ی موجود، و curl بدون امضا (باید 401 بگیرد).

### ⚠️ D. push-dispatch مسیر legacy بدون lease — push دوبله ممکن
دو اجرای هم‌زمان cron هر دو همین یادآورها را می‌بینند و می‌فرستند. پنجره باریک است ولی واقعی. outbox-dispatch جدید این را حل کرده ولی خاموش است.

### ℹ️ E. RAG: متن کامل نوت به prompt می‌رود (بدون برش) — هزینه‌ی توکن + سطح تزریق
hybrid_search snippet را بریده برنمی‌گرداند؛ rag-context تا ۵ سند بدون سقف طول داخل system prompt می‌گذارد. مهار خروجی سه‌لایه است (schema/policy/ownership) پس write مخرب ناممکن است؛ مشکل هزینه/کیفیت است.

### ℹ️ F. جزئیات
- UPDATE_TASK_CHECKLIST با updates={} → خطای تمیز database_error
- updates.status در UPDATE_TASK هر رشته‌ای می‌پذیرد (enum دستی نیست)
- ilike با ورودی خام → wildcard % کار می‌کند
- finalize_notification_message: حالت partial ترمینال است، endpoint گذرا retry نمی‌شود
- خطای HTTP بعد از insert payment در zibal-request ردیف را pending رها می‌کند

## اولویت پیشنهادی
1. C (fail-closed) — یک خط، امنیتی
2. B (.limit() ها) — قبل از رشد کاربر
3. A (rate limit به Deno KV یا حداقل آخرین عضو XFF + سقف دیتابیسی)
4. D هنگام روشن‌کردن reminder_outbox_v2 حل می‌شود (همان ISSUE_03 مورد ۳)
