

---

# فاز F1‑R — قابِ ایمنِ iOS/سافاری و PWAِ کامل (فعال)

> مرجعِ کامل: `docs/ARCHITECTURE.md §۱۳` و `docs/PROJECT.md` فاز F1‑R. این فاز تسکِ پیشینِ F1 را تصحیح و تکمیل می‌کند. **هیچ فایلِ SQL/Edge/سرویس لمس نمی‌شود؛ این کار صرفاً Layout/PWA است.**
>
> **یادآوری به کدنویس (مهم):** این پروژه کاربرِ فعالِ واقعی دارد. دقیقاً همان فایل‌هایی را که در `CONTEXT_FILES` آمده بخوان و فقط همان‌ها را ویرایش کن. نسخه‌های legacyِ `/components/` (`Dashboard,TasksView,NotesView,ChatView,TaskEditorModal,NoteEditorModal,HabitEditorModal,Onboarding,ProjectsView,Modal,Sidebar`) **مرده‌اند و ویرایش نمی‌شوند** (نسخهٔ فعال در `/features/` است).

## محدودیت‌های سراسریِ فاز F1‑R (روی همه‌ی تسک‌ها)
- ارتفاعِ قابِ ریشه فقط `h-[100dvh]`؛ `100vh`/`min-h-screen`/`h-screen` ممنوع (Anti §۷۸).
- Safe‑Area فقط با `env(safe-area-inset-*)` از طریقِ کلاس‌های `index.css` یا مقادیرِ `pb-[calc(...)]`؛ عددِ هاردکدِ `bottom-24`/`pb-24`/`pb-20` ممنوع (Anti §۸۰).
- نوارِ پایین in‑flow است نه `fixed` (Anti §۷۷). هدرهای چسبان `pt-safe` می‌گیرند (Anti §۷۹).
- هر تغییرِ پوسته/مانیفست با bump شدنِ `CACHE_VERSION` و `?v=` همراه است (Anti §۸۳). Tailwind همچنان Play CDN است — هیچ `tailwind.config` ساخته نمی‌شود.

## ترتیبِ اجرا (وابستگی‌ها)
**F1.0 (شالوده، پیش‌نیازِ همه)** → **F1.1 (پوسته+نوار)** → **F1.2 (هدرها+overlayها)** → **F1.3 (مودال‌ها)**. **F1.4 (PWA)** مستقل و موازی‌پذیر با F1.1–F1.3 است (فایلِ مشترک ندارد). **F1.5** تأییدِ نهایی پس از همه.

