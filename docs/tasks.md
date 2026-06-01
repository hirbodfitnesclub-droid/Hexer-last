# tasks.md — نقشه‌ی راه این ریفکتور (R1–R10)

> ترتیب **متوالی و عمدی** است؛ وابستگی‌ها صریح‌اند. تسک‌هایی که روی فایل یکسان می‌نویسند موازی نمی‌شوند.
> مدل کدنویس قبل از هر تسک فقط `CONTEXT_FILES` آن را می‌خواند و دقیقاً در مسیرهای گفته‌شده خروجی می‌دهد.
> هیچ تسکی از `supabase` CLI استفاده نمی‌کند؛ همه فایل خام برای اجرای دستی در پنل تولید می‌کنند.
> مرجع: `PROJECT.md` (ضدالگوها) و `ARCHITECTURE.md` (اسکیما/RPC/معماری/رجیستر باگ).

---

## فاز A — پایه‌ی دیتابیس و بک‌اند برای قابلیت‌های جدید

### تسک R1: افزوده‌های اسکیما (Schema Δ + RLS)
**راهنمای پیاده‌سازی فنی:** فایل جدید `supabase/sql/20_refactor_schema.sql` (Idempotent):
1. `alter table profiles add column if not exists specialty text;` و `... interests text[] default '{}'::text[];`.
2. جدول `task_note_links` مطابق `ARCHITECTURE.md §۲.۲` (FKها با `on delete cascade`، `UNIQUE(task_id, note_id)`، ایندکس‌ها).
3. جدول‌های `chat_sessions` و `chat_messages` مطابق `§۲.۳` (`UNIQUE(user_id, session_date)`، `session_id` با cascade، ایندکس‌ها).
4. `create extension if not exists pg_trgm;` + ایندکس‌های GIN تری‌گرم روی `tasks.title/description` و `notes.title/content` (`§۲.۴`). **اجباری:** این ایندکس‌ها با `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` ساخته شوند تا جداولِ پرداده هنگام ریفکتور قفل (Lock) نشوند. چون `CONCURRENTLY` داخل بلوک ترانزاکشن اجرا نمی‌شود، این دستورات باید **بیرون از هر `BEGIN/COMMIT`** و در انتهای فایل قرار گیرند (در Supabase SQL Editor هر statement جداگانه اجرا شود؛ در کامنت بالای آن‌ها این محدودیت قید شود).
5. RLS + پالیسی پایه‌ی `auth.uid() = user_id` برای هر سه جدول جدید.
6. (توصیه‌شده) `pg_cron` + job نگه‌داری ۳۰ روزه‌ی چت. اگر در دسترس نبود، در کامنت ذکر شود که fallback در `get_chat_sessions` (R2) است.

**محدودیت‌ها:** همه‌چیز Idempotent؛ هیچ RPC اینجا نوشته نمی‌شود (R2)؛ بُعد بردار ۷۶۸ دست نمی‌خورد؛ جداول موجود فقط با `alter add column if not exists` لمس می‌شوند.

`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "docs/PROJECT.md", "types.ts"]`

---

### تسک R2: لایه‌ی RPC (Linking + Hybrid Search + Usage + Chat)
**راهنمای پیاده‌سازی فنی:** فایل جدید `supabase/sql/21_refactor_functions.sql`:
1. `link_task_note`, `unlink_task_note`, `get_linked_notes`, `get_linked_tasks` مطابق `§۳` (user-scoped، Idempotent).
2. `hybrid_search(p_query_embedding vector(768), p_query_text text, p_match_count int)` با **RRF** روی cosine و `similarity()`؛ **اجباراً `where user_id = auth.uid()`**؛ خروجی `(id, type, title, snippet, score)`.
3. `get_usage_status()` و `get_daily_usage(p_days int)` — فقط خواندن، بدون افزایش شمارنده.
4. `get_or_create_today_session()` و `get_chat_sessions(p_limit int)`. **حذف تنبل اجباری (Lazy Cleanup):** چون در پلن رایگان Supabase وجود `pg_cron` تضمین‌شده نیست، نباید به job شبانه تکیه کنیم. در ابتدای بدنه‌ی `get_chat_sessions` (پیش از `SELECT` خروجی) یک `DELETE FROM chat_sessions WHERE user_id = auth.uid() AND session_date < ((now() AT TIME ZONE 'Asia/Tehran')::date - INTERVAL '30 days')` اجرا شود تا با هر بار واکشیِ تاریخچه، نشست‌های قدیمی‌ترِ **همان کاربر** پاک شوند (پیام‌ها با cascade). این حذف باید فارغ از فعال‌بودن یا نبودنِ pg_cron همیشه اجرا شود.

