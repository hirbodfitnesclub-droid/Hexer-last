

# فاز J — نقشه‌ی راهِ مرجع (حریم امن سراسری، BottomNav، فاصله‌گذاری مودال/کشو)

> مرجعِ کامل: `docs/ARCHITECTURE.md` §۱۳ و `docs/PROJECT.md` فاز J. هدف: رفعِ ریشه‌ایِ حبس‌شدنِ دکمه‌ها/محتوا پشتِ BottomNav و Home Indicator، با یک لایه‌ی ابزارِ مرکزی — **بدونِ وصله‌ی تک‌تکِ مودال‌ها**.
> **نکته‌ی تفهیمِ کدنویس:** «حریم امن» یعنی نواحیِ لبه‌ی صفحه (بالا = ناچ/داینامیک‌آیلند، پایین = نوارِ ژستی گوشی) که سیستم‌عامل رویشان چیز می‌کشد. مرورگر این فاصله‌ها را با تابعِ `env(safe-area-inset-top/bottom)` می‌دهد. ما این فاصله‌ها را در `index.css` به چند کلاسِ آماده تبدیل می‌کنیم و فقط همان کلاس‌ها را در نقاطِ درست می‌چسبانیم.

## محدودیت‌های سراسریِ فاز J (روی همه‌ی تسک‌ها)
- **هیچ `tailwind.config`/PostCSS/پلاگین اضافه نمی‌شود** (Anti §۸۰). تنها فایلِ «تعریف»، `index.css` است.
- **هیچ عددِ جادویی** برای فاصله‌ی نوار (`pb-24`/`pb-32`/`pb-20`) و **هیچ افستِ سخت‌کد** برای اندیکیتور (Anti §۷۸/§۸۳). همه از `env(...)` و توکنِ `--bottom-nav-space` مشتق شوند.
- **قراردادِ ضدِّ کیبوردِ مجازی دست‌نخورده:** `h-[100dvh]`/`max-h-[100dvh]`/`min-h-0` و سلسله‌مراتبِ `z-index` (§۷.۲) تغییر نمی‌کنند؛ فقط `padding`/`bottom`/ارتفاعِ نوار اضافه می‌شود (Anti §۸۱).
- `env(safe-area-inset-*, 0px)` همیشه با fallbackِ `0px` نوشته شود تا روی دستگاه‌های بدونِ notch صفر شود (بدون رگرسیون).

## ترتیبِ اجرا (وابستگی‌ها)
**J1 (پایه — اول و تنها)** → سپس **J2 ∥ J3 ∥ J4 ∥ J5 ∥ J6** (روی فایل‌های مجزا، قابلِ موازی‌شدن پس از J1) → **J7 (تستِ نهایی)**.
> J1 منبعِ واحدِ ابزارهاست؛ بدونِ آن بقیه بی‌اثرند. هیچ فایلی در دو تسک تکرار نشده (نقشه‌ی تداخل: §۱۳.و).

---

