# گزارش نهایی QA — Phase 1.6 (تجمیع کامل)

**تاریخ:** 2026-08-23
**دامنه:** هر ۱۶۰ فایل دیف بررسی شد — ۵ subagent مستقل + ممیزی main session + راستی‌آزمایی زنده
**مرز production:** رعایت کامل — صفر write دائمی؛ همه‌ی پروب‌های DB داخل begin/rollback

---

## ۱. خلاصه در یک پاراگراف

باندل deployed سالم است (v75 بایت‌به‌بایت با repo یکسان)، زیرساخت‌های سرور (outbox، memory jobs، پرداخت، flags، RLS) در عمق تست‌ها سالم بیرون آمدند — ولی **باگ اصلی honesty/intent نه‌تنها زنده بلکه در حال تشدید است**: حداقل ۵ حادثه در production، از جمله امروز که کاربر واقعی به ربات گفت «چرا الکی میگی هیچ تسکی ساخته نشده که». علاوه بر آن، یک پسورد DB هاردکد در git history، default ACL باز برای جدول‌های آینده، و کل زیرساخت CI/TDD که هنوز commit نشده، مهم‌ترین موارد باقی‌مانده‌اند.

---

## ۲. 🔴 یافته‌های نیازمند تصمیم/بررسی دستی آرش (به ترتیب اولویت)

| # | عنوان | شدت | سند |
|---|-------|-----|-----|
| 1 | ربات به کاربر دروغ می‌گوید (honesty/intent) — ۵ حادثه، آخرین: امروز 09:26 با شکایت صریح کاربر | 🔴 فوری | [ISSUE_01](QA_ISSUE_01_honesty_false_success.md) |
| 2 | پسورد DB هاردکد در دو فایل tracked (پل FDW پروژه‌ی landing) — rotate لازم | 🔴 | [ISSUE_02](QA_ISSUE_02_hardcoded_db_password.md) |
| 3 | Default ACL باز (TRUNCATE به anon برای جدول‌های جدید) + drift migration files ↔ production | ⚠️ | [ISSUE_03](QA_ISSUE_03_default_acl_and_drift.md) |
| 4 | باگ‌های کلاینت: approve-all گم کردن پیش‌نویس، persist نشدن نتایج AI، نشت URL، offline sync مرده، due_date scope | 🔴/⚠️ | [ISSUE_04](QA_ISSUE_04_client_bugs.md) |
| 5 | زیرساخت تست/CI: اعداد صادقانه ولی هیچ gate ای واقعاً اجرا نمی‌شود؛ coverage ۱۰۰٪ = ۷۰ خط منتخب | ⚠️ | [ISSUE_05](QA_ISSUE_05_test_infrastructure.md) |
| 6 | Edge functions: sms-hook fail-open احتمالی، rate limiter بی‌اثر، admin-api بدون limit، push legacy دوبله | ⚠️ | [ISSUE_06](QA_ISSUE_06_edge_functions.md) |

**PII:** شماره موبایل کامل داخل `docs/cursor-session-log.md` — قبل از merge یا redact شود یا به .gitignore برود.

---

## ۳. وضعیت ادعاهای گزارش قبلی (docs/QA_REPORT_2026-08-20)

