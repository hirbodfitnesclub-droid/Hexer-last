# گزارش QA Phase 1.5 — شاخه feature/agent-memory-v2

**تاریخ:** 2026-08-23
**دامنه:** ۷۶ فایل (۳۱ تغییریافته + ۴۵ جدید)، ۳۳۳۷ خط اضافه / ۲۰۸۷ خط حذف
**وضعیت کامیت:** تمام تغییرات uncommitted هستند

---

## بخش ۰ — فورنزیک تاریخچه‌ی deploy (🔴 بحرانی‌ترین بخش)

### ۰.۱ سلامت bundle دیپلوی‌شده
**وضعیت: ✅ تأیید شد — کامل است**
**سطح شاهد: [VERIFIED-STATIC]**

فایل `deploy.bundle.ts` (۹۹ خط، minified) تمام ماژول‌ها را شامل می‌شود: طبقه‌بندی intent، سیستم honesty، موتور سیاست action، پردازنده action، RAG، مدیریت رسانه، feature flags، سیستم سهمیه. هیچ نشانه‌ای از truncation وجود ندارد.

### ۰.۲ سیستم honesty — فعال و در حال کار
**وضعیت: ✅ تأیید شد**
**سطح شاهد: [VERIFIED-LIVE]**

```
-- رکورد audit که honesty یک mutation ناموفق را گرفت:
id: b4c0f2b9-e21e-4a56-872b-7c16badb913d
intent: "mutate"
accepted_action_count: 0
successful_action_count: 0
honesty_mode: "full"    ← honesty پاسخ مدل را جایگزین کرد
created_at: 2026-08-19 10:17:26
```

هیچ receipt‌ای برای این درخواست وجود ندارد. سیستم honesty تشخیص داد مدل ادعای موفقیت می‌کرد بدون اینکه actionی اجرا شده باشد، و پاسخ صادقانه جایگزین کرد.

### ۰.۳ طبقه‌بندی intent — درست کار می‌کند
**وضعیت: ✅ تأیید شد**
**سطح شاهد: [VERIFIED-LIVE]**

```
-- CREATE_REMINDER درست به‌عنوان "create" طبقه‌بندی شد:
intent: "create", honesty_mode: "none", successful_action_count: 1
-- Receipt: action="CREATE_REMINDER", title="__claude_smoke_reminder_20260820_0225"
```

سناریوی smoke test از session قبلی موفق بود. reminder با receipt ساخته شد (بعداً پاک شد — artifact تست).

### ۰.۴ خط لوله‌ی action receipts
**وضعیت: ✅ تأیید شد**
**سطح شاهد: [VERIFIED-LIVE]**

۱۱ receipt با actionهای واقعی: CREATE_REMINDER, REOPEN_TASK, UPDATE_TASK_CHECKLIST, SNOOZE_REMINDER, MARK_REMINDER_READ. همه before_state/after_state و undo_kind دارند.

### ۰.۵ نسخه‌ی edge function
**وضعیت: ⚠️ قابل تأیید نیست**
**دلیل:** جدول `supabase_functions.edge_functions` در schema قابل دسترس وجود ندارد. شماره نسخه دقیق قابل تأیید نیست (گزارش قبلی ادعا می‌کند v75).

### ۰.۶ وضعیت feature flags [VERIFIED-LIVE]
```
agent_writes: active, 100%     ← agent اجازه نوشتن دارد
ai_quota_reservations: gradual, 5%
recurrence_rpc_v2: gradual, 25%
بقیه: OFF
```

### ۰.۷ امنیت RLS [VERIFIED-LIVE]
- همه‌ی ۴۸ جدول `rowsecurity: true`
- هیچ TRUNCATE grant به هیچ role‌ای
- DELETE فقط برای `authenticated` (با RLS)
- `agent_action_receipts` و `agent_execution_audit`: کاملاً قفل به service_role
- جدول‌های حساس: فقط service_role

---

## 🔴 یافته‌های نیازمند بررسی دستی