**محدودیت‌ها:** توابع `SECURITY DEFINER` با `search_path` امن و فیلتر `auth.uid()`؛ `consume_ai_quota` دست نمی‌خورد؛ وابسته به R1.

`CONTEXT_FILES: ["docs/ARCHITECTURE.md", "services/taskService.ts", "services/noteService.ts", "services/billingService.ts"]`

---

### تسک R3: ارتقای توابع لبه (Vectorize + ai-assistant)
**راهنمای پیاده‌سازی فنی:**
1. `supabase/functions/vectorize/index.ts`: متن embedding از **ترکیب `title + description/content + tags`** (نه یک فیلد)؛ بُعد ۷۶۸؛ منطق fire-and-forget و env `SUPABASE_SERVICE_ROLE_KEY` حفظ شود.
2. `supabase/functions/ai-assistant/index.ts`:
   - **RAG واقعی:** به‌جای `match_documents`، embedding کوئری را بگیر و `hybrid_search(...)` را صدا بزن.
   - **حالت استخراج (Proposal):** وقتی `audioPath`/`imagePath` هست، هم تسک و هم یادداشت استخراج کن و فقط `proposals` برگردان (**هیچ نوشتنی در DB**) مطابق `§۴.۳`.
   - **لینک هوشمند:** در صورت درخواست لینک، `hybrid_search` روی notes/tasks و کاندیداها با `operation: 'suggest_link'` در `actionResults` (`§۴.۲`).
   - قرارداد پاسخ مطابق `§۴.۴` (`reply, citations, actionResults, proposals, transcription`)؛ سازگاری عقب‌رو حفظ.

**محدودیت‌ها:** `service_role` فقط از `Deno.env`؛ مدل داینامیک از `consume_ai_quota.model`؛ در حالت استخراج صفر نوشتن (نوشتن فقط پس از تأیید کلاینت در R9)؛ وابسته به R2.

`CONTEXT_FILES: ["supabase/functions/ai-assistant/index.ts", "supabase/functions/vectorize/index.ts", "docs/ARCHITECTURE.md", "services/geminiService.ts"]`

---

## فاز B — پایه‌ی فرانت‌اند (State + ساختار)

### تسک R4: لایه‌ی داده و لاغرسازی App.tsx
**راهنمای پیاده‌سازی فنی:**
1. `types.ts`: افزودن `EntityLink`, `ChatSession`, `ChatMessage`(جهت persist), `ExtractionProposal`، و گسترش `UsageStatus` با `remaining/monthly_quota/plan_code` (`§۳`).
2. `hooks/useDataManager.ts` (پیاده‌سازی واقعی): انتقال **همه‌ی** stateها و handlerهای CRUD از `App.tsx`؛ واکشی **صفحه‌بندی‌شده** (`loadInitial(range)` + `loadMore`) به‌جای `Promise.all` انبوه (ضدالگوی ۱۴)؛ حفظ Optimistic + race-guard؛ `injectActionResult`.
3. `contexts/DataContext.tsx` (جدید): Provide خروجی با هوک `useData()`.
4. `hooks/useRealtimeSync.ts` (جدید): انتقال ۶ کانال Realtime؛ همه با `filter: user_id=eq.<uid>`؛ dependency فقط `user.id`. **رفع تله‌ی Race Condition (اجباری):** در `useDataManager` فعلی بین Optimistic UI (مثلاً `handleAddTask`) و Realtime یک تداخل وجود دارد؛ اگر تسک ساخته شود و بلافاصله یک رویداد آپدیت (مثلاً ساخت چک‌لیست توسط تریگر) برسد، چکِ ساده‌ی `prev.some(t => t.id === newTask.id)` باعث می‌شود آپدیت Realtime نادیده (skip) گرفته شود. هندلر Realtime باید **Upsert/Merge** باشد: اگر آیتم در state وجود داشت آن را با دادهٔ تازه‌ی رویداد ادغام/جایگزین (update) کند، نه اینکه فقط به‌خاطر وجودِ id از آن صرف‌نظر کند. این منطق Merge برای هر ۶ entity یکسان رعایت شود.
5. `components/ui/ToastNotifications.tsx` (جدید): خروج کامپوننت inline از `App.tsx`؛ `removeNotification` با `useCallback`.
6. بازنویسی `App.tsx`: فقط `AuthProvider` + `DataProvider` + Routing + Global Modals + پردازش بازگشت پرداخت. هدف <۱۰۰ خط.

