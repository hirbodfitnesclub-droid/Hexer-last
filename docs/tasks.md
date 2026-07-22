# فاز U — تسک‌های تکرارشونده (Recurring Tasks + Δ UX)

> فقط تسک‌های **جدید** این فاز.
> مرجع: `docs/PROJECT.md` فاز U · `docs/ARCHITECTURE.md` §U.
> ترتیب اجباری: **U1 → U2 → U3 → U4 → U5 → U6 → U7 → U8 → U9 → U10 → U11**
> موازی روی فایل write مشترک ممنوع.
> کدنویس: Anti-Patternهای U-1…U-24 + قوانین O/K/L4 را لفظ‌به‌لفظ رعایت کن. حدس نزن فراتر از قرارداد.

---

## تسک U1: SQL — ستون‌های recurrence + RPC سازگار

### عنوان
افزودن `recurrence` / `recurrence_series_id` و گسترش idempotentِ `create_task_with_tags`.

### راهنمای پیاده‌سازی فنی
1. **فقط** `supabase/sql/51_task_recurrence.sql` (جدید). هیچ SQL قدیمی را ویرایش نکن.
2. Idempotent:
   - `ADD COLUMN IF NOT EXISTS recurrence JSONB DEFAULT NULL`
   - `ADD COLUMN IF NOT EXISTS recurrence_series_id UUID DEFAULT NULL`
   - ایندکس partial `(user_id, recurrence_series_id) WHERE recurrence_series_id IS NOT NULL`
3. RPC: DROP امضای ۸پارامتری فعلی (پس از 47) سپس CREATE با همان پارامترها +  
   `p_recurrence JSONB DEFAULT NULL`, `p_recurrence_series_id UUID DEFAULT NULL` در انتها.  
   INSERT هر دو ستون؛ `ON CONFLICT DO NOTHING`؛ `RETURN QUERY SELECT * … AND user_id = auth.uid()`.  
   `SECURITY DEFINER SET search_path = public`.
4. GRANT را فقط اگر الگوی 47/10 دارد mirror کن.
5. **ستون جدا برای end نساز** — end داخل JSONB است.
6. کامنت: اجرای دستی SQL Editor — بدون CLI.

### محدودیت‌ها
- باید: DEFAULT NULL · idempotent · AI create نشکند  
- نباید: جدول series · trigger · cron · فرانت