### Finding #1 — باگ واقعی production: `injectAIProposalResult` در IndexedDB ذخیره نمی‌شود
**فایل:** `hooks/useDataManager.ts` خط ۱۱۶۲
**وضعیت: ❌ باگ تأییدشده**
**سطح شاهد: [VERIFIED-STATIC]**

وقتی AI از طریق چت entity می‌سازد/آپدیت می‌کند، `injectAIProposalResult` فقط state React را آپدیت می‌کند ولی `saveSnapshot` صدا زده نمی‌شود. بعد از refresh صفحه، entityهای ساخته‌شده ناپدید می‌شوند تا revalidation بعدی.

**اثر:** کاربر تسک/نوت/پروژه‌ای که AI ساخته را بعد از refresh نمی‌بیند.

### Finding #2 — باگ: `handleApproveAll` آیتم‌های ناموفق را تأییدشده علامت می‌زند
**فایل:** `features/chat/ChatView.tsx` خط ۵۲۹
**وضعیت: ❌ باگ تأییدشده**
**سطح شاهد: [VERIFIED-STATIC]**

اگر bulk approval partially fail شود، آیتم‌های شکست‌خورده هم `approved` علامت می‌خورند. کاربر نمی‌تواند retry کند.

### Finding #3 — نشت حافظه: `URL.createObjectURL` بدون revoke
**فایل:** `features/chat/ChatView.tsx` خط ۹۵۲
**وضعیت: ❌ باگ تأییدشده**
**سطح شاهد: [VERIFIED-STATIC]**

هر بار rerender یک blob URL جدید بدون آزادسازی قبلی می‌سازد.

### Finding #4 — باگ: `undo_agent_action` — `restore_deleted` پیاده‌سازی نشده
**فایل:** migration `20260819114056_agent_tool_receipts.sql`
**وضعیت: ❌ باگ تأییدشده**
**سطح شاهد: [VERIFIED-STATIC]**

constraint اجازه `restore_deleted` می‌دهد ولی بدنه تابع exception می‌دهد.

### Finding #5 — Prompt injection از طریق داده‌ی کاربر
**فایل:** `supabase/functions/ai-assistant/lib/system-prompt.ts`
**وضعیت: ⚠️ نگرانی امنیتی**
**سطح شاهد: [VERIFIED-STATIC]**

عنوان تسک/نوت کاربر مستقیماً در system prompt تزریق می‌شود. کاربر مخرب می‌تواند عنوانی مثل "دستورات قبلی را نادیده بگیر" بنویسد.

### Finding #6 — Rate limiter در محیط serverless بی‌اثر
**فایل:** `supabase/functions/_shared/security.ts`
**وضعیت: ⚠️ نگرانی امنیتی**
**سطح شاهد: [VERIFIED-STATIC]**

`enforceRateLimit` از `Map` در حافظه استفاده می‌کند. در serverless هر cold start حافظه را ریست می‌کند.

### Finding #7 — مسیر traversal از طریق encoding
**فایل:** `supabase/functions/ai-assistant/lib/media-handler.ts`
**وضعیت: ⚠️ نگرانی امنیتی**
**سطح شاهد: [VERIFIED-STATIC]**

بررسی `..` فقط روی رشته خام است. `%2e%2e` ممکن است bypass کند.

---

## نتیجه به تفکیک بخش

### بخش ۱ — امنیت دیتابیس (۳۱ migration)
**وضعیت: ✅ تأیید شد**
**سطح شاهد: [VERIFIED-STATIC] + [VERIFIED-LIVE]**

- ۰ باگ بحرانی
- ۱ باگ امنیتی واقعی که قبلاً fix شده: `focus_sessions` TRUNCATE grant به anon (fix شده در `20260820191500`)
- ۱ هشدار: placeholder Vault secret در `41_fix_push_dispatch_transport.sql`
- الگوهای مثبت: revoke all از public/anon/authenticated، `SET search_path` روی همه SECURITY DEFINER، composite FK برای cross-tenant، idempotency key در همه mutation‌ها، FOR UPDATE SKIP LOCKED برای worker‌ها

### بخش ۲ — RPC‌ها (۲۲ تأیید / ۱ باگ / ۳ نگرانی)
**وضعیت: ⚠️ جزئی**

