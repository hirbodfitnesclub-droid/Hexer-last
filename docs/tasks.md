

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


---

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