**محدودیت‌ها:** این تسک `App.tsx` را عمیق لمس می‌کند؛ هیچ تسک دیگری هم‌زمان آن را لمس نکند؛ رفتار فعلی (پیام فارسی، نوتیف، بازگشت زیبال) رگرسیون نخورد؛ فقط جابه‌جایی منطق + صفحه‌بندی (فیچرهای جدید در تسک‌های بعد).

`CONTEXT_FILES: ["App.tsx", "types.ts", "contexts/AuthContext.tsx", "hooks/useDataManager.ts", "services/taskService.ts", "services/noteService.ts", "services/projectService.ts", "services/habitService.ts", "services/billingService.ts"]`

---

### تسک R5: پاکسازی Utils و لایه‌ی سرویس (Anti-Pattern Sweep)
**راهنمای پیاده‌سازی فنی:**
1. `utils/dateUtils.ts`: توابع متمرکزِ **Asia/Tehran** (`getTehranDateString`, `isSameTehranDay`, مقایسه‌ی امن `due_date`)؛ رفع ریشه‌ای باگ timezone (ضدالگوی ۱۶).
2. `utils/imageUtils.ts` (جدید): انتقال `compressImage`, `dataURLtoBlob` از `ChatView` + try/catch.
3. `utils/taskGrouping.ts` (جدید): انتقال منطق گروه‌بندی تسک از `TasksView`.
4. `services/taskService.ts`: استفاده از `create_task_with_tags` با `p_checklist` (حذف insert+update دومرحله‌ای — ضدالگوی ۵)؛ **حذف `triggerVectorization`** (ضدالگوی ۱۵).
5. `services/noteService.ts`: **حذف `triggerVectorization`** (ضدالگوی ۱۵).
6. `services/supabaseClient.ts`: فقط `VITE_*` با fallback ایمن (ضدالگوی ۹).
7. `services/geminiService.ts`: تثبیت به‌عنوان **تنها** نقطه‌ی فراخوانی `ai-assistant` (ضدالگوی ۱۸)؛ توابع `sendChatMessage`, `searchSemantic`, `extractFromMedia`.

**محدودیت‌ها:** فقط utils و services (هیچ کامپوننتی)؛ خروجی سرویس‌ها سازگار با مصرف‌کننده‌ها بماند.

`CONTEXT_FILES: ["utils/dateUtils.ts", "services/taskService.ts", "services/noteService.ts", "services/supabaseClient.ts", "services/geminiService.ts", "components/ChatView.tsx", "components/TasksView.tsx", "supabase/functions/ai-assistant/index.ts"]`

---

## فاز C — مهاجرت Feature-Based + رفع باگ‌های UI/UX (هر View ایزوله)

### تسک R6: ماژول Dashboard (Split + رفع باگ‌ها)
**راهنمای پیاده‌سازی فنی:**
1. شکستن `components/Dashboard.tsx` به `features/dashboard/Dashboard.tsx` + `features/dashboard/components/{DashboardHeader, WeekCalendar, TodaysPlan, TodaysNotes, QuickCapture, StatsOverview, HabitTracker, KeyProjects}.tsx` (هر کامپوننت یک فایل — ضدالگوی ۱۱).
2. مصرف داده از `useData()` به‌جای prop (ضدالگوی ۱۲)؛ توابع تاریخ از `utils/dateUtils.ts`.
3. رفع باگ‌ها (`ARCHITECTURE.md §۶`): `pr-2`→`pl-2`؛ هماهنگی `todaysProgressStats` با `selectedDate`؛ مقایسه‌ی تاریخ با dateUtils؛ سرریز WeekCalendar روی ۳۲۰px؛ hit-area پروگرس‌رینگ.

**محدودیت‌ها:** فقط `features/dashboard/*`؛ منطق محاسباتی داخل کامپوننت نماند (ضدالگوی ۱۳).