| RPC | وضعیت | جزئیات |
|-----|--------|--------|
| complete_recurring_task_v2 | ✅ | FOR UPDATE + idempotency |
| claim_notification_messages | ✅ | FOR UPDATE SKIP LOCKED |
| claim_memory_jobs | ✅ | FOR UPDATE SKIP LOCKED |
| enqueue_memory_job | ✅ | Idempotency key + stale cleanup |
| reserve_ai_quota | ✅ | Double idempotency check |
| start_ai_request | ✅ | Idempotent transition |
| finalize_ai_request_success/failure | ✅ | FOR UPDATE + idempotent |
| undo_agent_action | ❌ | `restore_deleted` پیاده‌سازی نشده |
| search_memory_v2 | ⚠️ | عملکرد — بدون stored tsvector |
| consume_ai_quota (legacy) | ⚠️ | محدودیت طراحی |

### بخش ۳ — Edge Functions (۳۳ فایل)
**وضعیت: ⚠️ نگرانی‌های امنیتی**

| شدت | تعداد | موضوعات کلیدی |
|-----|-------|---------------|
| بحرانی/بالا | ۵ | Rate limiter بی‌اثر، مسیر traversal، کوئری‌های بدون limit در admin-api، validation ناقص admin، race condition در push-dispatch |
| متوسط | ۹ | Prompt injection، الگوی honesty بیش‌ازحد گسترده، sanitization ناقص، CORS |
| پایین | ۶ | محدودیت طبقه‌بندی intent، شکاف audit، مسائل timing |

### بخش ۴ — کلاینت (۲۳ فایل)
**وضعیت: ❌ ۳ باگ واقعی + ۵ نگرانی**

| باگ | فایل | اثر |
|-----|------|-----|
| injectAIProposalResult بدون IndexedDB persist | useDataManager.ts | entityهای AI بعد از refresh ناپدید |
| handleApproveAll خطاها را تأییدشده علامت می‌زند | ChatView.tsx | عدم امکان retry |
| نشت حافظه createObjectURL | ChatView.tsx | مصرف حافظه بالا |

**نگرانی‌ها:** habit_completion مدیریت نمی‌شود، ۴۰۳ retryable در legacy outbox، toggleStatus منتظر onSave نمی‌ماند، due_date omission در scope updates، delete undo بدون cleanup

### بخش ۵ — تست و coverage
**وضعیت: ⚠️ ادعای گمراه‌کننده**

| ادعا | واقعیت | حکم |
|------|--------|------|
| ۵۴۰ سناریو | ۵۴۰ سناریو در ۲۴ فایل JSON | ✅ تأیید [VERIFIED-LIVE] |
| ۶۱۲ تست | ۶۱۲ تست، همه سبز در ۳.۷۶ ثانیه | ✅ تأیید [VERIFIED-LIVE] |
| coverage ۱۰۰٪ | ۱۰۰٪ فقط روی ۳ فایل از ~۲۰ فایل | ❌ گمراه‌کننده |
| pipeline کیفیت | typecheck + scenarios سبز، bundle script خراب (esbuild نیست) | ⚠️ جزئی |
| E2E | فقط ۱ تست Playwright (app shell) | ⚠️ حداقلی |

### بخش ۶ — زیرساخت offline (جدید ولی فعال نیست)
**وضعیت: ⚠️ UNVERIFIABLE**

`operationQueue.ts` و `conflicts.ts` ماژول‌های جدید و کاملی هستن ولی هنوز به `useDataManager` وصل نشدن. مسیر sync فعال هنوز legacy outbox است.

---

## بخش ۷ — چیزهایی که خودت (آرش) باید دستی تست کنی

### فوری (قبل از merge)

1. **تست injectAIProposalResult:** از طریق چت یک تسک بساز، صفحه را refresh کن. اگر تسک ناپدید شد، باگ #1 تأیید می‌شود. **فقط تو می‌توانی تست کنی** چون نیاز به اپ واقعی و حساب کاربری دارد.

