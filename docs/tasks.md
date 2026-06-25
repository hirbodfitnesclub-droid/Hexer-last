

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
1. **فایلِ جدید `utils/uuid.ts`:** فایلِ `utils/uuid.ts` را عیناً از بلاکِ مرجعِ زیر کپی کن؛ هیچ بازنویسی/ساده‌سازی مجاز نیست:
```typescript
export function newId(): string {
  const c = (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('[uuid] Secure crypto API unavailable; cannot generate a safe id.');
  }
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(b, x => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
```
2. **فایلِ جدید `supabase/sql/47_offline_idempotency.sql`:** دو RPC را `CREATE OR REPLACE` کن. برای این کار حتماً گامِ صریحِ `DROP FUNCTION IF EXISTS ...` با امضای دقیق پیش از `CREATE` را برای جلوگیری از ایجاد overloadهای تکراری اضافه کن. ساختار بدنه توابع باید به صورت `DO NOTHING` به همراه `RETURN QUERY SELECT * ... WHERE user_id = auth.uid()` بازتعریف شوند. بلاک مرجع و عینی زیر را عیناً کپی و استفاده کن:
```sql
-- supabase/sql/47_offline_idempotency.sql — این بلاکها را عیناً کپی کن.
-- DROP لازم است تا overloadِ قدیمی حذف و فراخوانیِ named-arg مبهم نشود.
DROP FUNCTION IF EXISTS public.create_task_with_tags(text, text, uuid, timestamptz, text, text[], jsonb);
CREATE OR REPLACE FUNCTION public.create_task_with_tags(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_due_date TIMESTAMPTZ DEFAULT NULL,
    p_priority TEXT DEFAULT 'medium',
    p_tags TEXT[] DEFAULT '{}',
    p_checklist JSONB DEFAULT '[]'::jsonb,
    p_id UUID DEFAULT NULL            -- ← آخرین پارامتر، با DEFAULT
)
RETURNS SETOF public.tasks AS $$
DECLARE
    v_id UUID := COALESCE(p_id, gen_random_uuid());
BEGIN
    INSERT INTO public.tasks (
        id, user_id, project_id, title, description, priority, due_date, tags, checklist, created_at, updated_at
    )
    VALUES (
        v_id, auth.uid(), p_project_id, p_title, p_description, p_priority, p_due_date, p_tags, p_checklist, now(), now()
    )
    ON CONFLICT (id) DO NOTHING;
    -- همیشه ردیفِ خودِ کاربر را برگردان (هم insertِ تازه، هم وجودِ قبلی). scope به auth.uid() = امنیت.
    RETURN QUERY
        SELECT * FROM public.tasks WHERE id = v_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.create_note_with_tags(text, text, uuid, text[]);
CREATE OR REPLACE FUNCTION public.create_note_with_tags(
    p_title TEXT,
    p_content TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_tags TEXT[] DEFAULT '{}',
    p_id UUID DEFAULT NULL            -- ← آخرین پارامتر، با DEFAULT
)
RETURNS SETOF public.notes AS $$
DECLARE
    v_id UUID := COALESCE(p_id, gen_random_uuid());
BEGIN
    INSERT INTO public.notes (
        id, user_id, project_id, title, content, tags, created_at, updated_at
    )
    VALUES (
        v_id, auth.uid(), p_project_id, p_title, p_content, p_tags, now(), now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN QUERY
        SELECT * FROM public.notes WHERE id = v_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```