## تسک F1.0 — شالودهٔ Safe‑Area در `index.css`
**راهنمای پیاده‌سازی فنی:**
1. در بلوکِ `:root` متغیرِ `--bottom-nav-height: 5rem;` را اضافه کن (معادلِ ارتفاعِ محتواییِ `h-20`). متغیرهای `--safe-area-inset-*` موجود را دست‌نزن.
2. کلاس‌های کمکی را اضافه کن: `.pt-safe { padding-top: env(safe-area-inset-top,0px); }`, `.pb-safe { padding-bottom: env(safe-area-inset-bottom,0px); }`, `.px-safe { padding-left/right: env(safe-area-inset-left/right,0px); }`.
3. کلاسِ `.preserve-safe-area` را با `padding-top/bottom: env(safe-area-inset-top/bottom,0px)` تعریفِ واقعی کن (این کلاس در `Onboarding` استفاده شده ولی تا الان بی‌اثر بوده — Anti §۸۶).
4. کلاسِ لنگرِ overlay را اضافه کن: `.above-bottom-nav { bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom,0px) + 0.75rem); }`.
5. قانونِ موجودِ `html, body { height:100%; overscroll-behavior-y:none; }` حفظ شود.
**محدودیت‌های اختصاصی تسک:** فقط CSS؛ هیچ کلاسِ موجود حذف یا تغییرِ رفتار ندهد (به‌خصوص بلوکِ Autofill و `.scroll-fade-edge`). از `@layer`/`@apply`/`tailwind.config` استفاده نکن (CDN است). مقادیرِ `env()` همیشه fallbackِ `0px` داشته باشند.
CONTEXT_FILES: ["index.css", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک F1.1 — پوستهٔ سه‌ناحیه‌ایِ `dvh` و in‑flow کردنِ نوارِ پایین
**راهنمای پیاده‌سازی فنی:**
1. در `App.tsx`: `#app-root` را از `min-h-screen` به `h-[100dvh]` تغییر بده؛ loaderِ `AppContent` (`h-[100dvh]` که هست) و loaderهای داخلی هماهنگ بمانند.
2. `#main-app-container` بماند `relative flex flex-col h-[100dvh]` و `overflow-hidden` بگیرد.
3. از `<main id="view-viewport">` کلاسِ `pb-24` را حذف کن (نوار دیگر روی محتوا نمی‌افتد)؛ `flex-1 overflow-y-auto overflow-x-hidden min-h-0` باشد.
4. در `components/BottomNav.tsx`: ریشه را از `fixed bottom-0 right-0 left-0 h-20 px-4 z-50` به یک عضوِ in‑flow تبدیل کن: `shrink-0 px-4 z-50 pb-safe` (دیگر `fixed`/`bottom-0` نباشد). ساختارِ کارتِ داخلی و دکمهٔ شناورِ مرکزی (چت) حفظ شود اما لنگرِ عمودی‌شان نسبت به همین کانتینرِ in‑flow بازتنظیم شود تا با `pb-safe` هم‌خوان بماند.
5. در `components/Auth.tsx:313` ارتفاع را از `min-h-screen` به `h-[100dvh]` تغییر بده (Anti §۷۸).
**محدودیت‌های اختصاصی تسک:** ترتیبِ ناوبری، آیکون‌ها و دکمهٔ مرکزیِ چت نباید تغییرِ رفتاری کند. مراقبِ ringِ دکمهٔ مرکزی (`ring-gray-950`) باش که با پس‌زمینهٔ نوار هم‌خوان بماند. هیچ‌چیزِ مربوط به state/routing را در `App.tsx` تغییر نده (Anti §۱۱).
CONTEXT_FILES: ["App.tsx", "components/BottomNav.tsx", "components/Auth.tsx", "index.css", "docs/ARCHITECTURE.md"]

## تسک F1.2 — `pt-safe` برای هدرهای چسبان و لنگرِ امنِ overlayها
**راهنمای پیاده‌سازی فنی:**
1. به هر `<header className="sticky top-0 ...">` کلاسِ `pt-safe` اضافه کن (پس‌زمینه تا زیرِ ناچ کشیده شود، ردیفِ `h-16`/`py-*` داخلی دست‌نخورده): `DashboardHeader.tsx`, `tasks/TasksView.tsx`, `notes/NotesView.tsx`, `projects/ProjectsView.tsx`, `chat/ChatView.tsx`, `billing/pages/SubscriptionPage.tsx`.
2. `components/NetworkBanner.tsx`: لنگرِ بالا از `top-4` به `top-[calc(1rem+env(safe-area-inset-top))]` (یا افزودنِ `pt-safe` به والد) تا با ناچ تداخل نکند.
3. `components/ui/ToastNotifications.tsx`: `bottom-24` را با کلاسِ `above-bottom-nav` جایگزین کن.
4. FABها: در `features/tasks/TasksView.tsx:327` و `features/notes/NotesView.tsx:111` کلاسِ `bottom-24` را با `above-bottom-nav` جایگزین کن.
5. اگر در viewهای اسکرول‌خور `pb-24`ِ inner وجود دارد (مثلِ `features/dashboard/Dashboard.tsx`)، چون نوار دیگر `fixed` نیست، فاصلهٔ انتهایی را به `pb-6` کاهش بده تا گپِ خالیِ بزرگ ایجاد نشود (FAB با `above-bottom-nav` لنگر دارد).
**محدودیت‌های اختصاصی تسک:** فقط کلاس‌های Layout؛ منطقِ هدر/پروگرس‌رینگ/داده تغییر نکند. هر هدر جداگانه ویرایش شود اما همه الگوی یکسانِ `pt-safe` را بگیرند. نسخه‌های legacyِ `/components/` لمس نشوند (Anti §۸۵).
CONTEXT_FILES: ["features/dashboard/components/DashboardHeader.tsx", "features/tasks/TasksView.tsx", "features/notes/NotesView.tsx", "features/projects/ProjectsView.tsx", "features/chat/ChatView.tsx", "features/billing/pages/SubscriptionPage.tsx", "components/NetworkBanner.tsx", "components/ui/ToastNotifications.tsx", "features/dashboard/Dashboard.tsx", "index.css"]

## تسک F1.3 — Safe‑Area در فوتر/هدرِ مودال‌های فعال
**راهنمای پیاده‌سازی فنی:**
1. فوترِ اکشنِ هر مودالِ تمام‌قد (`h-[100dvh]`) را safe‑bottom کن: بخشِ `pb-*` را به `pb-[calc(<base>+env(safe-area-inset-bottom))]` تبدیل کن. مشخصاً: `TaskEditorModal.tsx:322` (`pb-24`→`pb-[calc(1.5rem+env(safe-area-inset-bottom))]`)، `NoteEditorModal.tsx:235` (`pb-20`→`pb-[calc(1.5rem+env(safe-area-inset-bottom))]`).
2. هدرِ مودال‌های تمام‌قد که دکمهٔ بستن/بازگشت دارند `pt-safe` بگیرند (تا دکمهٔ بالا زیرِ ناچ نرود): `TaskEditorModal`, `NoteEditorModal`, `habits/HabitEditorModal`, `habits/HabitManagerModal`, `projects/ProjectDetailsModal`, `projects/ProjectsView` (مودالِ داخلی)، `billing/SubscriptionModal`.
3. overlayهای تمام‌صفحه: `components/PaywallModal.tsx` (والدِ `overflow-y-auto px-5 py-6`) → `pt-safe pb-safe`؛ ممیزیِ `RenewReminderModal`, `ProfileModal`, `SupportTicketModal` برای اطمینان از اینکه محتوای حساس زیرِ ناچ/Home‑Indicator نمی‌رود.
4. `WeeklyReportModal` و `Onboarding` از قبل safe‑area دارند — فقط ممیزی شوند، تغییر نده مگر باگ ببینی.
**محدودیت‌های اختصاصی تسک:** ساختارِ `flex flex-col h-[100dvh]` + `min-h-0` روی ناحیهٔ اسکرول حفظ شود (قراردادِ §۷.۳/§۱۳)؛ هیچ منطقِ ذخیره/فرم تغییر نکند. هر مودال جداگانه. این تسک با F1.1/F1.2 فایلِ مشترک ندارد.
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/notes/components/NoteEditorModal.tsx", "features/habits/components/HabitEditorModal.tsx", "features/habits/components/HabitManagerModal.tsx", "features/projects/components/ProjectDetailsModal.tsx", "features/projects/ProjectsView.tsx", "features/billing/components/SubscriptionModal.tsx", "components/PaywallModal.tsx", "components/ProfileModal.tsx", "components/SupportTicketModal.tsx", "index.css", "docs/ARCHITECTURE.md"]

## تسک F1.4 — سخت‌سازیِ PWA (manifest, index.html, sw.js, خنثی‌سازیِ آیکون‌ساز)
**راهنمای پیاده‌سازی فنی:**
1. `public/manifest.webmanifest`: افزودنِ `"id": "/"` و `"description"` فارسیِ کوتاه و `"categories": ["productivity"]`؛ بقیهٔ فیلدها (standalone/portrait/`#09090b`/rtl/fa/icons) حفظ شوند.
2. `index.html`: `?v=` روی `manifest` و `icon` را bump کن (مثلِ `?v=3`)؛ تأیید کن `theme-color=#09090b`، `apple-mobile-web-app-capable=yes`، `apple-mobile-web-app-status-bar-style=black-translucent`، `viewport-fit=cover` و `<link rel="apple-touch-icon">` سرِ جای‌اند (حذف نشوند — Anti §۸۴).
3. `public/sw.js`: `CACHE_VERSION` را به نسخهٔ بالاتر (مثلِ `'v1.74'`) ببر؛ استراتژی‌ها بدونِ تغییر (navigate=network‑first، asset=cache‑first، هرگز `supabase.co` کش نشود).
4. `generate_icons.cjs`: خنثی کن — بدنه را به گاردِ صریح تبدیل کن که در صورتِ اجرا با پیامِ خطا متوقف شود (`console.error('Refusing to overwrite real PWA icons'); process.exit(1);`) یا فایل را حذف کن (Anti §۸۲).
**محدودیت‌های اختصاصی تسک:** بدونِ افزودنِ کتابخانهٔ PWA. منطقِ Web‑Push و `checkIfShownAndRegister` در `sw.js` دست‌نخورده بماند. آیکون‌های واقعیِ `public/*.png` را بازنویسی نکن.
CONTEXT_FILES: ["public/manifest.webmanifest", "index.html", "public/sw.js", "generate_icons.cjs", "index.tsx"]

## تسک F1.5 — تأییدِ یکپارچهٔ پایان‌به‌پایان (دستی، چک‌لیست)
**راهنمای پیاده‌سازی فنی:**
1. سافاریِ iOS (دارای ناچ/Dynamic Island): هدر و دکمه‌هایش کاملاً زیرِ ناچ نباشند و قابلِ‌کلیک باشند.
2. اسکرول در سافاری با نوارِ آدرسِ داینامیک: نوارِ پایین و دکمهٔ مرکزی همیشه بالای نوارِ آدرس و قابلِ‌لمس بمانند؛ فوترِ مودال‌ها (ذخیره/انصراف) هرگز زیرِ نوار/Home‑Indicator نروند.
3. نصبِ Add to Home Screen: اجرای Standalone بدونِ اثرِ مرورگر، تمِ تیرهٔ یکپارچه، آیکونِ سالم.
4. رگرسیون: dvh هنگامِ بازشدنِ کیبورد در مودال‌ها (فوتر قابلِ‌دسترس)، تداخلِ z-index طبقِ §۷.۲، و عملکردِ FAB/Toast.
**محدودیت‌های اختصاصی تسک:** بدونِ نوشتنِ کد؛ صرفاً تأیید و گزارشِ هر رگرسیون به‌صورتِ تسکِ اصلاحی.
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md"]

---

# فاز I — نقشه‌ی راهِ مرجع (جستجوی هیبریدی Zero-Cost: FTS/`tsvector` + RRF + استخراج فیلتر)

> مرجعِ کامل: `docs/ARCHITECTURE.md` §۱۲ و `docs/PROJECT.md` فاز I. هدف: دقتِ بالاتر با هزینه‌ی LLMِ صفر. **هیچ فایل SQL قدیمی ویرایش نمی‌شود** و **مدلِ امبدینگ تغییر نمی‌کند.**

## محدودیت‌های سراسریِ فاز I (روی همه‌ی تسک‌ها)
- تمام تغییرِ دیتابیس فقط در فایلِ جدیدِ `supabase/sql/43_fulltext_hybrid_search.sql`؛ Idempotent و قابلِ اجرای دستی در SQL Editor (بدون اتکا به CLI).
- پیکربندیِ متن همیشه صریحِ `'simple'`؛ کوئریِ کاربر فقط با `websearch_to_tsquery` (نباید `to_tsquery` خام).
- سه پارامترِ اولِ `hybrid_search` و ترتیبشان ثابت؛ فیلترها فقط `DEFAULT NULL` در انتها (Anti §۷۶).
- ممنوع: `pg_trgm`/`similarity` برای متن (§۷۱)، تغییرِ خط لوله‌ی `vectorize`/مدلِ امبدینگ (§۷۵).

## ترتیبِ اجرا (وابستگی‌ها)
**I1 (مستقل) ∥ I2 (یک فایل، اتمیک)** → **I3** → I4 (اختیاری) → I5 (اختیاری/بعدی) → **I6 (تستِ نهایی)**.
> I1 و I2 روی فایل‌های جدا کار می‌کنند و می‌توانند موازی باشند. I3 فقط پس از اتمامِ هر دو. تمام زیرگام‌های دیتابیس داخلِ I2 هستند و **نباید موازی** شوند.

## تسک I1 — ماژولِ خالصِ استخراجِ فیلتر از کوئری (`query-parser.ts`)
**راهنمای پیاده‌سازی:**
1. فایلِ جدید `supabase/functions/ai-assistant/lib/query-parser.ts` با یک تابعِ خالص بساز:
   `export function parseSearchQuery(raw: string): { cleanText: string; filterType: 'task'|'note'|'project'|null; tags: string[]; dateFrom: string|null; dateTo: string|null }`.
2. استخراجِ نوع با Regex: الگوی `(?:نوع|type)\s*[:：]\s*(...)` و نگاشتِ کلمات → `task` (کار/تسک/task)، `note` (یادداشت/نوت/note)، `project` (پروژه/پروجکت/project).
3. استخراجِ تگ‌ها: تمام تطابق‌های `#([^\s#]+)` (هشتگ‌ها) در آرایه‌ی `tags`.
4. استخراجِ بازه‌ی تاریخ از کلیدواژه‌ها (به افقِ زمانیِ Asia/Tehran و خروجیِ ISO): «امروز/today»، «دیروز/yesterday»، «این هفته/this week»، «هفته گذشته/last week»، «این ماه/this month»، «ماه گذشته/last month». فقط `created_at` هدف است (نه `due_date`).
5. `cleanText` = `raw` پس از حذفِ تمام توکن‌های تطبیق‌یافته و `trim`. اگر چیزی استخراج نشد، همه‌ی فیلدها `null`/`[]` و `cleanText = raw`.
**محدودیت‌های تسک:** تابعِ **خالص** بدونِ هیچ I/O، بدونِ `import` از Supabase/Deno. نباید کلمات را پاک کند اگر مطمئن نیست (false-positive بدتر از false-negative است). فقط TypeScript خالص و قابلِ تست. **هشدار ریسک (Edge Case):** در پردازش تاریخ و استخراج کلمات با Regex بهشدت مراقب Over-engineering و False-Positive باش. کلماتی مثل «امروز» یا «این هفته» ممکن است کلیدواژهی اصلی متنِ کاربر برای جستجو باشند (مثلاً "تسکهای استراتژی امروز"). اگر Regex این کلمات را کورکورانه حذف کند، جستجو میشکند. کلمه فقط در صورتی باید استخراج و از `cleanText` حذف شود که صراحتاً در قالب یک فیلتر/پیشوند آمده باشد یا با اطمینان بالا نیت فیلتر زمانی داشته باشد.
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/rag-context.ts", "supabase/functions/ai-assistant/index.ts", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک I2 — مهاجرتِ دیتابیس: FTS + بازنویسیِ `hybrid_search` (فایلِ واحدِ `43`)
**راهنمای پیاده‌سازی:** (همه در یک فایل، به‌ترتیب)
1. تابعِ `public.hexer_fa_normalize(text) RETURNS text LANGUAGE sql IMMUTABLE` (یکسان‌سازیِ ی/ك عربی→فارسی، حذفِ اعراب/کشیده، نیم‌فاصله→فاصله، `lower`) — دقیقاً مطابقِ §۱۲.۱ گام ۱.
2. افزودنِ ستونِ `search_vector tsvector GENERATED ALWAYS AS (...) STORED` به `tasks`، `notes`، `projects` با `setweight` (عنوان=A، بدنه=B، تگ=C؛ projects بدونِ C) — §۱۲.۱ گام ۲.
3. ایندکسِ GIN روی هر `search_vector` — §۱۲.۱ گام ۳.
4. `DROP INDEX IF EXISTS` برای چهار ایندکسِ `idx_*_trgm` — §۱۲.۱ گام ۴.
5. `CREATE OR REPLACE FUNCTION public.hybrid_search(...)` با امضای جدید و سه پارامترِ فیلترِ `DEFAULT NULL`؛ منطق دقیقاً مطابقِ §۱۲.۲: حذفِ کاملِ آستانه‌های `>=0.25` و `>=0.01`، سقفِ `LIMIT 100` در هر CTE، مسیرِ متن با `ts_rank_cd` روی `websearch_to_tsquery('simple', hexer_fa_normalize(p_query_text))`، تلفیقِ RRF با `k=60`، پشتیبانی از سه جدول (مثلِ ۳۱). شاخه‌ی projects هنگام `p_tags IS NOT NULL` کنار گذاشته شود.
6. پایان: `NOTIFY pgrst, 'reload schema';`.
**محدودیت‌های تسک:** فقط همین فایلِ جدید؛ فایل‌های ۲۲/۲۶/۳۱ و `03_core.sql`/`20_refactor_schema.sql` **دست‌نخورده**. ستونِ `GENERATED` باید عبارتِ `IMMUTABLE` داشته باشد (وگرنه خطا). ستون‌های بازگشتی و `SECURITY DEFINER SET search_path=public` و گاردِ `auth.uid()` حفظ شوند. خروجیِ تابع `(id,type,title,snippet,score)` تغییر نکند. در ساعتِ کم‌ترافیک اجرا شود (ADD COLUMN جدول را بازنویسی می‌کند). **هشدار ریسک (Edge Case) شماره ۱:** در تابع `websearch_to_tsquery`، کاراکتر خط تیره (`-`) بهعنوان عملگر `NOT` تفسیر میشود. اگر کاربر عبارتی مثل `react-native` را جستجو کند، پستگرس آن را `react AND NOT native` میفهمد! باید در تابع `hexer_fa_normalize` سناریوی خط تیره در کلمات ترکیبی/انگلیسی مدیریت شود (مثلاً تبدیل به فاصله یا نادیده گرفتن رفتار NOT). **هشدار ریسک (Edge Case) شماره ۲:** استفاده از `ADD COLUMN ... GENERATED ALWAYS AS ... STORED` و ساخت ایندکس `GIN`، منجر به قفل شدن کامل جدول (Table Lock) در حین بازنویسی میشود. باید صراحتاً در کامنت فایل SQL درج کنی که این اسکریپت حتماً باید در ساعات کمترافیک اجرا شود.
CONTEXT_FILES: ["supabase/sql/31_rag_projects.sql", "supabase/sql/26_update_hybrid_search.sql", "supabase/sql/03_core.sql", "supabase/sql/20_refactor_schema.sql", "supabase/sql/00_extensions.sql", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

## تسک I3 — اتصالِ `rag-context.ts` به parser و امضای جدید
**راهنمای پیاده‌سازی:**
1. `parseSearchQuery(message)` را در ابتدای `buildRagContext` فراخوان کن.
2. امبدینگ را از `cleanText` بساز: `generateEmbedding(ai, cleanText, 'query')` (پیشوندِ `'query'` حفظ شود).
3. `supabaseClient.rpc('hybrid_search', { p_query_embedding, p_query_text: cleanText, p_match_count: 15, p_filter_type, p_date_from, p_date_to, p_tags })`.
4. اگر `cleanText` پس از حذف تهی شد ولی فیلتری وجود داشت، اجازه بده مسیرِ وکتور با `cleanText` (حتی تهی) و فیلترها کار کند؛ قرارداد خطا و `try/catch`ِ موجود حفظ شود.
**محدودیت‌های تسک:** قراردادِ خروجی (`{ contextString, citations }`) و نگاشتِ citations دست‌نخورده. وابسته به اتمامِ **I1 و I2**. هیچ فراخوانیِ امبدینگِ اضافه‌ای ساخته نشود (§۷۵).
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/rag-context.ts", "supabase/functions/ai-assistant/lib/query-parser.ts", "supabase/functions/_shared/gemini-client.ts", "docs/ARCHITECTURE.md"]

## تسک I4 — (اختیاری) پاک‌سازیِ کوئریِ `SUGGEST_LINK` در `action-processor.ts`
**راهنمای پیاده‌سازی:** در شاخه‌ی `SUGGEST_LINK`، `queryText` را با `parseSearchQuery` پاک کن و فیلترهای استخراج‌شده را به همان `hybrid_search` (با `p_match_count=5`) پاس بده. اگر فیلتری نبود، رفتارِ فعلی بدونِ تغییر بماند.
**محدودیت‌های تسک:** نشکستنِ امضا و سازگاریِ رو به عقب. تغییرِ حداقلی؛ این تسک non-blocking است و می‌تواند به بعد موکول شود.
CONTEXT_FILES: ["supabase/functions/ai-assistant/lib/action-processor.ts", "supabase/functions/ai-assistant/lib/query-parser.ts", "docs/ARCHITECTURE.md"]

## تسک I5 — (اختیاری/بعدی) دکمه‌های Toggle فیلتر در UIِ جستجوی معنایی
**راهنمای پیاده‌سازی:** در سطحِ چتِ «memory» (یا هرجا که `searchSemantic` در آینده وصل شود)، دکمه‌های Toggle برای «امروز/هفته گذشته» و «نوع: یادداشت/کار/پروژه» اضافه کن که توکنِ متناظر را به پیام پیش‌اضافه می‌کنند یا فیلترِ ساختاری را مستقیماً پاس می‌دهند.
**محدودیت‌های تسک:** فقط با کلاس‌های معتبرِ Tailwind v3 و الگوی Mobile-Only (Anti §۲۲/§۲۶). چون `searchSemantic` فعلاً فراخوان ندارد، این تسک خارج از هسته است و فقط پس از تصمیمِ محصول اجرا شود.
CONTEXT_FILES: ["services/geminiService.ts", "features/chat/ChatView.tsx", "components/icons.tsx", "docs/PROJECT.md"]

## تسک I6 — تستِ یکپارچه‌ی پایان‌به‌پایان (دستی، چک‌لیست)
**راهنمای پیاده‌سازی:** پس از اعمالِ `43` و دیپلویِ Edge: (الف) جستجوی واژه‌ی کلیدیِ خاص (شماره/نام) باید رکوردِ دقیق را بالا بیاورد؛ (ب) `نوع: یادداشت` فقط یادداشت‌ها را برگرداند؛ (ج) `#تگ` فیلتر شود؛ (د) «هفته گذشته» بازه‌ی درست را اعمال کند؛ (ه) کوئریِ تهی/پرنویز نباید خطا دهد (مسیرِ وکتور سالم بماند)؛ (و) رکورد بدونِ `embedding` همچنان از مسیرِ متن یافت شود. نتایج در `docs/CURRENT_TASK.md` ثبت شود.
**محدودیت‌های تسک:** بدونِ کدِ جدید؛ فقط راستی‌آزمایی. هر رگرسیون = بازگشت به تسکِ مربوطه.
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md"]