### CONTEXT_FILES
CONTEXT_FILES: ["supabase/sql/47_offline_idempotency.sql", "supabase/sql/03_core.sql", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

### DoD میکرو
- [ ] فایل 51 وجود دارد  
- [ ] دو ستون IF NOT EXISTS  
- [ ] ایندکس partial  
- [ ] RPC دو param آخر DEFAULT  
- [ ] INSERT هر دو ستون  
- [ ] scoped RETURN  
- [ ] هیچ SQL دیگری تغییر نکرده  

---

## تسک U2: Types + util کامل (normalize / end / describe / next / skip helpers)

### عنوان
`TaskRecurrence` + `TaskRecurrenceEnd` و کل API خالص `recurrenceUtils`.

### راهنمای پیاده‌سازی فنی
1. `types.ts`:
```ts
export type TaskRecurrenceEnd =
  | { kind: 'on_date'; date: string }
  | { kind: 'after_n'; remaining: number };

export type TaskRecurrence =
  | { type: 'daily'; end?: TaskRecurrenceEnd }
  | { type: 'weekly'; weekdays: number[]; end?: TaskRecurrenceEnd }
  | { type: 'monthly'; days: number[]; end?: TaskRecurrenceEnd }
  | { type: 'yearly'; dates: Array<{ month: number; day: number }>; end?: TaskRecurrenceEnd };

// on Task:
recurrence?: TaskRecurrence | null;
recurrence_series_id?: string | null;
```
2. `utils/recurrenceUtils.ts` — pure؛ import از `dateUtils` + `uuid` + types:
   - `normalizeRecurrence` (آرایه‌ها + end validate؛ invalid → null)
   - `isRecurring`
   - `hasExplicitDueTime(due)` — false اگر null یا تهران ۱۲:۰۰
   - `describeRecurrenceFa(r, { dueDate? })` — غنی:
     - daily: «هر روز» / «هر روز ساعت ۰۷:۳۰» فقط اگر explicit time
     - weekly: «هفته‌ای N بار · شنبه و چهارشنبه» (لیبل‌ها از WEEKDAYS_FA)
     - monthly: «روزهای ۱ و ۱۵ هر ماه»
     - yearly: «هر سال · ۱۲ فروردین» (persianMonths)
     - end: « · تا YYYY/MM/DD» (fa) یا « · N نوبت از این به‌بعد» که N = remaining+1
   - `computeNextDueDate` — daily/weekly/monthly(clamp)/yearly(jalali)؛ strict after anchor؛ copy wall-clock تهران
   - `canContinueRecurrence(r, nextDueIso)`
   - `buildNextRecurrence(r)` — clone؛ after_n: remaining-1 (کف 0)
   - `remainingOccurrencesLabel(r): string | null`
   - `resetChecklistItems`
   - `WEEKDAYS_FA` شنبه→جمعه
   - `tehranTodayNoonIso()`
   - `isRecurringDoneOlderThan(taskDue, today, days=14): boolean` helper برای U9 (pure date)
3. هیچ React/Supabase.

### محدودیت‌ها
- باید: pure · normalize بد→null · ۱۲:۰۰ بدون ساعت در describe  
- نباید: UI · rrule · Date.now برای id checklist  

### CONTEXT_FILES
CONTEXT_FILES: ["types.ts", "utils/dateUtils.ts", "utils/uuid.ts", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

### DoD میکرو
- [ ] types + end export  
- [ ] normalize sort/unique + end  
- [ ] describe غنی + end suffix + بدون ساعت در noon  
- [ ] canContinue on_date / after_n  
- [ ] buildNextRecurrence remaining--  
- [ ] computeNextDueDate daily فردا  
- [ ] tehranTodayNoonIso  
- [ ] بدون features/services import  

---

## تسک U3: taskService — select / whitelist / create RPC

### عنوان
عبور امن recurrence از لایه سرویس.

### راهنمای پیاده‌سازی فنی
1. فقط `services/taskService.ts`.
2. `TASK_SELECT` += `recurrence, recurrence_series_id`
3. `TASK_UPDATE_ALLOWED` += هر دو
4. `createTask` rpcParams: `p_recurrence`, `p_recurrence_series_id`
5. در sanitize: اگر `recurrence` present → `normalizeRecurrence`؛ null صریح مجاز
6. نه `select('*')`

### محدودیت‌ها
- باید: whitelist canonical  
- نباید: UI · SQL · useDataManager  

### CONTEXT_FILES
CONTEXT_FILES: ["services/taskService.ts", "types.ts", "utils/recurrenceUtils.ts", "docs/ARCHITECTURE.md"]

### DoD میکرو
- [ ] SELECT/ALLOWED/RPC هر دو فیلد  
- [ ] sanitize id strip  
- [ ] TS سالم  

---

## تسک U4: useDataManager — series · spawn · skip · series-patch · silent · toast

### عنوان
موتور دادهٔ تکرار (کامل).

### راهنمای پیاده‌سازی فنی
1. فقط `hooks/useDataManager.ts` (+ imports util).
2. **addTask(task, opts?: { silent?: boolean })**  
   - normalize recurrence؛ series_id = newId() اگر recurring و خالی؛ null اگر نه  
   - payload کامل  
   - اگر `!opts?.silent` همان notification موفقیت موجود؛ اگر silent هیچ success toast نزن (error همچنان OK)
3. **maybeSpawnNextRecurrence(completedTask)** (helper واحد):  
   canContinue + nextDue + guard same-day open series +  
   `addTask({…, recurrence: buildNextRecurrence(r), …}, { silent: true })`  
   سپس **یک** `addNotification(info)` با متن:  
   `نوبت بعدی ثبت شد · ${formatPersianDate(nextDue)}`  
   اگر سیستم notification از `action?: {label,onClick}` پشتیبانی می‌کند (بررسی `useDataManager` / Toast):  
   action «مشاهده» → `window.dispatchEvent(new CustomEvent('hexer:open-task-editor', { detail: newTask }))`  
   وگرنه فقط متن.
4. **toggleTaskCompletion** و **updateTask** (transition به done): بعد از apply، spawn. uncomplete: نه.
5. **skipRecurrenceOccurrence(id: string)** export از hook/context:  
   - load task؛ !done && recurring  
   - nextDue + canContinue؛ else return (اختیاری notification کوتاه اگر end)  
   - `updateTask({ id, due_date: nextDue, recurrence: buildNextRecurrence(r) })`  
   - **نه** status done · **نه** insert  
6. **updateTask series-from-now (۳.۱):**  
   اگر `payload` کلید `recurrence` دارد (حتی null):  
   - بعد از normalize روی task جاری  
   - اگر `recurrence_series_id` موجود: همهٔ tasks با همان series_id و `status !== 'done'` را در state با همان object recurrence (و series_id) merge کن؛ برای هر کدام به‌جز current یک `taskService.updateTask` / enqueue update بفرست (یا یک حلقه updateTask داخلی با فلگ جلوگیری از recursion — **مهم:** recursion را با `opts?: { skipSeriesFanOut?: boolean }` روی updateTask قطع کن).  
   - doneها دست‌نخورده  
7. export `skipRecurrenceOccurrence` از DataContext اگر pattern پروژه require می‌کند (همان فایل context را فقط در صورت نیاز به expose — ترجیح: context از قبل spread می‌کند؛ اگر نه، `contexts/DataContext.tsx` را **حداقلی** برای export اضافه کن — فقط اگر بدون آن consumer نمی‌تواند صدا بزند).  
   **قانون:** اگر DataContext فقط `...dataManager` می‌دهد، expose خودکار است؛ فایل context را بی‌جهت لمس نکن.
8. Offline: skip=update enqueue؛ spawn=insert silent.

### محدودیت‌ها
- باید: یک spawn helper · skip ≠ done · silent ضد double-toast · series fan-out فقط open  
- نباید: spawn در UI · AI · شکستن offline  

### CONTEXT_FILES
CONTEXT_FILES: ["hooks/useDataManager.ts", "contexts/DataContext.tsx", "utils/recurrenceUtils.ts", "utils/uuid.ts", "utils/dateUtils.ts", "types.ts", "services/taskService.ts", "docs/ARCHITECTURE.md"]

### DoD میکرو
- [ ] create recurring ⇒ series_id  
- [ ] complete ⇒ یک next + یک info toast (نه دو success)  
- [ ] skip ⇒ due جلو، status todo، بدون ردیف جدید  
- [ ] after_n/end ⇒ توقف spawn  
- [ ] update recurrence ⇒ همه openهای series؛ done نه  
- [ ] uncomplete spawn ندارد  
- [ ] offline paths سالم  

---

## تسک U5: RecurrencePickerModal + RepeatIcon (type · end · preview · validation · a11y)

### عنوان
مودال تکرار کامل UX اپل‌مانند.

### راهنمای پیاده‌سازی فنی
1. `components/icons.tsx`: `RepeatIcon` SVG stroke.
2. `features/tasks/components/RecurrencePickerModal.tsx`:
   - Props: `isOpen`, `value`, `onChange`, `onClose`, `anchorDueDate?: string | null`
   - z-[70] · draft state on open · module-level subcomponents only  
   - Type rows: بدون تکرار / هر روز / برخی روزهای هفته / ماه / سال  
   - weekly: WEEKDAYS_FA checks ≥۴۴px  
   - monthly: grid 1–31 + hint clamp  
   - yearly: month+day selects + add/remove rows  
   - **End section:**  
     - UI state: `'never' | 'on_date' | 'after_n'`  
     - on_date: `PersianDatePicker` موجود  
     - after_n: number input 1..999 (نمایش N به کاربر؛ روی confirm: `remaining = N-1`)  
   - **Preview:** اگر draft normalize‌پذیر:  
     `next = computeNextDueDate(anchorDueDate ?? tehranTodayNoonIso(), draft)`  
     اگر next && canContinue → «نوبت بعدی: {fa date}{ time?}»  
     اگر !canContinue → «با این تنظیمات نوبت بعدی ساخته نمی‌شود»  
   - Confirm disabled اگر weekly/monthly/yearly عضو صفر  
   - متن خطای validation فارسی کوتاه  
   - Footer انصراف / تأیید  
   - dir=rtl · tokens · pb-safe · scroll داخلی  
3. **نه** TaskEditor در این تسک.

### محدودیت‌ها
- باید: preview · end · disabled invalid · module-scope  
- نباید: DB write · component-in-render · library  

### CONTEXT_FILES
CONTEXT_FILES: ["components/icons.tsx", "components/PersianDatePicker.tsx", "utils/recurrenceUtils.ts", "utils/dateUtils.ts", "types.ts", "features/tasks/components/TaskEditorModal.tsx", "docs/ARCHITECTURE.md"]

### DoD میکرو
- [ ] RepeatIcon  
- [ ] 4 types + clear + end 3 modes  
- [ ] preview next  
- [ ] empty selection blocks confirm  
- [ ] remaining = N-1 mapping  
- [ ] z-index > editor  
- [ ] light/dark tokens  

---

## تسک U6: TaskEditorModal — wire · auto-due · skip CTA · راهنما

### عنوان
اتصال کامل مودال تسک زنده.

### راهنمای پیاده‌سازی فنی
1. فقط `features/tasks/components/TaskEditorModal.tsx`.
2. import picker, icon, describe, normalize, tehranTodayNoonIso؛ `skipRecurrenceOccurrence` از `useData`.
3. PropertyRow تکرار (edit/create) + clear (null recurrence + null series_id در form).
4. خط راهنما زیر ردیف: «قانون تکرار از این نوبت به بعد اعمال می‌شود.»
5. **۴.۲ auto-due:** وقتی از picker `onChange` غیرnull آمد و (`!hasDate` یا !formState.due_date):  
   `setHasDate(true)`; `setFormState due_date = tehranTodayNoonIso()`؛ hasTime را false نگه دار مگر کاربر ساعت داشته.
6. RecurrencePickerModal با `anchorDueDate={formState.due_date}`.
7. **view:** کارت خلاصه `describeRecurrenceFa(r, { dueDate })`؛ اگر recurring && status≠done دکمه «رد کردن این نوبت» → await skipRecurrenceOccurrence(id) سپس formState را با due/recurrence جدید sync کن (از return یا re-read — اگر skip void است، optimistic local set due+recurrence مثل buildNext).
8. `buildTaskWritePayload` + recurrence/series_id.
9. partial toggles بدون strip recurrence.

### محدودیت‌ها
- باید: auto-due · skip CTA در view · payload  
- نباید: spawn اینجا · legacy components/  

### CONTEXT_FILES
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/tasks/components/RecurrencePickerModal.tsx", "utils/recurrenceUtils.ts", "components/icons.tsx", "types.ts", "contexts/DataContext.tsx", "docs/ARCHITECTURE.md"]

### DoD میکرو
- [ ] picker باز/ذخیره  
- [ ] enable recurrence بدون تاریخ → due امروز  
- [ ] view summary + skip  
- [ ] clear  
- [ ] write payload  
- [ ] no phase-O regression  

---

## تسک U7: TaskCard badge تکرار

### عنوان
نشان تکرار روی کارت لیست کارها.

### راهنمای پیاده‌سازی فنی
1. فقط `features/tasks/components/TaskCard.tsx`.
2. اگر `task.status !== 'done'` و `normalizeRecurrence(task.recurrence)`:  
   در ردیف meta (کنار due/checklist) chip:  
   `RepeatIcon` w-3 + `describeRecurrenceFa(r)` با `truncate max-w-[9rem]` یا ellipsis CSS.  
3. tokens؛ بدون منطق nextDue.

### محدودیت‌ها
- نباید: onToggle behavior change · done badge اجباری  

### CONTEXT_FILES
CONTEXT_FILES: ["features/tasks/components/TaskCard.tsx", "utils/recurrenceUtils.ts", "components/icons.tsx", "types.ts"]

### DoD میکرو
- [ ] badge فقط todo recurring  
- [ ] truncate بدون overflow افقی کارت  
- [ ] RTL  

---

## تسک U8: TodaysPlan badge + invariant بصری

### عنوان
نشان تکرار در برنامه امروز؛ اطمینان از فیلتر due.

### راهنمای پیاده‌سازی فنی
1. فقط `features/dashboard/components/TodaysPlan.tsx`.
2. روی هر سطر task (meta): همان badge الگوی TaskCard (Repeat + short describe) اگر recurring && !done.
3. **فیلتر due را عوض نکن** (`isSameTehranDay`). هیچ «virtual next» اضافه نکن.
4. import icon + util.

### محدودیت‌ها
- نباید: local TaskEditor · تغییر toggle  

### CONTEXT_FILES
CONTEXT_FILES: ["features/dashboard/components/TodaysPlan.tsx", "utils/recurrenceUtils.ts", "components/icons.tsx", "types.ts"]

### DoD میکرو
- [ ] badge روی سطر امروز  
- [ ] فیلتر روز دست‌نخورده  
- [ ] layout موبایل نشکند  

---

## تسک U9: TasksView — collapse doneهای تکراری قدیمی (۱۴ روز)

### عنوان
آرشیو UIی completedهای تکراری کهنه‌تر از ۱۴ روز تقویم تهران.

### راهنمای پیاده‌سازی فنی
1. فقط `features/tasks/TasksView.tsx` (و در صورت نیاز pure helper از recurrenceUtils — از U2).
2. هنگام رندر `group.completed`:  
   - `today = getTehranDateString()`  
   - `isOld = status done && isRecurring(normalize(recurrence)) && due tehran day <= today-14`  
   - `recentCompleted` / `oldRecurringCompleted`  
3. recent را مثل قبل نشان بده.  
4. اگر old.length>0 و `!searchQuery.trim()`:  
   `CollapsibleSection` موجود (default collapsed) با title  
   `تکراری‌های قدیمی‌تر (${old.length})`  
5. اگر search فعال: همه completed بدون age filter (یافت‌پذیری).
6. **حذف DB نکن.**

### محدودیت‌ها
- باید: default collapsed · search bypass  
- نباید: تغییر groupTasks contract مگر لازم حداقلی داخل view  

### CONTEXT_FILES
CONTEXT_FILES: ["features/tasks/TasksView.tsx", "utils/recurrenceUtils.ts", "utils/dateUtils.ts", "utils/taskGrouping.ts", "types.ts"]

### DoD میکرو
- [ ] done recurring >14d در سکشن جدا collapsed  
- [ ] search همه را نشان می‌دهد  
- [ ] non-recurring old completed رفتار قبلی  

---

## تسک U10: useReminderScheduler — سازگاری occurrence جدید (۴.۱)

### عنوان
تأیید/تنظیم حداقلی یادآور برای سری.

### راهنمای پیاده‌سازی فنی
1. فقط `hooks/useReminderScheduler.ts` در صورت نیاز.
2. **الزام رفتاری:** فیلتر `status!=='done' && due today` بماند — occurrence جدید با id+due جدید خودکار qualify می‌شود.
3. **تغییر مجاز حداقلی:** اگر `isRecurring(task.recurrence)`، body پیش‌فرض را به  
   `یادآور کار تکراری` یا `task.description || 'زمان انجام این کار تکراری فرا رسیده است.'`  
   تغییر بده — بدون spam permission، بدون messageId scheme break (`task-${id}-${dueMs}` بماند).
4. اگر کد فعلی بدون تغییر هم قرارداد را满足 می‌کند، فقط body tweak یا **no-op با کامنت ارجاع به §U** — ولی فایل را در PR ذکر کن که review شده.

### محدودیت‌ها
- نباید: auto-prompt · VAPID/SQL · tag بدون id  

### CONTEXT_FILES
CONTEXT_FILES: ["hooks/useReminderScheduler.ts", "utils/recurrenceUtils.ts", "services/reminderService.ts", "docs/ARCHITECTURE.md"]

### DoD میکرو
- [ ] occurrence بعدی با due امروز+time نوتیف می‌گیرد (QA)  
- [ ] messageId per task id+dueMs  
- [ ] permission guard پابرجا  

---

## تسک U11: Handoff — CURRENT_TASK smoke matrix نهایی

### عنوان
به‌روزرسانی `docs/CURRENT_TASK.md` با وضعیت و ماتریس QA کامل (اگر کدنویس آخر است؛ وگرنه معمار از قبل نوشته — **این تسک فقط وقتی coding U1–U10 تمام شد** status را COMPLETE می‌کند).

### راهنمای پیاده‌سازی فنی
1. فقط `docs/CURRENT_TASK.md`.
2. Status banner: coding status per U1–U10.
3. Smoke rows همه U-QA* را ☐/☑ کن بر اساس واقعیت — دروغ نگو.

### CONTEXT_FILES
CONTEXT_FILES: ["docs/CURRENT_TASK.md", "docs/tasks.md", "docs/ARCHITECTURE.md"]

### DoD میکرو
- [ ] banner به‌روز  
- [ ] هیچ QA دروغین pass نشده  

---

## ترتیب اجرا

1. U1 SQL  
2. U2 types+util  
3. U3 service  
4. U4 data manager (spawn/skip/series/toast)  
5. U5 picker UI  
6. U6 editor wire  
7. U7 TaskCard badge  
8. U8 TodaysPlan badge  
9. U9 TasksView archive  
10. U10 reminders  
11. U11 handoff  

**موازی ممنوع** روی write مشترک. U7∥U8 بعد از U2 از نظر type ممکن است اما بعد از U5 icon؛ ترتیب بالا امن‌ترین است.

---

## معیار پذیرش نهایی فاز U (انسان / QA)

1. SQL 51 دوبار اجرا بدون خطا؛ AI create بدون recurrence OK.  
2. daily/weekly/monthly/yearly + clear + end date + end after N.  
3. preview و validation خالی.  
4. complete → next؛ skip → due جلو بدون done؛ end → توقف.  
5. enable تکرار بدون تاریخ → due امروز.  
6. badge در TaskCard و TodaysPlan.  
7. یک toast بعد از spawn.  
8. series recurrence edit روی همه openها.  
9. یادآور occurrence جدید.  
10. complete daily ⇒ از TodaysPlan امروز به‌عنوان active نمی‌ماند؛ next فردا.  
11. done recurring >14d collapsed.  
12. offline flush.  
13. بدون npm جدید؛ بدون SQL قدیمی edit.  