3. **`services/taskService.ts`:** امضای `createTask` را طوری کن که `id` بپذیرد (یا از `task.id`) و در `rpcParams` کلیدِ `p_id: id` را در انتهای پارامترها بفرستد.
4. **`services/noteService.ts`:** همان کار برای `createNote` (`p_id` در آخرین پارامتر).
5. **`services/projectService.ts`:** در `createProject`، به جای `ignoreDuplicates: true` باید از `{ onConflict: 'id' }` استفاده شود (زیرا تریگری در این جدول وجود ندارد و برای بازگرداندن تضمینی ردیف توسط `.single()` این کار ضرورت دارد): `.upsert([{ id, ...project, user_id }], { onConflict: 'id' }).select().single()`.
6. **`services/habitService.ts`:** (الف) `createHabit` را نیز مشابه بند ۵ به `.upsert(..., { onConflict: 'id' })` تغییر بده؛ (ب) تابعِ جدیدِ `setHabitCompletion(habitId, date, completed: boolean)` بساز: اگر `completed` → `insert ON CONFLICT (habit_id, completion_date) DO NOTHING`، وگرنه `delete WHERE habit_id & completion_date`. `toggleHabitCompletion` را **حذف نکن** (مسیرِ legacy).
7. **`services/offline/outbox.ts`:** در interfaceِ `Mutation`، نوعِ `action` را به `'insert' | 'update' | 'delete' | 'set_completion'` گسترش بده. `'toggle'` را هم برای سازگاری اضافه کن. `remapTempId` و توابعِ DLQ دست‌نخورده بمانند.
**محدودیت‌های اختصاصیِ تسک:** فقط همین فایل‌ها. ترتیب/نامِ پارامترهای قبلیِ RPC را تغییر نده (Anti §۸۴). فایل‌های `utils/uuid.ts` و `47_offline_idempotency.sql` پیاده‌سازیِ مرجع عینی هستند؛ مدل فقط رونویسی می‌کند و حق ندارد منطقِ بیتی یا plpgsql را همزمان از نو بسازد. این تسک هیچ کامپوننتِ UI و هیچ هوکی را لمس نمی‌کند.
CONTEXT_FILES: ["services/taskService.ts", "services/noteService.ts", "services/projectService.ts", "services/habitService.ts", "services/offline/outbox.ts", "services/supabaseClient.ts", "supabase/sql/10_functions.sql", "supabase/sql/03_core.sql", "supabase/functions/ai-assistant/## تسک K5 — تستِ یکپارچه‌ی پایان‌به‌پایان (دستی، چک‌لیست)
**راهنمای پیاده‌سازیِ فنی:** پس از K1–K4، با ابزارِ build (`compile_applet`) صحتِ کامپایل را تأیید کن، سپس این سناریوها را دستی بزن و به همراه سنجه‌های زیر صحت‌سنجی کرده و نتیجه را در `docs/CURRENT_TASK.md` ثبت کن:
1. **Idempotency تحتِ Race:** آفلاین شو، یک تسک بساز؛ آنلاین شو. در حینِ سینک سریعاً اپ را چند بار refresh/فعال‌سازی کن (یا اگر دکمه‌ای باقی مانده، تست بی‌اثرِ آن). انتظار: **دقیقاً یک** ردیف در سرور.
2. **Idempotency تحتِ از-دست-رفتنِ ack:** آفلاین → ساختِ یادداشت → آنلاین → بلافاصله بعد از شروعِ سینک، شبکه را قطع/وصل کن. انتظار: پس از تثبیت، **یک** ردیف، نه دو.
3. **عادت SET:** آفلاین → تیکِ عادت برای امروز → آنلاین. سپس آفلاین → برداشتنِ تیک → آنلاین. انتظار: وضعیتِ نهایی دقیقاً همان آخرین انتخاب باشد (نه flipِ اشتباه)؛ سینکِ دوباره تغییری ندهد.
4. **Realtime echo:** آنلاین، یک تسک بساز و چند ثانیه صبر کن. انتظار: **کپیِ دوم بصری ظاهر نشود** (id کلاینت == id سرور).
5. **UX:** قطعِ شبکه → فقط یک Toastِ ظریفِ «آفلاین هستید…» (خوددِفع‌شونده، بدونِ دکمه، بدونِ بنرِ چسبیده). وصلِ شبکه → سینکِ خودکار + یک Toastِ «تغییرات همگام‌سازی شد». هیچ کلیکِ دستی لازم نباشد.
6. **سازگاریِ عقب‌رو:** (در صورتِ امکان) یک آیتمِ `temp-`ـیِ دستی در outbox تزریق کن و آنلاین شو؛ باید از مسیرِ legacy (server-gen + remap) flush شود بدونِ خطا.
7. **AI دست‌نخورده:** از دستیارِ هوش مصنوعی یک تسک بساز؛ چون RPC با `p_id=NULL` فراخوانی می‌شود باید مثلِ قبل کار کند.
8. **سنجه‌های صحت‌سنجی معمار (QA):**
   - **الف) شکار رشته‌ی نامعتبر:** تمام idهای تولیدشده باید با استفاده از عبارت منظم (Regex) زیر به طور کامل اعتبارسنجی شوند تا وجود کاراکترهای نامعتبر و باگ سنتی حذف صفر جلو (padStart) دور زده شود:
     `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
   - **ب) تست شکست نفوذ و نشت امنیت (IDOR):** تایید کنید که فراخوانی تابع RPCِ با شناسه `p_id` متعلّق به ردیف یک کاربر دیگر، مقدار صفر ردیف بازمی‌گرداند و به هیچ وجه نشت داده‌های سایر کاربران (IDOR) تحتِ مکانیزمِ SECURITY DEFINER به دلیل استفاده از DO NOTHING + SELECT صریح فیلتر شده با `user_id = auth.uid()` رخ نمی‌دهد.
**محدودیت‌های اختصاصیِ تسک:** بدونِ کدِ جدید؛ فقط راستی‌آزمایی. هر شکست = بازگشت به تسکِ مربوطه (K1–K4). معیارِ پذیرش = صفر رکوردِ تکراری در همه‌ی سناریوها + UX بدونِ کلیکِ دستی.
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md", "hooks/useOfflineSync.ts", "hooks/useDataManager.ts"]�ایل)، نوعِ `type` را به `'success' | 'error' | 'info'` گسترش بده. امضای `addNotification` نیز `'info'` را بپذیرد.
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
5. **UX:** قطعِ شبکه → فقط یک Toastِ ظریفِ «آفلاین هستید…» (خوددِفع‌شونده، بدونِ دکمه, بدونِ بنرِ چسبیده). وصلِ شبکه → سینکِ خودکار + یک Toastِ «تغییرات همگام‌سازی شد». هیچ کلیکِ دستی لازم نباشد.
6. **سازگاریِ عقب‌رو:** (در صورتِ امکان) یک آیتمِ `temp-`ـیِ دستی در outbox تزریق کن و آنلاین شو؛ باید از مسیرِ legacy (server-gen + remap) flush شود بدونِ خطا.
7. **AI دست‌نخورده:** از دستیارِ هوش مصنوعی یک تسک بساز؛ چون RPC با `p_id=NULL` فراخوانی می‌شود باید مثلِ قبل کار کند.
8. **سنجش‌های اعتبارسنجی و امنیت:**
   - **اعتبارسنجی IDهای تولیدشده:** تمام UUIDهای تولیدشده توسط `utils/uuid.ts` باید با عبارت منظمِ `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` سازگار باشند تا از عدم وجود خطای حذف صفر ابتدایی و فرمت نامعتبر اطمینان حاصل شود.
   - **تستِ امنیت و منع نفوذ (IDOR):** فراخوانی از سمت سرور برای `create` با `p_id` متعلق به یک کاربرِ دیگر باید صفر ردیف برگرداند و هیچ‌گونه نشتِ اطلاعاتی نداشته باشد.
**محدودیت‌های اختصاصیِ تسک:** بدونِ کدِ جدید؛ فقط راستی‌آزمایی. هر شکست = بازگشت به تسکِ مربوطه (K1–K4). معیارِ پذیرش = صفر رکوردِ تکراری در همه‌ی سناریوها + UX بدونِ کلیکِ دستی.
CONTEXT_FILES: ["docs/PROJECT.md", "docs/ARCHITECTURE.md", "docs/tasks.md", "docs/CURRENT_TASK.md", "hooks/useOfflineSync.ts", "hooks/useDataManager.ts"]