`CONTEXT_FILES: ["components/Dashboard.tsx", "contexts/DataContext.tsx", "hooks/useDataManager.ts", "utils/dateUtils.ts", "components/icons.tsx"]`

---

### تسک R7: ماژول‌های Tasks و Notes + لینک دوطرفه
**راهنمای پیاده‌سازی فنی:**
1. `features/tasks/*` (TasksView, TaskCard, TaskEditorModal, hooks/useGroupedTasks.ts) و `features/notes/*` (NotesView, NoteCard, NoteEditorModal). مصرف از `useData()`.
2. **LinkNotePicker / LinkTaskPicker:** در ادیتور تسک دکمه‌ی «لینک یادداشت» → کادری که (الف) آیتم‌های همان روز را پیشنهاد و (ب) جستجوی عنوان دارد؛ انتخاب → `link_task_note`. در ادیتور یادداشت، عکسِ همین. نمایش لینک‌های موجود با حذف (`unlink_task_note`).
3. رفع باگ‌ها: دکمه‌ی حذف TasksView همیشه قابل‌دسترس (ضدالگوی ۱۹)؛ `dir="rtl"`؛ edge case `hasTime`.
   - **رفع باگ کیبورد مجازی موبایل (اجباری، در `TaskEditorModal` و `NoteEditorModal`):** به‌جای ارتفاع‌های ثابت یا `vh` (مثل `h-[50vh]`/`100vh` که با باز شدن کیبورد در iOS/Android محتوا را زیر کیبورد می‌برند)، از واحد داینامیک **`dvh`** استفاده شود. ساختار: ظرف بیرونی مودال `h-[100dvh] flex flex-col`؛ هدر و فوتر/دکمه‌ها ثابت (`shrink-0`)؛ ناحیه‌ی محتوا/Textarea با **`flex-1 overflow-y-auto`** تا با کوچک‌شدن viewport هنگام باز شدن کیبورد، فقط همین ناحیه اسکرول شود و فیلدِ فعال و دکمه‌ی ذخیره همیشه در دسترس بمانند.

**محدودیت‌ها:** لینک‌ها فقط از RPCهای R2 خوانده/نوشته شوند (هیچ منطق هاردکد)؛ وابسته به R2 و R5.

`CONTEXT_FILES: ["components/TasksView.tsx", "components/TaskEditorModal.tsx", "components/NotesView.tsx", "components/NoteEditorModal.tsx", "contexts/DataContext.tsx", "services/taskService.ts", "services/noteService.ts", "utils/taskGrouping.ts", "components/forms/PersianDatePicker.tsx", "components/TimePicker.tsx"]`

---

### تسک R8: ماژول‌های Projects، Habits و Billing (اشتراک، مصرف، یادآوری تمدید)
**راهنمای پیاده‌سازی فنی:**
1. `features/projects/*` (ProjectsView, ProjectCard, ProjectDetailsModal, utils/projectStats.ts): انتقال `calculateProjectStats`؛ رفع انیمیشن مودال (mount/unmount صحیح)؛ حذف dead code (`handleUpdateNote`).
2. `features/habits/*` (HabitEditorModal).
3. `features/billing/*`:
   - **`UsageMeter.tsx`** (جدید): مصرف امروز/دوره و باقی‌مانده از `get_usage_status` + `get_daily_usage` (قابلیت ۱).
   - **`SubscriptionPage.tsx`** (جدید): نوع پلن، تاریخ خرید (از `payments`)، انقضا، وضعیت، دکمه‌ی تمدید (قابلیت ۳).
   - **`RenewReminderModal.tsx`** (جدید): اگر تا انقضا ≤ N روز مانده، مودال تمدید؛ ضد-اذیت با `localStorage` (قابلیت ۲).
   - رفع `ProfileModal` `w-18`→`w-20`؛ چینش `PaywallModal` روی صفحه‌ی کوتاه.

**محدودیت‌ها:** مبالغ/مدل/سهمیه فقط از سرور (ضدالگوی ۳)؛ فعال‌سازی فقط با verify سمت سرور (ضدالگوی ۴)؛ وابسته به R2.

`CONTEXT_FILES: ["components/ProjectsView.tsx", "components/HabitEditorModal.tsx", "components/PaywallModal.tsx", "components/ProfileModal.tsx", "contexts/DataContext.tsx", "services/billingService.ts", "types.ts", "components/icons.tsx"]`

