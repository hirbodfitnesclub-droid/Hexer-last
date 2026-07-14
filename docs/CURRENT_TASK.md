

# فاز N — پایداری UX: فونت یکپارچه، اعداد فارسی، Toast RTL، آندو حذف، باگ‌های تسک و فوکوس

> مرجعِ کامل: `docs/PROJECT.md` §فاز N و `docs/ARCHITECTURE.md` §N.
> قانونِ طلایی: هیچ فایلِ کامپوننتِ جدیدی ساخته نشود؛ هیچ پکیج/سرویس/RPC/جدولِ جدید؛ همه‌ی تغییرات در لایه‌ی View یا hook/state موجود است. فایل‌های SQL و Edge Functionها لمس نمی‌شوند.

---

### تسک N-1: یکپارچه‌سازی فونت Vazirmatn FD و رندر اعداد فارسی [DONE]

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

### تسک N-2: اصلاح موقعیت Toast بالای BottomNav [DONE]

**عنوان:** رفع تداخل Toast با BottomNav در موبایل و اصلاح position در RTL.

**راهنمای پیاده‌سازی فنی:**
1. در `components/ui/ToastNotifications.tsx`، کلاس container را از:
   `"fixed bottom-24 right-4 z-[100] w-full max-w-sm space-y-3"`
   به کلاس با `left-4 right-4 mx-auto` و `style` محاسباتی تغییر بده:

```tsx
<div 
  className="fixed z-[100] w-full max-w-sm space-y-3 left-4 right-4 mx-auto"
  style={{ bottom: 'calc(var(--bottom-nav-space, 5rem) + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
  id="toast-container"
>
```

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

### تسک N-3: آندو ۳ ثانیه‌ای برای همه‌ی عملیات حذف [DONE]

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
- **نباید:** `addNotification` در `useDataManager` تغییر کند.
- **باید:** در هر handler، قبل از commit به DB، آنلاین بودن چک شود.

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

### تسک N-4: رفع باگ ذخیره‌ی دوم تسک (sanitization در handleSave) [DONE]

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
- **باید:** همه‌ی فیلدهای Task که در DB ذخیره می‌شوند در cleanPayload حضور داشته باشند.

**معیار پذیرش میکرو:**
- ویرایش یک تسک برای اولین بار: ذخیره موفق.
- باز کردن همان تسک و ویرایش دوباره (هر نوع تغییری): ذخیره موفق بدون خطا.
- ویرایش سوم و چندم: همچنان موفق.
- هیچ رگرسیونی در ساخت تسک جدید یا لینک یادداشت رخ نمی‌دهد.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "services/taskService.ts", "types.ts"]
```

---

### تسک N-5: فوکوس مود — فقط تسک‌های امروز در picker [DONE]

**عنوان:** فیلتر `activeTasks` در `FocusTimer` برای نمایش فقط تسک‌های روز جاری.

**راهنمای پیاده‌سازی فنی:**
فقط در `features/dashboard/components/FocusTimer.tsx`:

1. در بالای فایل، `isSameTehranDay` را از `utils/dateUtils` ایمپورت کن:
```typescript
import { isSameTehranDay } from '../../../utils/dateUtils';
```

2. `activeTasks` useMemo را تغییر بده:
```typescript
const activeTasks = useMemo(() => {
  const today = new Date();
  return tasks.filter((t) => {
    if (t.status === 'done') return false;
    if (!t.due_date) return true;
    return isSameTehranDay(t.due_date, today);
  });
}, [tasks]);
```

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `activeTasks` useMemo تغییر کند.
- **نباید:** هیچ چیز دیگری در این فایل تغییر کند (این تسک).

**معیار پذیرش میکرو:**
- در task picker، فقط تسک‌هایی که due_date امروز دارند (یا due_date ندارند) نمایش داده می‌شوند.
- گزینه‌های سریع («تمرکز آزاد» و «مطالعه و یادگیری») همچنان نمایش دارند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/FocusTimer.tsx", "utils/dateUtils.ts"]
```

---

### تسک N-6: اصلاح نمودار بهره‌وری — تاریخچه‌ی immutable برای روزهای گذشته [DONE]

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
      const dayTasks = tasks.filter((t) => t.due_date && isSameTehranDay(t.due_date, day));
      const completedCount = dayTasks.filter((t) => t.status === 'done').length;
      const progress = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;
      return { day, progress, isToday: true };
    } else {
      const completedOnDay = tasks.filter(
        (t) => t.completed_at && isSameTehranDay(t.completed_at, day)
      ).length;
      const DAILY_TARGET = 5;
      const progress = Math.min(100, Math.round((completedOnDay / DAILY_TARGET) * 100));
      return { day, progress, isToday: false };
    }
  });
}, [tasks, weekDays]);
```

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط `weekData` useMemo تغییر کند.
- **نباید:** `weeklyRate` یا `monthlyRate` تغییر کنند.
- **نباید:** هیچ تغییری در SVG، رنگ‌ها، مسیر منحنی یا layout.

**معیار پذیرش میکرو:**
- نمودار روزهای گذشته وقتی تسکی از آن روز به امروز جابه‌جا می‌شود تغییر نمی‌کند.
- نمودار امروز همچنان بر اساس due_date محاسبه می‌شود.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/ProductivityChart.tsx", "utils/dateUtils.ts", "types.ts"]
```