## تسک J1 — لایه‌ی ابزارِ حریم امن در `index.css` (پایه‌ی سراسری)
**راهنمای پیاده‌سازیِ فنی:**
1. در `index.css`، به بلاکِ `:root`ِ موجود توکنِ `--bottom-nav-space: 5rem;` را اضافه کن.
2. دقیقاً چهار کلاسِ زیر را (با `!important` و fallbackِ `0px`) مطابقِ §۱۳.الفِ ARCHITECTURE اضافه کن: `.pt-safe` (`calc(env(safe-area-inset-top,0px)+2rem)`), `.pb-safe` (`calc(env(safe-area-inset-bottom,0px)+1rem)`), `.pb-safe-content` (`calc(env(safe-area-inset-bottom,0px)+1.5rem)`), `.pb-bottom-nav` (`calc(var(--bottom-nav-space)+env(safe-area-inset-bottom,0px)+0.5rem)`).
3. این کلاس‌ها را در انتهای فایل (بعد از قوانینِ Tailwindِ تزریقی) قرار بده تا در آبشار برنده شوند؛ `!important` مصونیتِ مضاعف می‌دهد.
**محدودیت‌های اختصاصیِ تسک:** فقط `index.css`. هیچ کلاسِ دیگری دست‌کاری/حذف نشود. مقادیرِ پایه (۲rem/۱rem) عمداً معادلِ پدینگِ فعلیِ هدر/فوترند تا روی دستگاه بدونِ notch رگرسیونِ بصری ندهند. این تسک به‌تنهایی، ۶ هدر و footerِ `SubscriptionModal` را که امروز no-op دارند فعال می‌کند.
CONTEXT_FILES: ["index.css", "index.html", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک J2 — اصلاح `BottomNav` برای احترام به Home Indicator
**راهنمای پیاده‌سازیِ فنی:**
1. ظرفِ بیرونی (خط ۲۸، `fixed bottom-0 ... h-20 ... z-50`): ارتفاع `h-20` را به `h-[calc(5rem+env(safe-area-inset-bottom,0px))]` تغییر بده.
2. بارِ شناورِ داخلی (خط ۳۰، `absolute bottom-4 ... h-16`): افستِ `bottom-4` را به `bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]` تغییر بده.
3. **[حیاتی — گاردِ pointer-events، پذیرفته از ممیزیِ کدنویس]** برای این‌که ظرفِ تمام‌عرضِ نوار، لمسِ محتوای زیرین را نبلعد: به ظرفِ بیرونی (خط ۲۸) `pointer-events-none` بده؛ به پیلِ ناوبری (خط ۳۰) و به ظرفِ دکمه‌ی مرکزیِ چت (خط ۵۸) `pointer-events-auto` بده.
4. سایرِ کلاس‌ها (`z-50`, `max-w-lg`, گریدِ ۵‌ستونی، دکمه‌ی مرکزیِ شناور) دست‌نخورده بمانند.
**محدودیت‌های اختصاصیِ تسک:** فقط `components/BottomNav.tsx`. مقدارِ ارتفاعِ پایه (۵rem) باید با توکنِ `--bottom-nav-space` در J1 هم‌خوان بماند؛ آن را تغییر نده. منطقِ ناوبری/آیکن‌ها لمس نشود. گاردِ pointer-events الزامی است (وگرنه افزایشِ ارتفاع یک ناحیه‌ی مرده‌ی لمسیِ بزرگ‌تر می‌سازد).
CONTEXT_FILES: ["components/BottomNav.tsx", "App.tsx", "index.css", "docs/ARCHITECTURE.md"]

## تسک J3 — مالکِ واحدِ فاصله‌ی نوار در پوسته‌ی اپ (`App.tsx`)
**راهنمای پیاده‌سازیِ فنی:** در `App.tsx` خط ۳۱۲، روی `<main id="view-viewport">` کلاسِ `pb-24` را با `pb-bottom-nav` جایگزین کن. بقیه‌ی کلاس‌ها (`flex-1 overflow-y-auto overflow-x-hidden`) دست‌نخورده.
**محدودیت‌های اختصاصیِ تسک:** فقط `App.tsx`. ساختارِ پوسته (`relative flex flex-col h-[100dvh]`) و چینشِ مودال‌های سراسری تغییر نکند. این تغییر، `main` را به تنها منبعِ فاصله‌ی نوار تبدیل می‌کند؛ پس J4 پدینگِ زائدِ ویوها را حذف می‌کند (وابستگیِ مفهومی، نه فایلی).
CONTEXT_FILES: ["App.tsx", "index.css", "docs/ARCHITECTURE.md"]

## تسک J4 — حذفِ Double-Padding و اصلاحِ FABها در ویوهای صفحه‌ای
**راهنمای پیاده‌سازیِ فنی:**
1. `features/dashboard/Dashboard.tsx` (خط ۴۵): ریشه‌ی `pb-24` → حذفِ کلاس (یا `pb-2` صرفاً نفس‌کشی)؛ چون `main` اکنون مالکِ فاصله است.
2. `features/tasks/TasksView.tsx`: اسکرولِ داخلی (خط ۱۹۴) `pb-32` → `pb-4`. FAB (خط ۳۲۷) `fixed bottom-24` → `bottom-[calc(var(--bottom-nav-space)+env(safe-area-inset-bottom,0px))]`.
3. `features/notes/NotesView.tsx`: ریشه (خط ۵۳) `pb-32` → حذف. FAB (خط ۱۱۱) مانندِ بند ۲.
4. `features/projects/ProjectsView.tsx`: ریشه (خط ۶۱) `pb-32` → حذف. **و** چون این فایل modalِ اینلاینِ ساختِ پروژه را هم دارد، footerِ آن modal (خط ۱۹۰، `p-5 border-t ... shrink-0`) کلاسِ `pb-safe` بگیرد و هدرش (خط ۱۲۸) `pt-safe`.
**محدودیت‌های اختصاصیِ تسک:** فقط همین چهار فایل. هدرهای `pt-safe`ِ موجود را دست نزن (با J1 خودکار فعال شده‌اند). هیچ عددِ جادوییِ جدید اضافه نشود. `ProjectsView` کاملاً اینجا تمام می‌شود (در J5 تکرار نشود — Anti تداخل).
CONTEXT_FILES: ["features/dashboard/Dashboard.tsx", "features/tasks/TasksView.tsx", "features/notes/NotesView.tsx", "features/projects/ProjectsView.tsx", "index.css", "docs/ARCHITECTURE.md"]

## تسک J5 — قراردادِ حریم امن روی مودال‌های مستقل
**راهنمای پیاده‌سازیِ فنی:** برای هر مودال، هدرِ شیت `pt-safe` و انتهای آن طبق نوعش:
1. `features/tasks/components/TaskEditorModal.tsx`: هدر (خط ۳۰۳) `pt-safe`؛ footerِ ثابت (خط ۶۳۰) `pb-safe`؛ از اسکرول (خط ۳۲۲) `pb-24` حذف شود (footer جداست).
2. `features/notes/components/NoteEditorModal.tsx`: هدر (خط ۱۸۴) `pt-safe`؛ footerِ متادیتا (خط ۲۳۵) `pb-20` موبایل → `pb-safe`.
3. `features/habits/components/HabitManagerModal.tsx`: هدر (خط ۹۷) `pt-safe`؛ اسکرول (خط ۱۱۵، که `HabitForm` و دکمه‌های submit/cancelِ آن داخلش‌اند) `pb-safe-content`. **توجه:** `HabitEditorModal` (هر دو مسیر) مرده است و در اسکوپ نیست — به آن دست نزن.
4. `features/projects/components/ProjectDetailsModal.tsx`: هدر (خط ۸۸) `pt-safe`؛ اسکرول (خط ۱۱۶) `pb-safe-content`.
**محدودیت‌های اختصاصیِ تسک:** فقط همین چهار فایلِ زنده. `h-[100dvh]`/`min-h-0`/`z-index` دست‌نخورده. تمایزِ دو حالت را رعایت کن: footerِ ثابت (خواهرِ `shrink-0`) → `pb-safe`؛ دکمه‌های داخلِ اسکرول → `pb-safe-content` روی همان ناحیه‌ی اسکرول (که در این پروژه بلاک است و امن؛ گاردِ §۱۳.د). `HabitForm` نیازی به ویرایش ندارد چون پدینگِ اسکرولِ والد (HabitManager) فضای زیرِ دکمه‌هایش را تأمین می‌کند.
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/notes/components/NoteEditorModal.tsx", "features/habits/components/HabitManagerModal.tsx", "features/habits/components/HabitForm.tsx", "features/projects/components/ProjectDetailsModal.tsx", "index.css", "docs/ARCHITECTURE.md"]

## تسک J6 — اورلی‌های تمام‌صفحه، کشو و اشتراک
**راهنمای پیاده‌سازیِ فنی:**
1. `features/billing/components/SubscriptionModal.tsx`: footer (خط ۳۱۲) از قبل `pb-safe` دارد و با J1 فعال می‌شود — فقط **تأیید** کن که درست رندر می‌شود؛ تغییری لازم نیست مگر هدر نیاز به `pt-safe` داشته باشد (خط ۱۲۶).
2. `features/chat/components/ChatHistoryDrawer.tsx`: ناحیه‌ی اسکرولِ پنل (خط ۶۲، `p-4 overflow-y-auto flex-1`) → افزودنِ `pb-safe-content`.
3. `components/PaywallModal.tsx`: اورلیِ تمام‌صفحه‌ی اسکرول‌شونده (خط ۱۰۹) — به wrapperِ اسکرول `pt-safe` و به انتهای محتوا (خط ۱۱۵ inner، که `pb-8` دارد) `pb-safe-content` بده تا CTA پشتِ اندیکیتور نرود.
4. `components/ProfileModal.tsx`: مودالِ مرکزی (`max-h-[85vh]`)؛ به ناحیه‌ی اسکرول (خط ۱۷۱، `overflow-y-auto flex-1`) برای اطمینان `pb-safe-content` بده.
5. **اختیاری (DRY):** `WeeklyReportModal.tsx:156` و `Onboarding.tsx:66-69` که env() را به‌صورت موضعی درست کرده‌اند، می‌توانند به کلاس‌های مرکزی (`pb-safe-content`/`pt-safe`) مهاجرت کنند؛ غیرضروری ولی تمیزتر.
**محدودیت‌های اختصاصیِ تسک:** فقط فایل‌های فهرست‌شده. `z-index`ها و چینشِ مرکزی/تمام‌صفحه دست‌نخورده. هیچ عددِ جادویی اضافه نشود.
CONTEXT_FILES: ["features/billing/components/SubscriptionModal.tsx", "features/chat/components/ChatHistoryDrawer.tsx", "components/PaywallModal.tsx", "components/ProfileModal.tsx", "features/dashboard/components/WeeklyReportModal.tsx", "features/onboarding/Onboarding.tsx", "index.css"]

## تسک J7 — تستِ یکپارچه‌ی پایان‌به‌پایان (دستی، چک‌لیست)
**راهنمای پیاده‌سازیِ فنی:** روی شبیه‌سازِ آیفونِ دارای Dynamic Island (مثلاً iPhone 15 Pro) و یک اندرویدِ ژستی، و نیز یک دستگاهِ بدونِ notch: (الف) در `TaskEditorModal` تا انتها اسکرول کن — دکمه‌ی «ذخیره» کاملاً بالای اندیکیتور و قابلِ‌کلیک باشد؛ (ب) همین برای `HabitManagerModal` (که `HabitForm` و دکمه‌هایش داخلِ اسکرول‌اند)/`ProjectDetailsModal`؛ (ب۲) **گاردِ لمسیِ نوار:** در صفحاتِ زیرین، روی فضاهای کناریِ پایینِ صفحه (بیرونِ پیلِ مرکزی) تپ کن و مطمئن شو لمس به محتوای زیرین می‌رسد (نه بلاک)؛ (ج) `SubscriptionModal`/`PaywallModal` CTA بالای اندیکیتور؛ (د) `ChatHistoryDrawer` آخرین آیتم دیده شود؛ (هـ) در همه‌ی صفحات (Dashboard/Tasks/Notes/Projects/Chat) آخرین محتوا بالای BottomNav بماند و BottomNav روی اندیکیتور نیفتد؛ (و) هدرها زیرِ ناچ نروند؛ (ز) **رگرسیون‌نبودن روی دستگاه بدونِ notch** (پدینگ‌ها معادلِ قبل)؛ (ح) باز/بسته‌شدنِ کیبوردِ مجازی هنوز footer را حفظ کند (قراردادِ `dvh`). نتایج در `docs/CURRENT_TASK.md` ثبت شود.
**محدودیت‌های اختصاصیِ تسک:** بدونِ کدِ جدید؛ فقط راستی‌آزمایی. هر رگرسیون = بازگشت به تسکِ مربوطه (J1–J6).
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md"]


---
---

# فاز K — نقشه‌ی راهِ مرجع (Offline-First: Idempotency, Auto-Sync, UX ظریف)

> مرجعِ کامل: `docs/ARCHITECTURE.md` §۱۴ و `docs/PROJECT.md` فاز K. هدف: درمانِ ریشه‌ایِ تولیدِ رکوردِ تکراری پس از سینکِ آفلاین (Idempotency) و حذفِ بنرِ ثابت + دکمه‌ی دستی به‌نفعِ Auto-Sync + Toastِ گذرا — **بدونِ اور-انجینیرینگ و بدونِ کتابخانه‌ی جدید**.
> **نکته‌ی تفهیمِ کدنویس:** «Idempotency» یعنی هر عملیات را هر چند بار که تکرار کنی، نتیجه‌ی نهایی یکی باشد. کلیدِ راه‌حل این است: به‌جای این‌که سرور برای هر «ساخت» یک شناسه‌ی تصادفی بسازد، **خودِ گوشی پیش از ارسال یک شناسه‌ی یکتا (UUID) می‌سازد** و آن را به سرور می‌دهد؛ سرور اگر همان شناسه را قبلاً دیده باشد، دوباره نمی‌سازد (`ON CONFLICT DO NOTHING`). پس حتی اگر صف دوبار ارسال شود، فقط یک ردیف ساخته می‌شود.

## محدودیت‌های سراسریِ فاز K (روی همه‌ی تسک‌ها)
- **هیچ کتابخانه‌ی جدیدی نصب نمی‌شود** (نه Dexie/RxDB/PouchDB، نه toast-lib، نه uuid-lib). تولیدِ id با `crypto.randomUUID()` و fallbackِ بومی در `utils/uuid.ts`.
- **هیچ مهاجرتِ مخربِ DB.** فقط فایلِ SQL جدید و append-only `supabase/sql/47_offline_idempotency.sql`. نوعِ ستونِ `id` تغییر نمی‌کند، جدول drop نمی‌شود.
- **سازگاریِ عقب‌رو اجباری:** پارامترِ جدیدِ RPC باید `DEFAULT NULL` باشد (فراخوانیِ Edge Functionِ AI در `action-processor.ts` نباید بشکند). آیتم‌های `temp-`ـی و `toggle`ـیِ در صف‌ماندهٔ نسخه‌ی قبل باید همچنان flush شوند (مسیرِ legacy).
- **هیچ مسیرِ کلیکِ دستی برای سینک ساخته نمی‌شود.** فلاش فقط خودکار است (Anti §۸۰).
- update/delete دست‌نخورده می‌مانند (طبیعتاً ایدمپوتنت)؛ فقط insert و set_completion سخت‌سازی می‌شوند.

## ترتیبِ اجرا (وابستگی‌ها)
**K1 (پایه — اول و تنها)** → **K2 (مسیرِ نوشتنِ کلاینت)** → **K3 (موتورِ سینک)** → **K4 (UX)** → **K5 (تستِ نهایی)**.
> K2 و K3 قراردادِ مشترکِ outbox دارند → **سریِ اکید** (هرچند فایلِ مجزا). K4 به نوعِ `'info'`ـی که K2 در `useDataManager` اضافه می‌کند وابسته است → پس از K2. نقشه‌ی تداخل: §۱۴.ز.

---

## تسک K1 — پایه: تولیدِ id کلاینت + idempotency سرور + قراردادِ outbox
**راهنمای پیاده‌سازیِ فنی:**
1. **فایلِ جدید `utils/uuid.ts`:** تابعِ `export const newId = (): string => …` بساز که اگر `typeof crypto !== 'undefined' && 'randomUUID' in crypto` بود `crypto.randomUUID()` را برگرداند، وگرنه UUID v4 را از `crypto.getRandomValues(new Uint8Array(16))` بسازد (بایتِ ۶ را `(b & 0x0f) | 0x40` و بایتِ ۸ را `(b & 0x3f) | 0x80` کن، سپس به رشته‌ی `8-4-4-4-12` فرمت کن). هیچ وابستگیِ خارجی import نکن.
2. **فایلِ جدید `supabase/sql/47_offline_idempotency.sql`:** دو RPC را `CREATE OR REPLACE` کن (الگوی کاملِ بدنه در §۱۴.ب):
   - `create_task_with_tags`: پارامترِ **اولِ** `p_id UUID DEFAULT NULL` را اضافه کن (بقیه‌ی پارامترها با همان نام/ترتیب)؛ `v_id := COALESCE(p_id, gen_random_uuid())`؛ `INSERT … (id, …) VALUES (v_id, …) ON CONFLICT (id) DO NOTHING RETURNING *;` و `IF NOT FOUND THEN RETURN QUERY SELECT * FROM public.tasks WHERE id = v_id AND user_id = auth.uid(); END IF;`. حتماً `RETURNS SETOF public.tasks` و `SECURITY DEFINER SET search_path = public` را حفظ کن.
   - `create_note_with_tags`: همان الگو با `p_id UUID DEFAULT NULL` و `RETURNS SETOF public.notes`.
3. **`services/taskService.ts`:** امضای `createTask` را طوری کن که `id` بپذیرد (یا از `task.id`) و در `rpcParams` کلیدِ `p_id: id` را بفرستد.
4. **`services/noteService.ts`:** همان کار برای `createNote` (`p_id`).
5. **`services/projectService.ts`:** در `createProject`، `.insert([{ ...project, user_id }])` را به `.upsert([{ id, ...project, user_id }], { onConflict: 'id', ignoreDuplicates: true }).select().single()` تبدیل کن (id از پارامتر می‌آید).
6. **`services/habitService.ts`:** (الف) `createHabit` را مثل بند ۵ به `.upsert(..., { onConflict:'id', ignoreDuplicates:true })` تبدیل کن؛ (ب) تابعِ جدیدِ `setHabitCompletion(habitId, date, completed: boolean)` بساز: اگر `completed` → `insert ON CONFLICT (habit_id, completion_date) DO NOTHING`، وگرنه `delete WHERE habit_id & completion_date`. `toggleHabitCompletion` را **حذف نکن** (مسیرِ legacy).
7. **`services/offline/outbox.ts`:** در interfaceِ `Mutation`، نوعِ `action` را به `'insert' | 'update' | 'delete' | 'set_completion'` گسترش بده. `'toggle'` را هم برای سازگاری اضافه کن. `remapTempId` و توابعِ DLQ دست‌نخورده بمانند.
**محدودیت‌های اختصاصیِ تسک:** فقط همین فایل‌ها. ترتیب/نامِ پارامترهای قبلیِ RPC را تغییر نده (Anti §۸۴). `ignoreDuplicates:true` الزامی است تا تریگرِ `UPDATE`ـیِ vectorize دوباره شلیک نشود. این تسک هیچ کامپوننتِ UI و هیچ هوکی را لمس نمی‌کند.
CONTEXT_FILES: ["services/taskService.ts", "services/noteService.ts", "services/projectService.ts", "services/habitService.ts", "services/offline/outbox.ts", "services/supabaseClient.ts", "supabase/sql/10_functions.sql", "supabase/sql/03_core.sql", "supabase/functions/ai-assistant/lib/action-processor.ts", "types.ts", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک K2 — مسیرِ نوشتنِ کلاینت: UUID کلاینت + set_completion + نوعِ Toastِ info (`hooks/useDataManager.ts`)
**راهنمای پیاده‌سازیِ فنی:** (وابسته به K1)
1. در بالای فایل `import { newId } from '../utils/uuid';`.
2. در **همه‌ی** توابعِ ساخت (`addProject`, `addTask`, `addNote`, `addHabit`)، `const tempId = 'temp-' + Date.now();` را با `const id = newId();` جایگزین کن و همان `id` را: (الف) به‌عنوان `id` در آبجکتِ optimistic بگذار؛ (ب) در `enqueue({ id, … })` استفاده کن؛ (ج) به فراخوانیِ سرویس بده (مثلاً `taskService.createTask({ ...task, id })` یا پارامترِ id مطابقِ امضای K1). دیگر نیازی به swapِ `tempId→newX.id` نیست؛ چون id ثابت است، شاخه‌ی `prev.map(x => x.id === tempId ? newX : x)` را به‌روزرسانیِ همان id (merge فیلدهای برگشتی از سرور مثل `created_at`) ساده کن.
3. `toggleHabitCompletion`: وضعیتِ مطلوب را در لحظه‌ی تعامل حساب کن: `const already = habit.completedDates.includes(date); const completed = !already;`. در صفِ آفلاین: `enqueue({ id: \`set-${habitId}-${date}\`, entity:'habits', action:'set_completion', payload:{ habitId, date, completed } })`. در مسیرِ آنلاین: به‌جای `habitService.toggleHabitCompletion` تابعِ `habitService.setHabitCompletion(habitId, date, completed)` را صدا بزن (ایدمپوتنت).
4. در interfaceِ `AppNotification` (همین فایل)، نوعِ `type` را به `'success' | 'error' | 'info'` گسترش بده. امضای `addNotification` نیز `'info'` را بپذیرد.
**محدودیت‌های اختصاصیِ تسک:** فقط `hooks/useDataManager.ts`. منطقِ optimistic/snapshot/rollback و شرطِ `isRetry` دست‌نخورده بماند (فقط منبعِ id و عملِ عادت عوض می‌شود). از `Date.now()` برای id استفاده نکن (Anti §۸۱). `action:'toggle'` صف نکن (Anti §۸۲). `useOfflineSync.ts` را اینجا لمس نکن (تسکِ K3).
CONTEXT_FILES: ["hooks/useDataManager.ts", "services/taskService.ts", "services/noteService.ts", "services/projectService.ts", "services/habitService.ts", "services/offline/outbox.ts", "services/offline/snapshot.ts", "hooks/useRealtimeSync.ts", "types.ts", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک K3 — موتورِ سینک: قفلِ اتمیک + dispatchِ جدید + Toastهای گذرا (`hooks/useOfflineSync.ts`)
**راهنمای پیاده‌سازیِ فنی:** (وابسته به K1, K2)
1. **قفلِ اتمیک:** در ابتدای `flushOutbox`، ترتیب را اصلاح کن تا قفل **پیش از هر `await`** گرفته شود: `if (!userId || syncInProgressRef.current) return; if (!navigator.onLine) return; syncInProgressRef.current = true; setIsSyncing(true);` سپس بلوکِ `try { const { data:{ session } } = await supabase.auth.getSession(); if (!session) { return; } … } finally { syncInProgressRef.current = false; setIsSyncing(false); }`. (نکته: گاردِ session حالا داخلِ try است؛ اگر session نبود، `return` داخلِ try انجام می‌شود و `finally` قفل را آزاد می‌کند.)
2. **شاخه‌ی insert (سازگاریِ گذار):** برای `entity in {projects,tasks,notes,habits}` و `action:'insert'`: اگر `item.id` با `temp-` شروع شد → مثلِ قبل سرویس را صدا بزن و سپس `remapTempId(item.id, res.id)` (legacy). در غیرِ این صورت (UUID) → `id` را به سرویس بده (createTask/createNote با `p_id`، create/upsertِ project/habit با همان id)؛ **بدونِ** `remapTempId`.
3. **dispatchِ `set_completion`:** شاخه‌ی جدید برای `entity:'habits' && action:'set_completion'` → `await habitService.setHabitCompletion(item.payload.habitId, item.payload.date, item.payload.completed)`. شاخه‌ی legacy `action:'toggle'` همچنان `toggleHabitCompletion(payload.habitId, payload.date)` را صدا بزند.
4. **Toastِ موفقیتِ واحد:** یک شمارنده‌ی `processed` بگیر؛ پس از پایانِ موفقِ حلقه اگر `processed >= 1` بود، `addNotification('تغییرات همگام‌سازی شد', 'success')` (یک‌بار، نه به‌ازای هر آیتم).
5. **Toastِ آفلاین:** داخلِ همان `useEffect`ِ مالکِ شنونده‌ها، یک `const handleOffline = () => addNotification('شما آفلاین هستید؛ تغییرات ذخیره می‌شوند', 'info');` و `window.addEventListener('offline', handleOffline)` اضافه کن و در cleanup حذفش کن.
**محدودیت‌های اختصاصیِ تسک:** فقط `hooks/useOfflineSync.ts`. منطقِ retry/`isRetryable`/DLQ (`moveToFailed`) و cascadeِ tempId دست‌نخورده بماند. Toastِ آفلاین حتماً `'info'` باشد نه `'error'` (Anti §۸۶). هیچ فراخوانیِ `flushOutbox` از کلیکِ کاربر اضافه نکن (Anti §۸۰). امضاها باید با `setHabitCompletion`/`p_id`ـی که K1 ساخت و payloadِ `set_completion`ـی که K2 صف می‌کند، دقیقاً هم‌خوان باشند.
CONTEXT_FILES: ["hooks/useOfflineSync.ts", "services/offline/outbox.ts", "services/taskService.ts", "services/noteService.ts", "services/projectService.ts", "services/habitService.ts", "services/supabaseClient.ts", "hooks/useDataManager.ts", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک K4 — UX: حذفِ بنرِ دائمی/دکمه‌ی دستی + نوعِ Toastِ info
**راهنمای پیاده‌سازیِ فنی:** (وابسته به K2 برای نوعِ `'info'`)
1. **`components/ui/ToastNotifications.tsx`:** در interfaceِ `AppNotification` نوعِ `'info'` را اضافه کن (هم‌خوان با K2)؛ در رندر، یک شاخه‌ی استایلِ خنثی برای `info` بساز (مثلاً `bg-neutral-800/30 border-neutral-600/40 text-neutral-200`) و برای آن آیکنِ اطلاع/وای‌فای به‌جای `CheckIcon` استفاده کن (از `components/icons` یا lucide موجود). auto-dismiss از `useDataManager` می‌آید؛ دست‌نخورده.
2. **`components/NetworkBanner.tsx`:** دکمه‌ی «همگام‌سازی»، نشانِ «N تغییرِ معلق» و حالتِ سبزِ «آماده‌ی همگام‌سازی» را **حذف** کن. کامپوننت را به یک نشانِ بسیار ظریف و **فقط هنگامِ آفلاین** فروبکاه: اگر `isOnline` بود `return null`؛ اگر آفلاین بود فقط یک پیلِ کوچکِ غیرمزاحم (همان استایلِ amber موجود، بدونِ دکمه) نشان بده. هیچ `flushOutbox`/`useData().flushOutbox` در این فایل استفاده نشود.
3. **`App.tsx`:** `<NetworkBanner />` می‌تواند بماند (حالا فقط نشانِ آفلاین است). مطمئن شو هیچ propِ سینکِ دستی به آن پاس داده نمی‌شود و importهای بلااستفاده پاک شوند.
**محدودیت‌های اختصاصیِ تسک:** فقط این سه فایل. منطقِ سینک (`useOfflineSync`) را لمس نکن. بنرِ `fixed` دائمی یا دکمه‌ی دستی را برنگردان (Anti §۷۹، §۸۰). z-indexها و چیدمانِ کلی دست‌نخورده. اگر تصمیم به `return null`ِ کاملِ NetworkBanner گرفتی، Toastِ آفلاینِ K3 جایگزینِ کافی است — اما حذفِ پیلِ آفلاین اجباری نیست.
CONTEXT_FILES: ["components/NetworkBanner.tsx", "components/ui/ToastNotifications.tsx", "components/icons.tsx", "App.tsx", "hooks/useNetworkStatus.ts", "contexts/DataContext.tsx", "hooks/useDataManager.ts", "docs/ARCHITECTURE.md"]

## تسک K5 — تستِ یکپارچه‌ی پایان‌به‌پایان (دستی، چک‌لیست)
**راهنمای پیاده‌سازیِ فنی:** پس از K1–K4، با ابزارِ build (`compile_applet`) صحتِ کامپایل را تأیید کن، سپس این سناریوها را دستی بزن و نتیجه را در `docs/CURRENT_TASK.md` ثبت کن:
1. **Idempotency تحتِ Race:** آفلاین شو، یک تسک بساز؛ آنلاین شو. در حینِ سینک سریعاً اپ را چند بار refresh/فعال‌سازی کن (یا اگر دکمه‌ای باقی مانده، تست بی‌اثرِ آن). انتظار: **دقیقاً یک** ردیف در سرور.
2. **Idempotency تحتِ از-دست-رفتنِ ack:** آفلاین → ساختِ یادداشت → آنلاین → بلافاصله بعد از شروعِ سینک، شبکه را قطع/وصل کن. انتظار: پس از تثبیت، **یک** ردیف، نه دو.
3. **عادت SET:** آفلاین → تیکِ عادت برای امروز → آنلاین. سپس آفلاین → برداشتنِ تیک → آنلاین. انتظار: وضعیتِ نهایی دقیقاً همان آخرین انتخاب باشد (نه flipِ اشتباه)؛ سینکِ دوباره تغییری ندهد.
4. **Realtime echo:** آنلاین، یک تسک بساز و چند ثانیه صبر کن. انتظار: **کپیِ دوم بصری ظاهر نشود** (id کلاینت == id سرور).
5. **UX:** قطعِ شبکه → فقط یک Toastِ ظریفِ «آفلاین هستید…» (خوددِفع‌شونده، بدونِ دکمه، بدونِ بنرِ چسبیده). وصلِ شبکه → سینکِ خودکار + یک Toastِ «تغییرات همگام‌سازی شد». هیچ کلیکِ دستی لازم نباشد.
6. **سازگاریِ عقب‌رو:** (در صورتِ امکان) یک آیتمِ `temp-`ـیِ دستی در outbox تزریق کن و آنلاین شو؛ باید از مسیرِ legacy (server-gen + remap) flush شود بدونِ خطا.
7. **AI دست‌نخورده:** از دستیارِ هوش مصنوعی یک تسک بساز؛ چون RPC با `p_id=NULL` فراخوانی می‌شود باید مثلِ قبل کار کند.
**محدودیت‌های اختصاصیِ تسک:** بدونِ کدِ جدید؛ فقط راستی‌آزمایی. هر شکست = بازگشت به تسکِ مربوطه (K1–K4). معیارِ پذیرش = صفر رکوردِ تکراری در همه‌ی سناریوها + UX بدونِ کلیکِ دستی.
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md", "hooks/useOfflineSync.ts", "hooks/useDataManager.ts"]
