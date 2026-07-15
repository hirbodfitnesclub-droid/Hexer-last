


# فاز N — پایداری UX: فونت یکپارچه، Toast، آندو، باگ‌های تسک و فوکوس

> مرجع: `docs/PROJECT.md §N` و `docs/ARCHITECTURE.md §N`.
> قانون طلایی: هیچ RPC/جدول/Edge Function/فایل جدیدی ساخته نمی‌شود.
> **توالی اجرا:** N-1 تا N-5 و N-6 مستقل‌اند (موازی‌پذیر). N-7 باید بعد از N-4 اجرا شود (هر دو روی `TaskEditorModal.tsx`).

---

### تسک N-1: یکپارچه‌سازی فونت Vazirmatn FD و رندر اعداد فارسی

**عنوان:** تغییر نسخه‌ی فونت از Vazirmatn به Vazirmatn FD و تنظیم fontFamily در Tailwind.

**راهنمای پیاده‌سازی فنی:**
1. در `index.html`، لینک گوگل فونت را از:
   `https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap`
   به:
   `https://fonts.googleapis.com/css2?family=Vazirmatn+FD:wght@300;400;500;600;700&display=swap`
   تغییر بده. همچنین `<link rel="preconnect">` ها را نگه دار.

2. در همان `index.html`، داخل بلوک `tailwind.config = { ... theme: { extend: { ... } } }` یک کلیدِ `fontFamily` اضافه کن:
```js
fontFamily: {
  sans: ['"Vazirmatn FD"', 'Vazirmatn', 'sans-serif'],
  mono: ['"Vazirmatn FD"', 'Vazirmatn', 'monospace'],
}
```
(توجه: نام فونت با فاصله در quotes قرار می‌گیرد)

3. در بلوک `<style>` داخل `<head>`، مقدار `font-family: 'Vazirmatn', sans-serif` را به `font-family: 'Vazirmatn FD', 'Vazirmatn', sans-serif` تغییر بده.

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `index.html` تغییر کند. هیچ کامپوننتی لمس نشود.
- **نباید:** وزن‌های فونت (300;400;500;600;700) تغییر کنند.
- **نباید:** هیچ کتابخانه یا پکیج جدیدی نصب شود.
- **نباید:** `toLocaleString('fa-IR')` در کامپوننت‌ها اضافه یا حذف شود (فونت این کار را خودکار انجام می‌دهد).