---

### تسک N-7: رفع بسته شدن مودال + ویرایش زمان تایمر + دکمه استراحت زودهنگام [DONE]

**عنوان:** رفع event propagation ساب‌تسک + زمان قابل تنظیم تایمر + دکمه‌ی رفتن زودهنگام به استراحت.

**این تسک شامل دو فایل است که باید به‌ترتیب ویرایش شوند:**

#### بخش الف — رفع بسته شدن مودال (`features/tasks/components/TaskEditorModal.tsx`)
این تسک **باید بعد از N-4 اجرا شود**.

در بخش «Checklist View» (mode === 'view')، روی هر دکمه‌ی checkbox ساب‌تسک:

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
**دقت کن:** این تغییر فقط روی دکمه‌های checkbox ساب‌تسک در view mode است.

#### بخش ب — ویرایش زمان تایمر و دکمه‌ی استراحت زودهنگام (`features/dashboard/components/FocusTimer.tsx`)
این تسک **باید بعد از N-5 اجرا شود**.

**۱. اضافه کردن constants و state‌های قابل تنظیم (قبل از کامپوننت / داخل کامپوننت):**
```typescript
// بیرون از کامپوننت:
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
  if (!isBreak) { setTimeLeft(clamped * 60); setIsRunning(false); }
};
const handleSaveBreakMinutes = (val: number) => {
  const clamped = Math.max(1, Math.min(99, val));
  setBreakMinutes(clamped);
  localStorage.setItem(STORED_BREAK_KEY, String(clamped));
  if (isBreak) { setTimeLeft(clamped * 60); setIsRunning(false); }
};
```

**۴. افزودن دکمه‌ی settings و mini-panel در ویجت اصلی (در «Top Row»):**
```tsx
{/* دکمه‌ی settings کنار عنوان */}
<button
  onClick={() => setIsEditingTimer(v => !v)}
  className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition"
  title="تنظیم زمان"
>
  <PencilIcon className="w-3.5 h-3.5" />
</button>

{/* Mini-panel ویرایش (بلافاصله زیر Top Row) */}
{isEditingTimer && (
  <div className="flex gap-3 z-10 bg-white/5 rounded-xl p-2.5" onClick={e => e.stopPropagation()}>
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-[9px] text-white/40 font-bold">فوکوس (دقیقه)</span>
      <input
        type="number" min="1" max="99"
        value={focusMinutes}
        onChange={e => handleSaveFocusMinutes(parseInt(e.target.value) || 1)}
        className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-primary"
      />
    </div>
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-[9px] text-white/40 font-bold">استراحت (دقیقه)</span>
      <input
        type="number" min="1" max="99"
        value={breakMinutes}
        onChange={e => handleSaveBreakMinutes(parseInt(e.target.value) || 1)}
        className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-primary"
      />
    </div>
  </div>
)}
```

**۵. دکمه‌ی رفتن زودهنگام به استراحت در zen mode (در «Bottom Controls»):**
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
- **نباید:** localStorage برای هیچ داده‌ی دائمی غیر از این دو تنظیم استفاده شود.
- **باید:** مقادیر focusMinutes/breakMinutes بعد از رفرش صفحه حفظ شوند.

**معیار پذیرش میکرو:**
- تیک زدن ساب‌تسک در view mode مودال را نمی‌بندد.
- با کلیک روی آیکون ویرایش، دو input عددی نمایش داده می‌شود.
- تغییر عدد فوکوس به ۳۰: تایمر ریست می‌شود به ۳۰:۰۰.
- بعد از رفرش، مقادیر ذخیره‌شده حفظ می‌شوند.
- در zen mode، دکمه‌ی «استراحت زودهنگام» فقط در حالت focus نمایش دارد و با کلیک تایمر به break mode سوییچ می‌کند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/dashboard/components/FocusTimer.tsx", "components/icons.tsx", "utils/dateUtils.ts"]
```

---

## ترتیب اجرای توصیه‌شده‌ی فاز N
**موازی (مستقل از هم):** N-1، N-2، N-3، N-5، N-6
**ترتیبی:** N-4 → N-7 (بخش الف) | N-5 → N-7 (بخش ب)
**پیشنهاد:** N-1 → N-2 → N-3 → N-4 → N-5 → N-6 → N-7