| ادعا | حکم نهایی |
|------|-----------|
| ai-assistant v75 ACTIVE و سالم (بدون truncation) | ✅ CONFIRMED [LIVE — byte-compare 20/20] |
| honesty enforcement فعال | ❌ فقط برای intent صحیح — حفره‌ی chat باز و فعال [LIVE ×۵ حادثه] |
| intent classification درست | ❌ جمله‌های طبیعی محاوره‌ای («تسک دارم»، «تسک بزن») → chat [LIVE repro] |
| ۱۹ action پیاده‌شده با ownership/receipt/undo | ✅ CONFIRMED — resolveOwned دو لایه، undo_kind ها منطبق با undo_agent_action |
| recurrence RPC ها (complete/skip/edit/stop) | ✅ نسخه‌های fixed زنده هستند (anchorRewritten, adopt-series probes true) |
| outbox/memory RPCs (idempotent, lease, SKIP LOCKED) | ✅ CONFIRMED [LIVE rollback probes] |
| search_memory_v2 isolation | ✅ بدون نشتی بین کاربران [LIVE]؛ latency ~2ms @11 chunks (غیرقابل‌تعمیم) |
| focus_sessions TRUNCATE fix | ✅ صفر TRUNCATE grant [LIVE] — ولی ریشه (default ACL) هنوز باز |
| ۵۴۰ سناریو / ۶۱۲ تست سبز | ✅ CONFIRMED [LIVE rerun] |
| coverage ۱۰۰٪ | ⚠️ گمراه‌کننده — ۷۰ خط از ۳ فایل منتخب؛ threshold واقعی 70/70/60/70 |
| zibal امن (قیمت/verify سرورسمت) | ✅ CONFIRMED — سه چک متقاطع، double-spend بسته |
| feature flags fail-closed | ✅ CONFIRMED |
| media path traversal (%2e%2e) | ❌ CONTRADICTED — قبلاً fix شده |
| prompt injection از داده‌ی کاربر | ⚠️ سطح واقعی: هزینه/کیفیت (مهار write سه‌لایه است)، نه نفوذ عملیاتی |
| cron ها و rollout flags | ✅ مطابق (+ cron چهارم ثبت‌نشده mkt_refresh کشف شد) |

---

## ۴. پوشش فایل (نهایی)

| دسته | فایل‌ها | بررسی | توسط |
|------|---------|-------|------|
| Migration/RPC | ۳۲ | ۳۲/۳۲ FULL | db-security-qa + ممیزی |
| Edge Functions | ۳۳ | ۳۳/۳۳ FULL | edge-functions-qa |
| Client | ۲۳ | ۲۳/۲۳ FULL | client-integration-qa + ممیزی |
| Test/Coverage | ۵۹ | ۵۹/۵۹ | test-coverage-qa |
| Docs/Config | ۱۳(+۱) | ۱۴/۱۴ (session-log عمداً partial/grep-based) | docs-config-qa |
| هسته‌ی agent (main session) | ۵ | FULL + repro زنده | phase 1.6 بخش ۰ |
| **جمع** | **~۱۶۰** | **۱۰۰٪** (با جزئیات partial اعلام‌شده) | |

جزئیات partial: cursor-session-log فقط grep الگویی (طبق دستور)، چند سناریوی JSON نمونه‌گیری‌شده (همگی اجرا شدند). هیچ فایلی کاملاً خارج از بررسی نماند.

---

## ۵. بخش ۷ — چیزهایی که آراش باید خودش تست کند

### فوری (قبل/همراه فیکس ISSUE_01)
1. **Deploy فیکس honesty** بعد از تأیید تو — تنها راه تأیید end-to-end با LLM واقعی. بعد از deploy: همان جمله‌ی «یه تسک بزن برای فردا ...» را خودت بفرست و audit را چک کن.
2. **Rotate پسورد landing** (ISSUE_02) — فقط تو به dashboard پروژه‌ی landing دسترسی داری.
3. **تصمیم PII session-log** قبل از merge: redact یا .gitignore.

### غیرفوری
4. تست undo واقعی از UI (receipt ها ۱۵ دقیقه expiry دارند).
5. push notification روی دستگاه واقعی، OTP/SMS واقعی، پرداخت zibal واقعی.
6. کیفیت پاسخ فارسی و UX confirmation — قضاوت کسب‌وکاری.
7. latency واقعی search_memory_v2 بعد از backfill کامل.
8. تنظیم بودن SEND_SMS_HOOK_SECRET در production env (از dashboard قابل دیدن است).

### تصمیمات محصولی
9. operationQueue v2: وصل کنیم یا فعلاً حذف؟ (اعتماد کاذب نسازد)
10. ترتیب روشن‌کردن flag های خاموش — قبل از reminder_outbox_v2 حتماً فیکس supersede (ISSUE_03 مورد ۳).

---

## ۶. سند اصلاحی‌های قابل‌اجرا

همه در `docs/QA_ISSUE_01..06_*.md` با فرمت یکسان: مشکل → مسیر کشف → ریشه → اقدام اولویت‌دار. این‌ها لیست work فیکس بعد از تأیید تو هستند.

## ۷. چک‌لیست پوشش

`QA_COVERAGE_CHECKLIST.md` — همه‌ی ۱۶۰ مدخل REVIEWED شدند.
