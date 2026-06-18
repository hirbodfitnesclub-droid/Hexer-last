

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
