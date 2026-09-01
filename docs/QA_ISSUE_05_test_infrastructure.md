# 🐛 پیشنویس مورد اصلاحی ۰۵ — زیرساخت تست/CI: اعداد صادقانه، گیت‌های توخالی

**تاریخ ثبت:** 2026-08-23
**شدت:** ⚠️ متوسط (ریسک رگرسیون آینده، نه حادثه‌ی فعال)
**وضعیت:** برای تصمیم آرش هنگام merge
**کشف:** subagent test-coverage-qa؛ بازتأیید مستقل main session (tc-2)

---

## چیزهایی که راست بودند ✅

- **۵۴۰ سناریو در ۲۴ manifest — واقعی.** اجرای زنده‌ی validator تأیید کرد.
- **۶۱۲ تست، همه سبز — واقعی.** اجرای مجدد: `Test Files 25 passed, Tests 612 passed`.
- سناریوها assertion واقعی دارند (نه smoke خالی).
- bundle تولیدی deterministic است (sha1 یکسان در دو اجرا).

## مشکلات

### ۱. «Coverage ۱۰۰٪» فقط ۷۰ خط از ۳ فایل منتخب است
`vitest.config.ts` coverage را فقط روی model-registry/media-contract/request-contract محاسبه می‌کند (۷۰ خط کل). حدود ~۲۷۰۰ خط دیگر edge functions + کل فرانت‌اند خارج از محاسبه‌اند. Threshold واقعی هم 70/70/60/70 است نه 100.

### ۲. هیچ‌کدام از این زیرساخت commit نشده — CI وجود ندارد [بازتأیید مستقل ✅]
```
git ls-tree -r origin/main | grep -E "tests/|vitest|quality.yml" → 0 فایل
git status → ?? .github/workflows/quality.yml, ?? tests/, ?? vitest.config.ts, ...
```
یعنی quality.yml هرگز trigger نمی‌شود چون روی origin/main وجود ندارد. «CI داریم» فعلاً ادعایی روی دیسک محلی است.

### ۳. edge functions از typecheck مستثنی‌اند
`tsconfig.app.json` خط ۲۸: `exclude: ["supabase/functions/**"]`. یعنی خطای نوع در action-processor/security.ts نه typecheck می‌گیرد نه CI — فقط runtime production.

### ۴. action-processor.ts (~۳۰۰ خط، سطح نوشتن داده) صفر تست دارد
به‌خاطر import مستقیم esm.sh قابل load در vitest نیست؛ با تزریق client ساختگی قابل تست است. هر رگرسیون اینجا یعنی خرابی داده‌ی واقعی کاربر.

### ۵. موارد جزئی‌تر
- validate-scenarios فقط schema-lint است، رفتار اجرا نمی‌کند
- CI گام bundle-validation ندارد (سناریوی truncation قبلی در CI قابل تکرار است)
- recurrence-cutover.test.ts کپیِ دستی منطق سرویس واقعی را تست می‌کند (mutation escape)
- `"@supabase/supabase-js": "latest"` شناور در package.json

## اولویت پیشنهادی
1. هنگام merge: همه‌ی زیرساخت تست + quality.yml را commit کن تا gate واقعاً فعال شود
2. گام bundle validation به quality.yml اضافه شود
3. tsconfig جداگانه برای supabase/functions که در typecheck بیاید
4. تست برای action-processor با client ساختگی (بالاترین ارزش تستی باقی‌مانده)
5. پوشش coverage به فایل‌های هسته گسترش یابد و عدد واقعی گزارش شود