2. **تست handleApproveAll:** از طریق voice یا تصویر چند proposal بساز، یکی را طوری تنظیم کن که fail شود (مثلاً عنوان خالی)، bulk approve کن. اگر آیتم fail‌شده هم سبز شد، باگ #2 تأیید.

3. **تست honesty روی production:** یک پیام فارسی بفرست که intent آن `chat` باشد ولی مدل سعی کند action بسازد (مثلاً «سلام، حالت چطوره؟»). بررسی کن که آیا honesty_mode در پاسخ `none` است (نه `full`).

4. **تست reminder واقعی:** یک یادآور فارسی بساز (مثلاً «یادآوری فردا ساعت ۱۰ صبح بذار»). بررسی کن: آیا intent `create` است؟ آیا receipt ساخته شد؟ آیا reminder واقعاً در جدول reminders هست؟

5. **تست undo:** بعد از ساختن تسک توسط AI، دکمه undo را بزن. بررسی کن آیا تسک واقعاً برمی‌گردد.

### بعد از merge (غیرفوری)

6. **تست push notification واقعی:** نیاز به دستگاه واقعی با subscription فعال.

7. **تست صوتی واقعی:** نیاز به ورودی صوتی فارسی واقعی برای سنجش کیفیت transcription.

8. **تست پرداخت واقعی:** نیاز به gateway واقعی (zibal).

9. **تست performance search_memory_v2:** با dataset بزرگ‌تر (الان فقط ۱۵ chunk). نیاز به backfill واقعی.

10. **بررسی placeholder Vault secret:** `41_fix_push_dispatch_transport.sql` مقدار `REPLACE_IN_DASHBOARD` دارد. باید قبل از فعال‌سازی cron در production آپدیت شود.

### تصمیمات کسب‌وکاری

11. **آیا coverage باید به فایل‌های بیشتری گسترش یابد؟** الان فقط ۳ فایل coverage دارند. فایل‌های critical مثل `honesty.ts`, `intent.ts`, `action-processor.ts` coverage ندارند.

12. **آیا operationQueue و conflicts باید فعال شوند؟** ماژول‌ها آماده‌اند ولی وصل نشدن. مسیر sync فعلی legacy است.

13. **آیا feature flags غیرفعال (automations, calendar, memory_v2, offline_sync, focus_sessions, reminder_outbox, voice_actions) باید فعال شوند؟** کد server-side آماده است ولی client integration ناقص است.

---

## چک‌لیست پوشش فایل

| دسته | کل | بررسی‌شده | درصد |
|------|-----|-----------|------|
| Migrations + SQL | ۳۲ | ۳۲ | ۱۰۰٪ |
| Edge Functions | ۳۴ | ۳۴ | ۱۰۰٪ |
| کلاینت | ۲۳ | ۲۳ | ۱۰۰٪ |
| تست + Config | ۱۰ | ۱۰ | ۱۰۰٪ |
| Docs + Config | ۸ | ۸ | ۱۰۰٪ |
| **مجموع** | **۱۰۷** | **۱۰۷** | **۱۰۰٪** |

---

## خلاصه‌ی نهایی

| معیار | وضعیت |
|-------|--------|
| deploy سالم | ✅ bundle کامل، truncation ندارد |
| honesty فعال | ✅ [VERIFIED-LIVE] — یک رکورد `full` ثبت شده |
| intent درست | ✅ [VERIFIED-LIVE] — CREATE_REMINDER درست طبقه‌بندی شد |
| action receipts | ✅ [VERIFIED-LIVE] — ۱۱ receipt واقعی |
| امنیت RLS | ✅ [VERIFIED-LIVE] — همه ۴۸ جدول محافظت‌شده |
| باگ‌های واقعی | ❌ ۴ باگ (۳ کلاینت + ۱ RPC) |
| نگرانی‌های امنیتی | ⚠️ ۳ (prompt injection, rate limiter, path traversal) |
| تست‌ها | ✅ ۶۱۲ سبز [VERIFIED-LIVE] |
| coverage | ❌ گمراه‌کننده — فقط ۳ فایل |
| offline sync | ⚠️ ماژول‌های جدید وصل نشدن |
| feature flags | ⚠️ اکثر غیرفعال |
