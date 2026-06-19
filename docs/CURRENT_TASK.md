# 🎯 تسک جاری: فاز K — بازطراحی اصولیِ Offline-First (Idempotency + Auto-Sync + UX ظریف)

> **وضعیت کلی:** فاز J به‌طور کامل پیاده‌سازی، اعتبارسنجی و کامپایل شده است (✅). اکنون واردِ **فاز K** می‌شویم تا یک باگِ ساختاریِ یکپارچگیِ داده (ساختِ رکوردِ تکراری در سرور پس از سینکِ آفلاین) و یک تجربه‌ی کاربریِ مزاحم (بنرِ ثابت + دکمه‌ی همگام‌سازیِ دستی) را به‌صورت ریشه‌ای درمان کنیم.
>
> **این یک چسب‌زخم نیست؛ ارتقای معماری از at-least-once به effectively-once است.** مرجعِ کامل: `docs/PROJECT.md` فاز K و `docs/ARCHITECTURE.md` §۱۴.

---

## 🧠 جوهر راه‌حل (تفهیمِ کدنویس — قبل از هر کاری بخوان)
سه ریشه‌ی واقعی (مستخرج از خواندنِ خط‌به‌خط کد):
1. **قفلِ غیراتمیک:** در `hooks/useOfflineSync.ts`، گاردِ `syncInProgressRef.current` پیش از `await getSession()` چک می‌شود ولی قفل پس از آن ست می‌شود → دو فلاشِ هم‌زمان همان op را دوبار می‌فرستند.
2. **صفر idempotency سرور:** همه‌ی createها id را سرور می‌سازد (`gen_random_uuid()`)؛ هیچ کلیدِ dedup نیست.
3. **طرحِ `temp-`+`Date.now()`:** id موقت ≠ id سرور → `remapTempId` شکننده + collision + کپیِ دومِ Realtime.

**درمان (ساده، مدرن، اصولی):** گوشی پیش از ارسال یک **UUID v4** می‌سازد و آن را به‌عنوانِ کلید اصلیِ واقعی به سرور می‌دهد؛ سرور با `ON CONFLICT (id) DO NOTHING` تکراری را خنثی می‌کند. توگلِ عادت به **SET مطلق** تبدیل می‌شود. قفل اتمیک. بنر/دکمه حذف و جایش Auto-Sync + Toastِ گذرا.

---

## 🌲 درختِ تمرکزِ فیزیکی (Focus Files) — به‌ترتیبِ تسک
**ابتدا K1 را کامل کن، سپس K2 → K3 → K4 → K5 (سری).**

- **K1 (پایه):** `utils/uuid.ts` *(جدید)*، `supabase/sql/47_offline_idempotency.sql` *(جدید)*، `services/taskService.ts`، `services/noteService.ts`، `services/projectService.ts`، `services/habitService.ts`، `services/offline/outbox.ts`.
- **K2 (مسیرِ نوشتن):** `hooks/useDataManager.ts`.
- **K3 (موتورِ سینک):** `hooks/useOfflineSync.ts`.
- **K4 (UX):** `components/NetworkBanner.tsx`، `components/ui/ToastNotifications.tsx`، `App.tsx`.
- **K5 (تست):** بدونِ کد؛ چک‌لیستِ پایان‌به‌پایان.

---

## 📋 شرحِ تسکِ جاری (شروع: K1)
**تسک K1 — پایه: تولیدِ id کلاینت + idempotency سرور + قراردادِ outbox.**
1. `utils/uuid.ts` با `newId()` (ترجیحِ `crypto.randomUUID()`، fallbackِ بومی با `crypto.getRandomValues`).
2. `supabase/sql/47_offline_idempotency.sql`: بازتعریفِ `create_task_with_tags`/`create_note_with_tags` با `p_id UUID DEFAULT NULL` + `ON CONFLICT (id) DO NOTHING RETURNING *` + fallbackِ `SELECT` در صورتِ تعارض.
3. سرویس‌ها: `taskService.createTask`/`noteService.createNote` پارامترِ `p_id` بفرستند؛ `projectService.createProject`/`habitService.createHabit` به `.upsert(..., { onConflict:'id', ignoreDuplicates:true })` سوییچ کنند؛ افزودنِ `habitService.setHabitCompletion(habitId,date,completed)` (و حفظِ `toggleHabitCompletion` به‌عنوانِ legacy).
4. `outbox.ts`: گسترشِ `Mutation.action` به‌علاوه‌ی `'set_completion'` (و نگه‌داشتنِ `'toggle'` برای legacy).

> جزئیاتِ کامل و راهنمای فنیِ هر تسک در `docs/tasks.md` فاز K آمده است.

---

## 🚫 لیست حیاتی نبایدها (Anti-Patterns فاز K)
کدنویس باید قطعاً این قوانین را رعایت کند (شرحِ کامل در `docs/PROJECT.md` §K.۶، بندهای ۷۹–۸۶):
* **§۸۱:** تولیدِ id با `Date.now()`/`Math.random()`/شمارنده ممنوع؛ فقط `newId()`.
* **§۸۳:** insertِ غیرایدمپوتنت ممنوع؛ هر ساخت باید `ON CONFLICT … DO NOTHING` داشته باشد. ساختِ جدولِ idempotency-key جداگانه ممنوع (اور-انجینیرینگ).
* **§۸۲:** صف‌کردنِ `action:'toggle'` ممنوع؛ فقط `set_completion` با وضعیتِ مطلق.
* **§۸۴:** پارامترِ جدیدِ RPC باید `DEFAULT NULL` باشد (نشکستنِ فراخوانیِ Edge Functionِ AI). تغییرِ ترتیب/نامِ پارامترهای قبلی ممنوع.
* **§۷۹ و §۸۰:** بازگرداندنِ دکمه‌ی همگام‌سازیِ دستی یا بنرِ `fixed` دائمی ممنوع؛ هیچ `flushOutbox` از کلیکِ کاربر.
* **§۸۵:** حذفِ `remapTempId`/store `failed` ممنوع (سازگاریِ عقب‌روِ آیتم‌های در صف‌ماندهٔ کاربرانِ فعال).
* **§۸۶:** Toastِ آفلاین باید `type:'info'` (خنثی، خوددِفع‌شونده) باشد، نه `'error'`.

---

## 🧪 معیارِ پذیرش نهایی (معادلِ تسک K5)
1. **صفر رکوردِ تکراری** در سرور تحتِ همه‌ی سناریوها (Race، از-دست-رفتنِ ack، رفرشِ پیاپی).
2. توگلِ عادت ایدمپوتنت (سینکِ دوباره وضعیت را خراب نکند).
3. **کپیِ دومِ بصریِ Realtime ناپدید شود** (id کلاینت == id سرور).
4. UX: فقط Toastِ گذرای آفلاین + Toastِ موفقیتِ خودکار؛ **هیچ کلیکِ دستی**؛ بدونِ بنرِ چسبیده.
5. فراخوانیِ AI (RPC با `p_id=NULL`) و آیتم‌های `temp-`ـیِ legacy بدونِ خطا flush شوند.
6. پروژه با `compile_applet` ۱۰۰٪ کامپایل شود؛ هر خطا بلافاصله برطرف گردد.