**معیار پذیرش میکرو:**
- در مرورگر، تایمر FocusTimer (`25:00`)، درصد ProductivityChart، و تاریخ‌های PersianDatePicker همگی با ارقام فارسی (۲۵:۰۰، ٪، ۱) نمایش داده می‌شوند.
- هیچ صفحه‌ای کرش یا خالی نمی‌شود.
- فونت در هر مودال و صفحه یکدست Vazirmatn است.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["index.html"]
```

---

### تسک N-2: اصلاح موقعیت Toast بالای BottomNav

**عنوان:** رفع تداخل Toast با BottomNav در موبایل و اصلاح position در RTL.

**راهنمای پیاده‌سازی فنی:**
1. در `components/ui/ToastNotifications.tsx`، کلاس container را از:
   `"fixed bottom-24 right-4 z-[100] w-full max-w-sm space-y-3"`
   به:
   `"fixed z-[100] w-full max-w-sm space-y-3 left-4 right-4 mx-auto"`
   با `style={{ bottom: 'calc(var(--bottom-nav-space, 5rem) + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}`
   تغییر بده.

   **توضیح:** به‌جای کلاس `bottom-24` که ثابت است، از CSS variable `--bottom-nav-space` (تعریف‌شده در `index.css` = 5rem) استفاده می‌کنیم تا Toast همیشه بالای BottomNav باشد. `left-4 right-4 mx-auto` باعث می‌شود Toast در وسط صفحه قرار بگیرد (نه چسبیده به یک طرف) که برای RTL طبیعی‌تر است.

2. اطمینان حاصل کن که `id="toast-container"` روی container حفظ شود.

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `components/ui/ToastNotifications.tsx` تغییر کند.
- **نباید:** استایل‌های هر toast card (رنگ، فونت، محتوا) تغییر کند.
- **نباید:** `z-[100]` تغییر کند.

**معیار پذیرش میکرو:**
- در موبایل، Toast بالای BottomNav نمایش داده می‌شود و کاملاً قابل خواندن است.
- در دسکتاپ هم Toast در جای مناسب است.
- action «لغو» (که در N-3 اضافه می‌شود) روی Toast قابل کلیک است.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["components/ui/ToastNotifications.tsx", "index.css"]
```

---

### تسک N-3: آندو ۳ ثانیه‌ای برای همه‌ی عملیات حذف

**عنوان:** افزودن مکانیزم undo با سیستم notification موجود به تمام handler‌های delete.

**راهنمای پیاده‌سازی فنی:**
تمام تغییرات فقط در `hooks/useDataManager.ts` است.

**برای هر یک از این ۴ handler: `deleteTask`, `deleteNote`, `deleteProject`, `deleteHabit`:**

1. ابتدا یک ارجاع به آیتمی که حذف می‌شود ذخیره کن.
2. state را optimistically آپدیت کن (مثل الان) و snapshot ذخیره کن.
3. به‌جای ارسال فوری به DB، یک `setTimeout` 3000ms بساز که commit واقعی را انجام می‌دهد.
4. `addNotification` را با یک `action` برای undo صدا بزن.
5. در action.onClick: `clearTimeout(timeoutId)` + rollback state + rollback snapshot.

**نمونه برای `deleteTask`:**
```typescript
const deleteTask = useCallback(async (id: string) => {
  const taskToDelete = tasks.find(t => t.id === id);
  if (!taskToDelete) return;

  const originalTasks = [...tasks];
  const nextTasks = tasks.filter(t => t.id !== id);
  setTasks(nextTasks);
  await saveSnapshot(userId, 'tasks', nextTasks);

  const commitDelete = async () => {
    if (!navigator.onLine) {
      await enqueue({ id, entity: 'tasks', action: 'delete', payload: null });
      return;
    }
    try {
      await taskService.deleteTask(id);
    } catch (error) {
      setTasks(originalTasks);
      await saveSnapshot(userId, 'tasks', originalTasks);
      addNotification('خطا در حذف کار.', 'error');
    }
  };

  const timeoutId = setTimeout(commitDelete, 3000);

  addNotification(
    `کار «${taskToDelete.title.substring(0, 20)}» حذف شد.`,
    'info',
    {
      label: 'لغو',
      onClick: async () => {
        clearTimeout(timeoutId);
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
      }
    }
  );
}, [tasks, userId, addNotification]);
```

**همین pattern را دقیقاً برای `deleteNote`, `deleteProject`, `deleteHabit` هم پیاده کن.** نام آیتم برای note: `noteToDelete.title`, برای project: `projectToDelete.title`, برای habit: `habitToDelete.name`.

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `hooks/useDataManager.ts` تغییر کند.
- **نباید:** هیچ Context جدیدی ساخته شود.
- **نباید:** سرویس‌های `taskService`/`noteService`/... تغییر کنند.
- **نباید:** `addNotification` در `useDataManager` تغییر کند (duration آن همان ۵ ثانیه می‌ماند که کافی است چون undo ۳ ثانیه است).
- **باید:** در هر handler، قبل از commit به DB، آنلاین بودن چک شود (مثل الان).

**معیار پذیرش میکرو:**
- بعد از حذف هر تسک/یادداشت/پروژه/عادت، آیتم از UI برمی‌دارد و یک notification با دکمه‌ی «لغو» نمایش می‌دهد.
- اگر «لغو» زده شود (قبل از ۳ ثانیه)، آیتم به UI برمی‌گردد و هیچ request به DB نمی‌رود.
- اگر ۳ ثانیه بگذرد و لغو نشود، آیتم در DB حذف می‌شود.
- رگرسیون در عملکرد offline/outbox رخ نمی‌دهد.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["hooks/useDataManager.ts", "services/taskService.ts", "services/noteService.ts", "services/projectService.ts"]
```

---

### تسک N-4: رفع باگ ذخیره‌ی دوم تسک (sanitization در handleSave)

**عنوان:** اصلاح `handleSave` در `TaskEditorModal` با sanitization صریح payload قبل از ارسال.

**راهنمای پیاده‌سازی فنی:**
فقط در `features/tasks/components/TaskEditorModal.tsx`:

در تابع `handleSave` (حدود خط ۱۴۴)، قبل از صدا کردن `onSave`، `formState` را به یک payload تمیز تبدیل کن:

```typescript
const handleSave = async () => {
  if (!formState.title?.trim()) return;

  let finalDueDate: string | null = null;

  if (hasDate && formState.due_date) {
    const dateObj = new Date(formState.due_date);
    if (hasTime) {
      const [h, m] = selectedTime.split(':').map(Number);
      dateObj.setHours(h, m, 0, 0);
    } else {
      dateObj.setHours(12, 0, 0, 0);
    }
    finalDueDate = dateObj.toISOString();
  }

  // Sanitization: فقط فیلدهای معتبر DB را ارسال کن
  const cleanPayload: Partial<Task> & { title: string } = {
    title: formState.title.trim(),
    description: formState.description ?? null,
    status: formState.status,
    priority: formState.priority ?? Priority.Medium,
    due_date: finalDueDate,
    project_id: formState.project_id ?? null,
    tags: Array.isArray(formState.tags) ? formState.tags : [],
    checklist: Array.isArray(formState.checklist) ? formState.checklist : [],
    completed_at: formState.completed_at ?? null,
  };
  if (formState.id) {
    cleanPayload.id = formState.id;
  }

  try {
    const savedTask = await onSave(cleanPayload);
    if (isNew && savedTask?.id && pendingLinkIds.length > 0) {
      for (const noteId of pendingLinkIds) {
        await linkTaskNote(savedTask.id, noteId);
      }
    }
  } catch (err) {
    console.error('Error saving task and committing links:', err);
  }
  onClose();
};
```

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `handleSave` تغییر کند. بقیه‌ی کامپوننت دست‌نخورده بماند.
- **نباید:** امضای `onSave` prop تغییر کند.
- **نباید:** منطق لینک‌کردن یادداشت‌ها (pendingLinkIds) تغییر کند.
- **باید:** همه‌ی فیلدهای `Task` که در DB ذخیره می‌شوند (title، description، status، priority، due_date، project_id، tags، checklist، completed_at) در cleanPayload حضور داشته باشند.

**معیار پذیرش میکرو:**
- ویرایش یک تسک برای اولین بار: ذخیره موفق.
- باز کردن همان تسک و ویرایش دوباره (هر نوع تغییری — ساب‌تسک جدید، تغییر پروژه، تغییر تاریخ): ذخیره موفق بدون خطا.
- ویرایش سوم و چندم: همچنان موفق.
- هیچ رگرسیونی در ساخت تسک جدید یا لینک یادداشت رخ نمی‌دهد.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "services/taskService.ts", "types.ts"]
```

---

### تسک N-5: فوکوس مود — فقط تسک‌های امروز در picker

**عنوان:** فیلتر `activeTasks` در `FocusTimer` برای نمایش فقط تسک‌های روز جاری.

**راهنمای پیاده‌سازی فنی:**
فقط در `features/dashboard/components/FocusTimer.tsx`:

1. در بالای فایل، `isSameTehranDay` را از `utils/dateUtils` ایمپورت کن:
```typescript
import { isSameTehranDay } from '../../../utils/dateUtils';
```

2. `activeTasks` useMemo را از:
```typescript
const activeTasks = useMemo(() => {
  return tasks.filter((t) => t.status !== 'done');
}, [tasks]);
```
به:
```typescript
const activeTasks = useMemo(() => {
  const today = new Date();
  return tasks.filter((t) => {
    if (t.status === 'done') return false;
    // تسک‌های بدون تاریخ همیشه نشان داده می‌شوند
    if (!t.due_date) return true;
    // فقط تسک‌های امروز
    return isSameTehranDay(t.due_date, today);
  });
}, [tasks]);
```
تغییر بده.

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `activeTasks` useMemo تغییر کند.
- **نباید:** هیچ چیز دیگری در این فایل تغییر کند (این تسک).
- **نباید:** ساختار task picker modal تغییر کند.

**معیار پذیرش میکرو:**
- در task picker، فقط تسک‌هایی که due_date امروز دارند (یا due_date ندارند) نمایش داده می‌شوند.
- گزینه‌های سریع («تمرکز آزاد» و «مطالعه و یادگیری») همچنان نمایش دارند.
- اگر تسکی برای امروز وجود نداشت، پیام «کار فعالی یافت نشد» نمایش داده می‌شود.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/FocusTimer.tsx", "utils/dateUtils.ts"]
```

---

### تسک N-6: اصلاح نمودار بهره‌وری — تاریخچه‌ی immutable برای روزهای گذشته

**عنوان:** محاسبه‌ی نمودار روزهای گذشته بر اساس `completed_at` نه `due_date`.

**راهنمای پیاده‌سازی فنی:**
فقط در `features/dashboard/components/ProductivityChart.tsx`:

`weekData` useMemo را به‌طور کامل با منطق زیر جایگزین کن:

```typescript
const weekData = useMemo(() => {
  const today = new Date();
  return weekDays.map((day) => {
    const isToday = isSameTehranDay(day, today);

    if (isToday) {
      // امروز: محاسبه‌ی معمول بر اساس due_date
      const dayTasks = tasks.filter((t) => t.due_date && isSameTehranDay(t.due_date, day));
      const completedCount = dayTasks.filter((t) => t.status === 'done').length;
      const progress = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;
      return { day, progress, isToday: true };
    } else {
      // روزهای گذشته: فقط بر اساس completed_at (تاریخچه‌ی واقعی — immutable)
      const completedOnDay = tasks.filter(
        (t) => t.completed_at && isSameTehranDay(t.completed_at, day)
      ).length;
      // نرمال‌سازی: target روزانه = ۵ تسک
      const DAILY_TARGET = 5;
      const progress = Math.min(100, Math.round((completedOnDay / DAILY_TARGET) * 100));
      return { day, progress, isToday: false };
    }
  });
}, [tasks, weekDays]);
```

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `weekData` useMemo تغییر کند.
- **نباید:** `weeklyRate` یا `monthlyRate` useMemo تغییر کنند.
- **نباید:** هیچ تغییری در SVG، رنگ‌ها، مسیر منحنی (pathD) یا layout.
- **نباید:** کتابخانه‌ی جدیدی اضافه شود.
- **باید:** `isSameTehranDay` از `utils/dateUtils` ایمپورت شده باشد (از قبل در فایل موجود است، import اضافی لازم نیست).

**معیار پذیرش میکرو:**
- نمودار روزهای گذشته وقتی تسکی از آن روز به امروز جابه‌جا می‌شود **تغییر نمی‌کند**.
- نمودار امروز همچنان بر اساس due_date محاسبه می‌شود.
- اگر کاربر در روزی تسک‌هایی تکمیل کرده، آن روز درصد نمایش می‌دهد.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/ProductivityChart.tsx", "utils/dateUtils.ts", "types.ts"]
```

---

### تسک N-7: رفع بسته شدن مودال + ویرایش زمان تایمر + دکمه استراحت زودهنگام

**عنوان:** رفع event propagation ساب‌تسک + زمان قابل تنظیم تایمر + دکمه‌ی رفتن زودهنگام به استراحت.

**این تسک شامل دو فایل است که باید به‌ترتیب ویرایش شوند:**

#### بخش الف — رفع بسته شدن مودال (`features/tasks/components/TaskEditorModal.tsx`)
این تسک **باید بعد از N-4 اجرا شود** چون N-4 هم همین فایل را ویرایش می‌کند.

در بخش «Checklist View» (mode === 'view')، روی هر دکمه‌ی checkbox ساب‌تسک، `e.stopPropagation()` اضافه کن:

پیدا کن:
```tsx
<button 
  onClick={() => handleToggleChecklistItem(item.id)}
```
تبدیل کن به:
```tsx
<button 
  onClick={(e) => { e.stopPropagation(); handleToggleChecklistItem(item.id); }}
```
**دقت کن:** این تغییر فقط روی دکمه‌های checkbox ساب‌تسک در view mode است، نه در edit mode.

#### بخش ب — ویرایش زمان تایمر و دکمه‌ی استراحت زودهنگام (`features/dashboard/components/FocusTimer.tsx`)
این تسک **باید بعد از N-5 اجرا شود** چون N-5 هم همین فایل را ویرایش می‌کند.

**۱. اضافه کردن state‌های قابل تنظیم:**
```typescript
// زیر import‌ها، قبل از const FocusTimer:
const STORED_FOCUS_KEY = 'hexer-focus-minutes';
const STORED_BREAK_KEY = 'hexer-break-minutes';

// داخل کامپوننت، بعد از سایر state‌ها:
const [focusMinutes, setFocusMinutes] = useState(() => {
  const stored = localStorage.getItem(STORED_FOCUS_KEY);
  const val = stored ? parseInt(stored, 10) : 25;
  return isNaN(val) || val < 1 ? 25 : Math.min(99, val);
});
const [breakMinutes, setBreakMinutes] = useState(() => {
  const stored = localStorage.getItem(STORED_BREAK_KEY);
  const val = stored ? parseInt(stored, 10) : 5;
  return isNaN(val) || val < 1 ? 5 : Math.min(99, val);
});
const [isEditingTimer, setIsEditingTimer] = useState(false);
```

**۲. تبدیل ثابت‌ها به متغیرهای محاسباتی:**
خطوط `const FOCUS_SECONDS = 25 * 60;` و `const BREAK_SECONDS = 5 * 60;` را پیدا کن و:
```typescript
// قبل:
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
// بعد:
const FOCUS_SECONDS = focusMinutes * 60;
const BREAK_SECONDS = breakMinutes * 60;
```

**۳. اضافه کردن هندلرهای ذخیره‌سازی:**
```typescript
const handleSaveFocusMinutes = (val: number) => {
  const clamped = Math.max(1, Math.min(99, val));
  setFocusMinutes(clamped);
  localStorage.setItem(STORED_FOCUS_KEY, String(clamped));
  if (!isBreak) {
    setTimeLeft(clamped * 60);
    setIsRunning(false);
  }
};
const handleSaveBreakMinutes = (val: number) => {
  const clamped = Math.max(1, Math.min(99, val));
  setBreakMinutes(clamped);
  localStorage.setItem(STORED_BREAK_KEY, String(clamped));
  if (isBreak) {
    setTimeLeft(clamped * 60);
    setIsRunning(false);
  }
};
```

**۴. افزودن دکمه‌ی settings و mini-panel ویرایش در ویجت اصلی:**
در «Top Row» (بالای ویجت، بعد از عنوان)، یک دکمه‌ی settings کوچک اضافه کن:
```tsx
<button
  onClick={() => setIsEditingTimer(v => !v)}
  className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition"
  title="تنظیم زمان"
>
  <SettingsIcon className="w-3.5 h-3.5" />
</button>
```
(SettingsIcon از `components/icons.tsx` ایمپورت کن — اگر وجود ندارد از `ChevronDownIcon` با کلاس دیگر استفاده کن)

Mini-panel ویرایش (بلافاصله زیر Top Row):
```tsx
{isEditingTimer && (
  <div className="flex gap-3 z-10 mt-1 bg-white/5 rounded-xl p-2.5" onClick={e => e.stopPropagation()}>
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-[9px] text-white/40 font-bold">فوکوس (دقیقه)</span>
      <input
        type="number"
        min="1" max="99"
        value={focusMinutes}
        onChange={e => handleSaveFocusMinutes(parseInt(e.target.value) || 1)}
        className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-primary"
      />
    </div>
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-[9px] text-white/40 font-bold">استراحت (دقیقه)</span>
      <input
        type="number"
        min="1" max="99"
        value={breakMinutes}
        onChange={e => handleSaveBreakMinutes(parseInt(e.target.value) || 1)}
        className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-primary"
      />
    </div>
  </div>
)}
```

**۵. دکمه‌ی رفتن زودهنگام به استراحت در zen mode:**
در بخش «Bottom Controls» داخل zen mode overlay (بعد از دکمه‌ی پلی/پاز)، یک دکمه‌ی «رفتن به استراحت» اضافه کن که فقط وقتی `!isBreak` نمایش دارد:
```tsx
{!isBreak && (
  <button
    onClick={handleToggleMode}
    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-xs font-bold text-white/60 hover:text-white transition active:scale-95 cursor-pointer"
    title="رفتن زودهنگام به استراحت"
  >
    استراحت زودهنگام
  </button>
)}
```

**محدودیت‌های اختصاصی تسک:**
- **باید:** N-4 قبل از بخش الف این تسک اجرا شده باشد.
- **باید:** N-5 قبل از بخش ب این تسک اجرا شده باشد.
- **نباید:** منطق تایمر (setInterval، useEffect) تغییر کند.
- **نباید:** SettingsIcon اگر در `icons.tsx` وجود ندارد، فایل `icons.tsx` را تغییر بده — از یک آیکون موجود دیگر مثل `PencilIcon` استفاده کن.
- **نباید:** localStorage برای هیچ داده‌ی دائمی غیر از این دو تنظیم استفاده شود (طبق Anti-Pattern §۸).
- **باید:** مقادیر focusMinutes/breakMinutes بعد از رفرش صفحه حفظ شوند.

**معیار پذیرش میکرو:**
- تیک زدن ساب‌تسک در view mode مودال را نمی‌بندد.
- با کلیک روی آیکون settings، دو input عددی نمایش داده می‌شود.
- تغییر عدد فوکوس به ۳۰: تایمر ریست می‌شود به ۳۰:۰۰ (اگر در حالت focus بودیم).
- بعد از رفرش، مقادیر ذخیره‌شده حفظ می‌شوند.
- در zen mode، دکمه‌ی «استراحت زودهنگام» فقط در حالت focus نمایش دارد و با کلیک، تایمر به break mode سوییچ می‌کند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/dashboard/components/FocusTimer.tsx", "components/icons.tsx", "utils/dateUtils.ts"]
```

---

## ترتیب اجرای توصیه‌شده‌ی فاز N

**موازی (مستقل از هم):** N-1، N-2، N-3، N-5، N-6
**ترتیبی:** N-4 باید قبل از N-7 (بخش الف) اجرا شود. N-5 باید قبل از N-7 (بخش ب) اجرا شود.

**پیشنهاد:** N-1 → N-2 → N-3 → N-4 → N-5 → N-6 → N-7

## معیار پذیرش نهایی فاز N
۱. اعداد فارسی در کلِ اپ (تایمر، تاریخ، درصد، شمارنده) — بدون استثنا.
۲. Toast همیشه بالای BottomNav قابل مشاهده است.
۳. آندو حذف در ۳ ثانیه برای task/note/project/habit کار می‌کند.
۴. ویرایش دوم/سوم تسک بدون خطا ذخیره می‌شود.
۵. فوکوس picker فقط امروز/بدون تاریخ.
۶. نمودار روزهای گذشته immutable است.
۷. ساب‌تسک تیک خوردن مودال را نمی‌بندد.
۸. زمان تایمر قابل ویرایش است و دکمه‌ی استراحت زودهنگام در zen mode وجود دارد.

---

## ترتیب اجرای توصیه‌شده‌ی فاز M (رعایتِ تداخلِ Read/Write)
هیچ دو تسکی در فاز M به‌طور متقاطع روی فایل‌های حیاتی Write هم‌زمان ندارند به جز وقتی که `M-1` پیش‌نیاز است:

1. **M-1 (`index.css` و `index.html`)** — باید **اولین** قدم باشد. زیرساخت تم را پی‌ریزی می‌کند.
2. **M-2 و M-3 و M-4** — هم‌زمان (مستقل) قابل اجرا هستند.
3. **M-5 تا M-8** (پاکسازی لیترال‌ها) — این تسک‌ها چون بر فایل‌های متفاوتی اثر می‌گذارند **کاملاً موازی‌پذیر**ند.
4. **M-9** (افزودن دکمه‌های سوییچ تم به `ProfileModal`) — پس از اینکه توکن‌ها آماده‌اند و `themeManager` در M-2 ایجاد شد، اجرا شود.
5. **M-11** (اصلاحِ کنتراستِ `text-primary`) — چون با فایل‌هایِ چندین تسکِ دیگر (M-2, M-4, M-5, M-6, M-7, M-9) هم‌پوشانی دارد، باید **آخرین تسکِ ویرایش‌کننده‌ی کد** باشد؛ یعنی پس از اتمامِ کاملِ M-1 تا M-9 اجرا شود.
6. **M-10** (ممیزیِ نهایی) — واقعاً آخرین گام، پس از M-11.

## معیار پذیرش نهایی‌ِ فاز M
۱. امکان تعویضِ ۳ تم (سبز/آبی/بنفش) در پروفایل بدون هیچ رفرش صفحه‌ای عمل کند. ۲. در هر سه تم، هیچ دکمه و متنِ `primary`ای با پس‌زمینه‌اش ناخوانا نشود (کنتراست در همه حالت‌ها رعایت شده باشد). ۳. انتخاب رنگِ پروژه‌ها، به عنوان یک هویت مجزا (Sky, Red, Yellow...) زنده مانده و هرکدام رندرِ رنگیِ منحصر‌به‌خود را فارغ از تم برندِ اپلیکیشن نمایش دهند. ۴. در هیچ کجای فایل‌های اجرایی (`src/features` و `src/components`) رشته‌هایی نظیر `bg-lime`, `indigo-`, `purple-600`، مقادیرِ hex غیرِمرتبط با تم (`#D8F066`، `#3B82F6`) یا `bg-[rgba...]` برای استایل‌های معنایی/برند وجود ندارد و همگی توسط سیستمِ CSS Variables مدیریت می‌شوند. ۵. `npm run build` کاملاً موفق عمل می‌کند و فایل‌های زائد معماری قبل از دیسک محو شده‌اند. ۶. **هیچ متن/آیکونِ رنگِ‌برندی روی هیچ سطحِ روشنی (در هیچ‌کدام از ۳ تم) کنتراستِ کمتر از ۴.۵:۱ ندارد** — یعنی کلاسِ خامِ `text-primary`/`text-[var(--color-primary)]` در هیچ فایلِ زنده‌ای باقی نمانده (همه به `text-primary-text` منتقل شده‌اند).

---

# فاز O — درمان ریشه‌ای مسیر به‌روزرسانی تسک (Task Update Integrity)

> جایگزینِ ناقصِ N-4 و N-7. دستورها خط‌به‌خط؛ خروجی سینیور.

### تسک O-1: Canonical whitelist در `taskService.updateTask` (دفاع عمق)

- **عنوان:** مقاوم‌سازی PATCH تسک در برابر object کامل و فیلدهای immutable
- **راهنمای پیاده‌سازی فنی:**
  1. فقط `services/taskService.ts` (مگر type کوچک همان‌جا).
  2. در `updateTask(id, updates)` به‌جای `const { project, ...cleanUpdates } = updates`:
     - allowlist: `title, description, status, priority, due_date, project_id, tags, checklist, completed_at`.
     - فقط کلیدهای موجود در `updates` با مقدار `!== undefined` را کپی کن (partial واقعی).
     - `null` برای `description | due_date | project_id | completed_at` مجاز و باید ارسال شود.
     - اگر `tags`/`checklist` حاضر ولی غیرآرایه‌اند → `[]`.
     - هرگز `id | user_id | created_at | updated_at | embedding | project` در body نباشد.
  3. `.eq('id', id)` از آرگومان اول — id در body نیاید.
  4. `.select(...)` هم‌تراز `getTasks` (بدون `*` و بدون embedding).
  5. throw error مثل قبل.
  6. helper داخلی اختیاری؛ export عمومی لازم نیست.
- **محدودیت‌های اختصاصی:**
  - **باید:** partial مثل `{ checklist: [...] }` بدون title کار کند.
  - **باید:** `updateTask(id, fullTaskRow)` از نظر body امن باشد.
  - **نباید:** SQL/RPC/createTask/noteService را در این تسک عوض کنی.
  - **نباید:** کلید با value=`undefined` به supabase بدهی.
- **معیار قبولی میکرو:**
  - body شبکه فقط allowlist.
  - update فقط checklist یا فقط status موفق.
  - برگشت type Task بدون وابستگی به embedding.
- **CONTEXT_FILES:**
```json
CONTEXT_FILES: ["services/taskService.ts", "types.ts", "hooks/useDataManager.ts"]
```

### تسک O-2: حذف close اجباری بعد از save در `TasksView`

- **عنوان:** جدا کردن «ذخیره» از «بستن مودال» در میزبان TasksView
- **راهنمای پیاده‌سازی فنی:**
  1. فقط `features/tasks/TasksView.tsx`.
  2. در `handleSaveTask`:
     - عنوان خالی: `setEditingTask(null)` OK (invalid/cancel).
     - update: فقط `return updateTask(taskToSave)` — **بدون** `setEditingTask(null)` انتهایی.
     - create: فقط `return addTask(...)` — **بدون** close انتهایی؛ مودال بعد از success در `handleSave` خودش `onClose` می‌زند.
  3. مثل `App.handleSaveModalTask` مقدار Promise را `return` کن تا `await onSave` مودال بشکند.
  4. هیچ تغییر UI دیگر (search/accordion/group).
- **محدودیت‌های اختصاصی:**
  - **باید:** close فقط از prop `onClose` مودال.
  - **نباید:** flag سراسری یا close داخل updateTask.
  - **نباید:** App.tsx را «برای قشنگ شدن» دست بزنی مگر باگ موازی.
  - **نباید:** stopPropagation را فیکس اصلی بدانی (می‌تواند بماند).
- **معیار قبولی میکرو:**
  - تیک ساب‌تسک در صفحه کارها مودال را نمی‌بندد.
  - save حالت edit مودال را می‌بندد (onClose مودال).
  - create بعد از save مودال را می‌بندد.
- **CONTEXT_FILES:**
```json
CONTEXT_FILES: ["features/tasks/TasksView.tsx", "App.tsx", "features/tasks/components/TaskEditorModal.tsx"]
```

### تسک O-3: یکسان‌سازی payload در همه‌ی مسیرهای `TaskEditorModal`

- **عنوان:** builder واحد + minimal patch برای view-mode + close-on-success
- **راهنمای پیاده‌سازی فنی:**
  1. فقط `features/tasks/components/TaskEditorModal.tsx`.
  2. helper داخلی `buildTaskWritePayload` (یا نام هم‌ارز): خروجی = فیلدهای writable + `id?` برای routing.
  3. `handleSave`: full writable + due_date منطقی فعلی؛ `await onSave(...)`؛ **`onClose` فقط بعد از success** (امروز بعد از catch هم close می‌شود — اصلاح شود).
  4. `handleToggleChecklistItem` view: `onSave({ id: formState.id, checklist: updatedChecklist })`؛ local setState؛ هرگز onClose.
  5. `toggleStatus` view: `onSave({ id, status, completed_at })`؛ هرگز onClose.
  6. اگر `!formState.id` در partial → save نکن.
  7. stopPropagation روی checkbox می‌تواند بماند.
- **محدودیت‌های اختصاصی:**
  - **باید:** صفر مسیر view با spread خام `formState` به onSave.
  - **نباید:** دست زدن غیرضروری به timezone/date/link logic.
  - **نباید:** dependency/modal/confirm جدید.
  - **نباید:** effect `[isOpen, task]` را طوری بشکنی که mid-edit ریست شود.
- **معیار قبولی میکرو:**
  - PATCH تیک ساب‌تسک عمدتاً checklist.
  - status toggle بدون close و بدون 400.
  - edit save موفق می‌بندد؛ edit save ناموفق باز می‌ماند.
  - reopen + save دوباره OK.
- **CONTEXT_FILES:**
```json
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "services/taskService.ts", "types.ts", "features/tasks/TasksView.tsx", "App.tsx"]
```

---

## ترتیب اجرای توصیه‌شده‌ی فاز O
1. **O-1** (service)
2. **O-2** (TasksView) — قابل موازی با O-1
3. **O-3** (Modal) — بعد از O-1؛ ترجیحاً بعد از O-2

**پیشنهاد:** O-1 → O-2 → O-3

## معیار پذیرش نهایی فاز O
1. تیک ساب‌تسک مودال را در هیچ host نمی‌بندد.
2. بدون «خطا در به‌روزرسانی کار» در ویرایش متوالی/ساب‌تسک آنلاین سالم.
3. بدون PATCH 400 از فیلد غیرمجاز.
4. create/delete/toggle-from-list بدون رگرسیون.
5. دفاع عمق service حتی اگر UI object کامل بفرستد.

# فاز O2 — پایداری UX استاندارد اپل (Dashboard · Toast · Focus · Notifications)

> پیش‌نیاز: فاز O (O-1…O-3) = DONE. این فاز **کد اجرایی UI/hook** است؛ معمار اسکوپ را قفل کرده.
> اصل: هیچ تسکی روی فایل یکسان با تسک دیگر موازی Write نشود مگر Conflict Map بگوید OK.

---

### تسک O2-1: Toast دوگانه — موبایل bottom / دسکتاپ top-center

**راهنمای پیاده‌سازی فنی:**
1. فقط `components/ui/ToastNotifications.tsx` را ویرایش کن.
2. container واحد را responsive کن:
   - پیش‌فرض (موبایل): همان bottom با `calc(var(--bottom-nav-space, 5rem) + env(safe-area-inset-bottom, 0px) + 0.75rem)`، افقی `left-4 right-4 mx-auto` یا inset امن معادل.
   - از `lg:` به بالا: `bottom-auto`، `top` با `calc(env(safe-area-inset-top, 0px) + 1rem)`، افقی center (`left-1/2 -translate-x-1/2` یا left-0 right-0 mx-auto با max-w-sm).
3. `z-[100]` و استایل کارت (blur، border token، action button) حفظ شود.
4. RTL: متن و آیکون درست بمانند؛ جای container مرکز/اینست امن مهم‌تر از right/left سخت است.
5. اگر Tailwind arbitrary calc لازم شد، معتبر بنویس؛ کلاس نامعتبر نساز.

**محدودیت‌های اختصاصی:**
- انجام بده: فقط جایدهی container + در صورت نیاز padding کارت.
- نکن: library جدید، context جدید، تغییر `addNotification` API، تغییر z-index سایر لایه‌ها، hardcode رنگ.

**معیارهای قبولی:**
- [ ] موبایل: toast بالای BottomNav، بدون پوشش دکمه‌های nav.
- [ ] دسکتاپ (≥1024): toast نزدیک بالای viewport/shell، خوانا، نه چسبیده به لبهٔ پایین.
- [ ] success/error/info + action «آندو» همچنان کامل کار می‌کند.
- [ ] چند toast هم‌زمان فاصلهٔ `space-y` درست دارند.
- [ ] dark/light و color-theme نمی‌شکنند.

CONTEXT_FILES: ["components/ui/ToastNotifications.tsx", "index.css", "App.tsx", "components/BottomNav.tsx", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

---

### تسک O2-2: کلیک سطر «برنامه امروز» → باز شدن Task View

**راهنمای پیاده‌سازی فنی:**
1. فقط `features/dashboard/components/TodaysPlan.tsx`.
2. روی کارت/ناحیهٔ اصلی هر تسک (نه checkbox) handler:
   `window.dispatchEvent(new CustomEvent('hexer:open-task-editor', { detail: task }))`
   — عیناً الگوی `OverdueTasksModal`.
3. checkbox: `onClick` با `e.stopPropagation()` سپس `toggleTaskCompletion(task.id)`.
4. دسترس‌پذیری: cursor-pointer روی سطر، Enter/Space اگر role تعاملی می‌گذاری؛ `aria` مناسب.
5. وضعیت done (line-through) همچنان قابل باز شدن برای مشاهده/ویرایش باشد.

**محدودیت‌های اختصاصی:**
- انجام بده: event سراسری + تفکیک checkbox/card.
- نکن: import/render `TaskEditorModal` در Dashboard؛ prop drilling `onEditTask` از App مگر مجبور (event کافی است)؛ تغییر sort/filter لیست.

**معیارهای قبولی:**
- [ ] کلیک title/card → مودال تسک همان task باز می‌شود (مسیر App global).
- [ ] کلیک checkbox فقط complete/uncomplete می‌کند و مودال باز نمی‌شود.
- [ ] چند کلیک پشت‌سرهم بدون crash.
- [ ] Overdue badge/button رفتار قبلی را حفظ می‌کند.

CONTEXT_FILES: ["features/dashboard/components/TodaysPlan.tsx", "features/dashboard/components/OverdueTasksModal.tsx", "App.tsx", "features/tasks/components/TaskEditorModal.tsx", "docs/ARCHITECTURE.md"]

---

### تسک O2-3: حلقهٔ «وضعیت هفته» — progress هفتگی واقعی

**راهنمای پیاده‌سازی فنی:**
1. `features/dashboard/components/StatsOverview.tsx` (فقط بخش Box1 / week ring در این تسک؛ glance را در O2-4 دست نزن اگر ممکن است — یا موقت بگذار بعداً O2-4 بازنویسی کند).
2. محاسبهٔ `weekProgress`:
   - بازهٔ شنبه…جمعه جاری با منطق هم‌خانواده `ProductivityChart` / `WeeklyReportModal` (Tehran-safe؛ از `isSameTehranDay` / `getTehranDateString` استفاده کن؛ timezone offset دستی شکننده ننویس اگر util موجود کافی است).
   - `due_date` داخل هفته → total؛ `status === 'done'` → completed.
   - `progress = total ? round(completed/total*100) : 0`.
3. `strokeDashoffset` از همین progress؛ محیط دایره همیشه دیده شود.
4. متن وسط حلقه: درصد با ارقام فارسی (`toLocaleString('fa-IR')`).
5. دکمه «مشاهده» → همان `onOpenWeeklyReport` بدون تغییر contract.
6. stroke color: توکن معتبر قابل‌دیدن روی پس‌زمینهٔ تیرهٔ باکس (`var(--color-primary)` یا معادل تثبیت‌شده). اگر progress عوض می‌شود ولی رنگ نامرئی است، رنگ را درست کن — نه با hex تصادفی خارج سیستم تم.

**محدودیت‌های اختصاصی:**
- انجام بده: data source حلقه + نمایش درصد + اطمینان از visible stroke.
- نکن: بازنویسی WeeklyReportModal؛ عوض کردن معنای دکمه مشاهده؛ استفاده از selectedDate برای این حلقه؛ وابستگی به پروژه.

**معیارهای قبولی:**
- [ ] با ۰ تسک در هفته → 0٪ و حلقهٔ خالی (track دیده می‌شود).
- [ ] با N تسک due این هفته و K done → حدود K/N٪.
- [ ] complete کردن یک تسک due این هفته درصد را بالا می‌برد بدون رفرش سخت.
- [ ] تغییر selectedDate در تقویم **نباید** به‌تنهایی درصد «وضعیت هفته» را عوض کند.
- [ ] مودال مشاهده همچنان باز/بسته می‌شود.

CONTEXT_FILES: ["features/dashboard/components/StatsOverview.tsx", "features/dashboard/components/ProductivityChart.tsx", "features/dashboard/components/WeeklyReportModal.tsx", "utils/dateUtils.ts", "types.ts", "docs/ARCHITECTURE.md"]

---

### تسک O2-4: باکس «امروز در یک نگاه» — دادهٔ درست + میله‌های مدرن پایدار

**راهنمای پیاده‌سازی فنی:**
1. ادامه روی `StatsOverview.tsx` (پس از O2-3).
2. متریک‌ها (فقط **امروز تهران** با `isSameTehranDay(..., new Date())`):
   - ردیف1: `doneToday / totalToday`
   - ردیف2: `highDoneToday / highTotalToday` که high = `priority === Priority.High || priority === 'high'`
   - ردیف3: `overdue` مثل قبل + کلیک مودال
3. **حذف کامل** وابستگی glance به `projects` / highPriorityProjects برای این دو میله.
4. میله:
   - ساختار ساده: ظرف full-width، fill جامد از راست (RTL) با width٪، بخش باقی‌مانده border-dashed.
   - `ratio = total===0 ? 0.30 : done/total` (0.30 فقط empty visual).
   - وقتی total>0: ratio واقعی 0…1؛ در 0٪ می‌توانی min visual خیلی کوچک برای fill نداشته باشی ولی **label بیرون نزند** (padding + truncate + min-width برای pill متن).
   - transition ملایم width مجاز است.
5. لیبل‌ها فارسی و خوانا؛ legend «در حال انجام / انجام شده» اگر ماند، با معنای dash/fill هم‌خوان باشد.

**محدودیت‌های اختصاصی:**
- انجام بده: metrics امروز + layout میله پایدار + important=tasks.
- نکن: chart library؛ canvas؛ انتخاب selectedDate به‌جای امروز برای این باکس؛ اعداد لاتین؛ اورانجینیری.

**معیارهای قبولی:**
- [ ] اگر امروز 8 تسک مهم و 2 done → نمایش `۲/۸` (فا).
- [ ] complete یک high-priority امروز → هم عدد و هم fill به‌روز.
- [ ] total=0 → حدود ۳۰٪ fill بصری و `۰/۰` بدون overflow متن.
- [ ] 100٪ → fill تقریباً کامل، dash محو/صفر.
- [ ] عقب‌افتاده همچنان مودال باز می‌کند.
- [ ] حلقهٔ هفته از O2-3 خراب نشده.

CONTEXT_FILES: ["features/dashboard/components/StatsOverview.tsx", "types.ts", "utils/dateUtils.ts", "docs/PROJECT.md", "docs/ARCHITECTURE.md"]

---

### تسک O2-5: Zen Mode fullscreen — portal به document.body

**راهنمای پیاده‌سازی فنی:**
1. `features/dashboard/components/FocusTimer.tsx`.
2. درخت UI مربوط به `isZenMode` را با `createPortal(..., document.body)` از `react-dom` رندر کن (import نام‌دار/پیش‌فرض مطابق پروژه).
3. کلاس shell: `fixed inset-0 z-[60]` (یا z منطبق قرارداد)، `h-[100dvh] w-full`, `overflow-hidden`, `flex flex-col`, پس‌زمینهٔ فعلی.
4. top bar: `pt-app-safe` / safe-area؛ دکمه‌های خروج و تنظیم زمان **همیشه** در viewport دیده شوند (موبایل و دسکتاپ).
5. `hexer:zen-mode` event همچنان روی set/unset fire شود (BottomNav hide logic در App بماند).
6. اگر body scroll lock اضافه کردی: در close/unmount حتماً revert.
7. Task picker و DurationPicker: اگر داخل zen از fixed استفاده می‌کنند و clip می‌شدند، یا خارج portal بمانند با z بالاتر، یا همراه portal؛ هر دو picker باید قابل استفاده بمانند.

**محدودیت‌های اختصاصی:**
- انجام بده: portal + تضمین دیده شدن top bar.
- نکن: بازنویسی منطق تایمر؛ تغییر FOCUS/BREAK defaults؛ حذف session card؛ z-index جنگ با toast مگر ضروری (toast 100 > zen 60 OK).

**معیارهای قبولی:**
- [ ] دسکتاپ glass-app: ورود به zen → بالا بریده نیست؛ «خروج» دیده و کار می‌کند.
- [ ] موبایل: safe-area بالا رعایت می‌شود.
- [ ] خروج zen ویجت را به حالت عادی برمی‌گرداند؛ event false می‌فرستد.
- [ ] تایمر در zen tick می‌کند مثل قبل.

CONTEXT_FILES: ["features/dashboard/components/FocusTimer.tsx", "App.tsx", "index.css", "docs/ARCHITECTURE.md"]

---

### تسک O2-6: دکمه استراحت — حذف عدد دقیقه زیر label

**راهنمای پیاده‌سازی فنی:**
1. همان `FocusTimer.tsx` پس از O2-5.
2. در bottom controls zen، دکمه `handleToggleMode`: فقط یک span متنی «استراحت» یا «فوکوس».
3. span دوم (`${breakMinutes}′` / `${focusMinutes}′`) را **حذف** کن.
4. دکمه تک‌خطی بماند (`flex items-center justify-center` بدون `flex-col` اگر دیگر لازم نیست)؛ touch target ≥44px عرض/ارتفاع منطقی.
5. دقیقه همچنان در دایرهٔ تایمر و DurationPicker نمایش داده شود.

**محدودیت‌های اختصاصی:**
- انجام بده: حذف subtitle عددی + تنظیم layout دکمه.
- نکن: حذف کل دکمه؛ تغییر handleToggleMode semantics؛ تغییر storage دقیقه‌ها.

**معیارهای قبولی:**
- [ ] زیر «استراحت» هیچ «5» یا دقیقه دیده نمی‌شود.
- [ ] زیر «فوکوس» هیچ دقیقه‌ای نیست.
- [ ] دکمه ارتفاع غیرعادی ندارد.
- [ ] toggle mode همچنان کار می‌کند.

CONTEXT_FILES: ["features/dashboard/components/FocusTimer.tsx", "docs/PROJECT.md"]

---

### تسک O2-7: کوچک‌کردن اعداد روز در WeekCalendar

**راهنمای پیاده‌سازی فنی:**
1. فقط `features/dashboard/components/WeekCalendar.tsx`.
2. className عدد روز را یک پله کاهش بده (مثلاً از `text-sm sm:text-base md:text-lg` به `text-xs sm:text-sm md:text-base`).
3. نام روز، ارتفاع دکمه، selected styles را فقط اگر overflow پیش آمد مینیمال تنظیم کن — هدف redesign نیست.
4. اعداد همچنان fa-IR بمانند.

**محدودیت‌های اختصاصی:**
- انجام بده: scale تایپوگرافی عدد.
- نکن: تغییر منطق weekDays؛ حذف next-week section؛ رنگ جدید.

**معیارهای قبولی:**
- [ ] اعداد روز کوچک‌تر از قبل و خوانا.
- [ ] selected/today state نشکسته.
- [ ] موبایل و دسکتاپ بدون شکستن گرید 7 ستونه.

CONTEXT_FILES: ["features/dashboard/components/WeekCalendar.tsx", "docs/PROJECT.md"]

---

### تسک O2-8: رفع ارسال نوتیفیکیشن foreground (ریشه: status + permission)

**راهنمای پیاده‌سازی فنی:**
1. فقط `hooks/useReminderScheduler.ts` در اسکوپ پیش‌فرض.
2. فیلتر today tasks:
   - غلط: `!task.completed`
   - درست: `task.status !== 'done'` (و due_date امروز مثل قبل).
3. در ابتدای `evaluate` یا قبل از show:
   - اگر `typeof Notification === 'undefined' || Notification.permission !== 'granted'` → return آرام از مسیر show (interval می‌تواند بماند ولی show نکن).
4. حفظ: messageId `task-${id}-${dueMs}`، dedup `notifiedTaskIdsRef` + `checkIfShownAndRegister`، daily nudge، interval 60s، listeners visibility/online.
5. تسک بدون due زمانی (ساعت 00:00 الگوی formatTime خالی) را با قوانین فعلی dueMs بفهم؛ رفتار catch-up را بی‌دلیل گسترده‌تر نکن (فقط bugfix).
6. **لاگ کم**؛ production noise نساز.
7. اگر بعد از این fix هنوز push وقتی اپ kill است کار نکرد: در خلاصهٔ تسک بنویس «نیاز بررسی Layer B / VAPID» — خودت Edge/SQL را عوض نکن.

**محدودیت‌های اختصاصی:**
- انجام بده: فیلتر status + گارد permission + حفظ dedup.
- نکن: auto requestPermission؛ تغییر ProfileModal flow؛ دست زدن به sw.js مگر bug قطعی کلاینت-only نبود؛ invent فیلد `completed`.

**معیارهای قبولی:**
- [ ] کد دیگر به `task.completed` ارجاع ندارد.
- [ ] با permission=granted و تسک due امروز undone، وقتی dueMs فرا می‌رسد (یا catch-up)، `showViaSW` فراخوانی‌پذیر است.
- [ ] تسک‌های `status==='done'` نوتیف نمی‌گیرند.
- [ ] permission=denied/default → بدون throw UI.
- [ ] nudge روزانه double-fire نمی‌شود (localStorage + messageId).

CONTEXT_FILES: ["hooks/useReminderScheduler.ts", "services/reminderService.ts", "types.ts", "App.tsx", "utils/notificationCopy.ts", "docs/ARCHITECTURE.md", "docs/PROJECT.md"]

---

## ترتیب اجرای توصیه‌شده‌ی فاز O2
1. **O2-8** (نوتیفیکیشن — logic خالص، بدون UI conflict)
2. **O2-2** (TodaysPlan click)
3. **O2-3** سپس **O2-4** (StatsOverview سریال)
4. **O2-1** (Toast)
5. **O2-5** سپس **O2-6** (FocusTimer سریال)
6. **O2-7** (WeekCalendar)

موازی مجاز فقط اگر دو کدنویس و فایل‌ها در Conflict Map تداخل W/W ندارند.

## معیار پذیرش نهایی فاز O2
1. هر ۸ باگ گزارش‌شده کاربر برطرف و روی موبایل+دسکتاپ smoke شده‌اند.
2. استاندارد اپل برای toast/focus/safe-area رعایت شده (نه pixel-perfect iOS copy؛ رفتار و hierarchy درست).
3. هیچ رگرسیونی در save تسک (فاز O)، undo delete (فاز N)، offline queue.
4. بدون dependency جدید، بدون SQL/Edge در این فاز.
5. اعداد کاربر-نما فارسی؛ RTL سالم.
