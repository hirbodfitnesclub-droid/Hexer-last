# 🐛 پیشنویس مورد اصلاحی ۰۳ — Default ACL باز + Drift فایل‌های migration با production

**تاریخ ثبت:** 2026-08-23
**شدت:** ⚠️ متوسط (بمب ساعتی امنیتی + ریسک عملیاتی)
**وضعیت:** ✅ migrationهای ۱ و ۳ نوشته شدند (2026-08-24) — `20260824080000_default_privileges_lockdown.sql` و `20260824080100_reminder_outbox_supersede_is_sent.sql`. برای مورد ۲ هم `20260824080200_sync_claim_staleness_guard.sql` اضافه شد که تعریف زنده‌ی `claim_notification_messages` (با پارامتر چهارم + staleness guard، کپی ورباتیم از production) را وارد repo می‌کند — idempotent است. بقیه‌ی ۴ فایل جاافتاده (canary overrideها و rollout stage) عمداً بازسازی نشدند چون یک‌بارمصرف‌اند؛ در RELEASE_BASELINE ثبت شده‌اند. اعمال روی production نیازمند تأیید لحظه‌ای آرش.
**کشف توسط:** subagent db-security-qa؛ بازتأیید مستقل main session (default ACL)

**شاهد زنده‌ی تکمیلی (2026-08-24):** default ACL هنوز باز است (`anon=arwdDxtm/postgres` روی r). تریگر `reminder_outbox_enqueue` روی production فعاله ولی همه‌ی ردیف‌های جدید reminders با `is_sent=true` ساخته می‌شوند → تابع enqueue زود خارج می‌شود و جدول خالی می‌ماند؛ حفره‌ی دوبله‌شدن اعلان فقط پس از روشن‌شدن flag فعال می‌شد — migration دوم آن را با supersede-on-is_sent می‌بندد.

---

## ۱. مشکل چیست؟

دو مشکل مرتبط:

### الف) Default ACL هنوز «همه‌چیز» را به anon می‌دهد
وقتی در آینده هر جدول جدیدی در schema public ساخته شود، **به‌صورت خودکار** همه‌ی دسترسی‌ها — از جمله **TRUNCATE** — به role های `anon` و `authenticated` داده می‌شود. این دقیقاً همان الگویی است که قبلاً باگ امنیتی جدول `focus_sessions` (TRUNCATE برای anon) را ساخت. آن باگ فقط برای «همان یک جدول» فیکس شد؛ ریشه هنوز باز است.

### ب) فایل‌های migration دیگر منبع حقیقت نیستند
بین repo و production فاصله افتاده:
- تابع `claim_notification_messages` در production پارامتر چهارمی (`p_max_age_minutes`, default 180) دارد که در فایل migration نیست + یک guard ضدپیام‌های کهنه.
- حداقل ۶ migration روی production هست که هیچ فایلی در repo ندارد (canary override ها، staleness guard و...).
- نام/تاریخ خیلی از فایل‌ها با ورودی‌های زنده مطابقت ندارد.

یعنی اگر کسی محیط staging را از روی repo بسازد یا بر اساس فایل‌ها استدلال امنیتی کند، نتیجه‌اش غلط است.

## ۲. چطور کشف شد؟

subagent دسته‌ی DB هنگام مقایسه‌ی تعریف زنده‌ی توابع با فایل‌ها drift را دید؛ من هم default ACL را مستقل کوئری کردم:

```
select defaclacl from pg_default_acl ... →
"{postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres, ...}"
(arwdDxtm = همه‌ی privilege ها شامل D=TRUNCATE)
```

## ۳. اولویت حل

| # | اقدام | چرا |
|---|-------|-----|
| 1 | یک migration با `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;` | حفره‌ی ریشه را برای جدول‌های آینده می‌بندد — یک خط |
| 2 | sync کردن repo با production: فایل‌های جاافتاده را اضافه کن / یا مستند کن که production منبع حقیقت است تا زمان merge | جلوگیری از اشتباه در deploy های بعدی |
| 3 | قبل از روشن‌کردن flag `reminder_outbox_v2`: شاخه‌ی is_sent تریگر enqueue باید پیام pending را supersede/cancel کند | جلوگیری از اعلان مضاعف برای کاربر |

**توجه خاص:** مورد ۳ شرطی است — الان flag خاموش است و جدول notification خالی، پس عجله ندارد ولی قبل از rollout الزامی است.