---

### تسک R9: ماژول Chat (تاریخچه‌ی روزانه + استخراج با تأیید + جلوه‌ی مدرن)
**راهنمای پیاده‌سازی فنی:**
1. `features/chat/ChatView.tsx` + `features/chat/components/{CitationCard, ActionResultCard, ModeChip, ProposalCard, ChatHistoryDrawer}.tsx` + `features/chat/hooks/useMediaRecorder.ts` (انتقال منطق صدا).
2. **تاریخچه:** پیام‌ها از `get_or_create_today_session` + `chat_messages` (پایان state گذرا). دکمه‌ی «چت‌های این ماه» → `ChatHistoryDrawer` با `get_chat_sessions`؛ نشست‌های قدیمی **فقط-خواندنی**؛ شروع روز جدید بر اساس Asia/Tehran (قابلیت ۷).
3. **استخراج با تأیید:** `proposals` در `ProposalCard` با «تأیید/حذف» تک‌به‌تک و «تأیید همه»؛ ذخیره فقط با تأیید (ضدالگوی ۱۷، قابلیت ۸).
4. **لینک هوشمند:** کارت‌های `suggest_link` با انتخاب کاربر → `link_task_note` (قابلیت ۶).
5. رفع باگ‌ها: حباب RTL (`user→rounded-tr-none`, `ai→rounded-tl-none`)؛ `input dir="rtl"`؛ Mode Chips با `flex-wrap`؛ همه‌ی فراخوانی AI از `geminiService` (ضدالگوی ۱۸).
6. **جلوه‌ی مدرن (نسل Z):** انیمیشن typing/streaming و ظاهر روان اکشن‌کارت‌ها.

**محدودیت‌ها:** صفر `supabase.functions.invoke` مستقیم در کامپوننت؛ صفر Base64 (ضدالگوی ۱۰)؛ وابسته به R1/R2/R3/R5.

`CONTEXT_FILES: ["components/ChatView.tsx", "contexts/DataContext.tsx", "services/geminiService.ts", "services/mediaService.ts", "utils/imageUtils.ts", "types.ts"]`

---

### تسک R10: مهاجرت کامپوننت‌های مشترک + Auth + جابه‌جایی نهایی
**راهنمای پیاده‌سازی فنی:**
1. مهاجرت: `components/ui/{Modal, NetworkBanner, ToastNotifications}`، `components/forms/{PersianDatePicker, TimePicker}`، `components/layout/BottomNav`، `components/icons/index.ts` (re-export). به‌روزرسانی همه‌ی مسیرهای import.
2. `features/auth/*`: `Auth.tsx` با `noValidate` + اعتبارسنجی دستی فارسی؛ `Onboarding.tsx` ذخیره‌ی `specialty/interests` در `profiles` + رفع type mismatch (`MouseEvent`).
3. `PersianDatePicker`: `direction-rtl`→`dir="rtl"`.
4. سوییپ نهایی: ابتدا حذف هر usage از مسیرهای قدیمی، سپس حذف importهای بلااستفاده.

**محدودیت‌ها:** این تسک مسیرهای import سراسری را تغییر می‌دهد؛ **آخر** اجرا شود؛ هیچ رفتار کاربری رگرسیون نخورد.

`CONTEXT_FILES: ["components/Auth.tsx", "components/Onboarding.tsx", "components/PersianDatePicker.tsx", "components/Modal.tsx", "components/NetworkBanner.tsx", "components/BottomNav.tsx", "components/icons.tsx", "App.tsx"]`

---

## نقشه‌ی وابستگی (Dependency Map)
```
R1 (schema) → R2 (rpc) → R3 (edge)
                   │
R4 (DataContext, App.tsx) ── باید قبل از R6..R9 ─┐
R5 (utils/services) ─────────────────────────────┤
                                                  ▼
        R6 Dashboard │ R7 Tasks/Notes+Link │ R8 Projects/Habits/Billing │ R9 Chat
                                                  ▼
                                            R10 (shared + auth + final)
```
> R4 تنها تسکی است که `App.tsx` را عمیق لمس می‌کند؛ R6–R9 روی پوشه‌های feature مجزا (ایزوله)؛ R10 آخر.
