


# فاز M — سیستم چندتمیِ رنگِ برند + رفعِ بدهیِ رنگ‌های هاردکد (Multi Color-Theme & Hardcoded Color Debt Remediation)

> مرجعِ کامل: `docs/PROJECT.md` §فاز M و `docs/ARCHITECTURE.md` §M.
> قانونِ طلایی: هیچ فایلِ کامپوننتِ جدیدی ساخته نشود (فقط ۱ فایل `utils/themeManager.ts`)؛ هیچ پکیج/سرویس/RPC/جدولِ جدید؛ هیچ تغییرِ رفتاری، فقط رنگ/کلاس. فایل‌های legacy نام‌برده‌شده فقط **حذف** شوند، نه ویرایش.

---

### تسک M-1: پایه‌گذاریِ توکن‌های ۳تمی در `:root` و `.dark` (`index.css` و `index.html`)

**عنوان:** گسترشِ `index.css` برای پذیرشِ مقادیر آبی و بنفش در قالبِ CSS variableها از طریق `data-color-theme` + رفع لیترال‌های داخلیِ خود `index.css`.

**راهنمای پیاده‌سازی فنی:**
1. در `index.css` بلوکِ `:root` فعلی را نگه دار (فقط کامنتِ «(الف) توکن‌های کانالیِ RGB» و «(ب) توکن‌های مقدارِ کاملِ Hex/rgba» و غیره حفظ شود).
2. مقادیرِ آبی و بنفشِ تعریف‌شده در ARCHITECTURE §M.1 را عیناً (دقیقاً مطابق همان بلوک‌های `[data-color-theme="blue"]` و `[data-color-theme="purple"]`) به‌عنوانِ ۲ بلوکِ مستقلِ جدید در `index.css` (بین `:root` و `.dark`) اضافه کن.
3. در بلوکِ موجودِ `.dark` در `index.css`، ۵ متغیری که هاردکدِ لیترال هستند (همان ۵ متغیرِ ذکرشده در ARCHITECTURE §M.0: `--border-neon`, `--input-focus-ring`, `--ink-bg`, `--nav-active-bg` و `--shadow-card` برای `.dark .tile-lime`) را به‌گونه‌ای آپدیت کن که بجای لیترال `#D8F066` یا `rgba(216,240,102,...)` از ارجاعِ پویا به `var(--color-primary)` و `rgb(var(--color-primary-rgb) / ...)` استفاده کنند (دقیقاً مطابقِ قطعه‌کدِ ARCHITECTURE §M.1).
4. در `index.css`، نام‌های کلاسِ کمکیِ قدیمیِ `.bg-lime` و `.text-lime` و `.tile-lime` را به نام‌های خنثی تغییر بده: `.bg-brand`، `.text-brand`، `.tile-brand`. (توجه: کدِ استایلِ درونِ این کلاس‌ها دست‌نخورده می‌ماند، فقط نام‌شان عوض می‌شود؛ آپدیتِ مصرف‌کننده‌های این کلاس‌ها در سایر تسک‌هاست).
5. در `index.html`، بلوکِ `<script>` pre-paint را دقیقاً با کدِ نوشته‌شده در ARCHITECTURE §M.1 جایگزین کن (تا `hexer-color-theme` را از `localStorage` بخواند و اِتریبیوت `data-color-theme` را روی `document.documentElement` اضافه کند).
6. بقیه‌ی محتوای `index.html` (مثل `tailwind.config` داخلیِ `<script>`) دقیقاً دست‌نخورده بماند (نگاشت‌های فعلیِ `primary` و غیره کار می‌کنند).

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط و فقط مقادیرِ هاردکدِ مرتبط با رنگ برند (lime) در `.dark` پویا شوند؛ سایر متغیرهای `.dark` (مثل رنگ بک‌گراند `#121212` و غیره) دست‌نخورده بمانند.
- **نباید:** تغییر مقادیر یا افزودن پلاگین به `tailwind.config` موجود در `index.html`.

**معیار پذیرش میکرو:**
- `index.css` بدون خطا پردازش می‌شود؛ بلوک‌های آبی/بنفش حضور دارند؛ لیترالِ `216, 240, 102` و `#D8F066` در داخل بلوک `.dark` وجود ندارد (همگی به `var` تبدیل شده‌اند).
- `index.html` کدِ خواندنِ `hexer-color-theme` را در بلاک pre-paint خود دارد.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["index.css", "index.html"]
```

---

### تسک M-2: ایجاد ماژول مدیریت تم مشترک (`utils/themeManager.ts`)

**عنوان:** استخراجِ توابعِ خالصِ مدیریتِ تم/دارک‌مود/ذخیره‌سازی از کامپوننت‌های UI.

**راهنمای پیاده‌سازی فنی:**
1. یک فایلِ جدید به نام `themeManager.ts` در مسیر `utils/` بساز.
2. امضای دقیق توابعِ تعریف‌شده در PROJECT.md §M.2 را پیاده‌سازی کن: `COLOR_THEMES`، `getStoredColorTheme()`، `applyColorTheme(theme)`، `isDarkMode()`، و `toggleDarkMode()`.
3. در داخل `toggleDarkMode`، دقیقاً همان منطقِ موجود در `Sidebar.tsx` یا `ProfileModal.tsx` را پیاده‌سازی کن (تغییر کلاسِ `dark` روی `documentElement` + آپدیتِ `localStorage['hexer-theme']` + آپدیت متا‌تگ `theme-color`) و مقدار جدید `isDark` را برگردان.
4. در داخل `applyColorTheme`، مقدارِ دریافتی را در `localStorage.setItem('hexer-color-theme', theme)` ذخیره کن؛ سپس اگر مقدار `green` بود `document.documentElement.removeAttribute('data-color-theme')` را صدا بزن، وگرنه `document.documentElement.setAttribute('data-color-theme', theme)` را اعمال کن.

**محدودیت‌های اختصاصی تسک:**
- **باید:** این فایل یک فایلِ تایپ‌اسکریپت خالص (`.ts`) بدون React/JSX باشد.
- **نباید:** افزودن React Context، State، یا هرگونه عوارض جانبیِ سنگین‌تر.

**معیار پذیرش میکرو:**
- فایلِ `utils/themeManager.ts` بدون خطای تایپ‌اسکریپت وجود دارد و شامل هر ۵ اکسپورتِ خواسته‌شده است.
- فراخوانی `applyColorTheme('blue')` کلاس/صفتِ صحیح و رکوردِ localStorage را بی‌نقص تنظیم می‌کند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: []
```

---

### تسک M-3: حذف قطعی و ایمن فایل‌های مرده (Dead Code Deletion)

**عنوان:** پاک‌سازی ۱۲ فایل کامپوننتِ تکراری و بی‌استفاده که ریشه در معماری قدیمی دارند.

**راهنمای پیاده‌سازی فنی:**
1. ۱۲ فایل ذکرشده در ARCHITECTURE §M.6 را مستقیماً از روی دیسک **حذف (Delete)** کن (از طریق کامندهای sandbox مثل `rm` در صورت امکان، یا ابزار ویرایش فایل).
2. لیست دقیق: `components/ChatView.tsx`, `components/Dashboard.tsx`, `components/HabitEditorModal.tsx`, `components/NoteEditorModal.tsx`, `components/NotesView.tsx`, `components/Onboarding.tsx`, `components/ProjectsView.tsx`, `components/TaskEditorModal.tsx`, `components/TasksView.tsx`, `components/Modal.tsx`, `features/dashboard/components/DashboardHeader(old).tsx`, `features/habits/components/HabitEditorModal.tsx`.
3. هیچ فایلی جز لیست بالا نباید دست بخورد یا پاک شود.

**محدودیت‌های اختصاصی تسک:**
- **باید:** حذف فیزیکی فایل.
- **نباید:** دستکاری در فایل‌های هم‌نامِ زنده (آن‌هایی که در `features/**/` یا سایر فولدرها هستند و پسوند `(old)` ندارند). این فایل‌های هم‌نام زنده‌اند و پاک نمی‌شوند!

**معیار پذیرش میکرو:**
- پس از اجرا، هیچ‌یک از آن ۱۲ فایل روی دیسک وجود ندارند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: []
```

---

### تسک M-4: مستقل‌سازی سیستمِ رنگ پروژه (`Project.color`)

**عنوان:** جداسازی کاملِ پالتِ رنگِ پروژه‌ی کاربر از تمِ برندِ اپلیکیشن.

**راهنمای پیاده‌سازی فنی:**
1. در `index.css` مقادیر متغیرهای CSS توصیف‌شده در ARCHITECTURE §M.3 (`--project-color-sky`, `--project-color-red` و...) را مستقیماً به بلوک‌های `:root` و `.dark` اضافه کن (این‌ها رنگ‌های ثابتِ غیرمرتبط با تم هستند).
2. در `features/projects/components/ProjectCard.tsx`، نگاشت فعلی `colorClasses` که برای هر ۶ رنگ یکسان است (`bg-primary/10`, `text-[var(--color-primary)]`, و غیره) را طوری ویرایش کن که هر کلید (`sky, red, green, yellow, purple, gray`) از متغیرِ CSSِ همنامِ اختصاصیِ خودش استفاده کند (برای هر ۶ رنگ، مقادیر: `bg: 'bg-[var(--project-color-{color})]/10'`, `border: 'border-[var(--project-color-{color})]'`, `text: 'text-[var(--project-color-{color})]'`, `gradient: 'from-[var(--project-color-{color})]/20'`, `solidBg: 'bg-[var(--project-color-{color})]'` را به‌طور دقیق و یک‌دست تنظیم کن؛ `var(--border-neon)` و `--color-primary` را کلاً از اینجا حذف کن).
3. در `features/notes/components/NoteCard.tsx`، شرطِ تو‌در‌توی فعلی برای background که رنگ `#3B82F6` هاردکد داشت را حذف کن و به‌جای آن `background: 'linear-gradient(to right, transparent, var(--project-color-' + (project?.color || 'sky') + '), transparent)'` بگذار (استفاده از متغیر جدید به‌صورت پویا).
4. در `features/tasks/components/TaskCard.tsx` خطوطِ ۷۹-۸۱ (`task.project.color === 'red' ? 'bg-red-500' : ...`) را با `style={{ backgroundColor: 'var(--project-color-' + (task.project.color || 'sky') + ')' }}` (با حذفِ کلاس‌های Tailwind خامِ red/yellow/blue-500) جایگزین کن و شرط fallback `bg-primary` را هم به همان متغیرِ `project-color-sky` هدایت کن. خطِ ۱۲۷ (`priorityColor`) که از `--semantic-error`/`--color-primary` استفاده می‌کرد سالم است، دست نزن.

**محدودیت‌های اختصاصی تسک:**
- **باید:** متغیرهای جدید `--project-color-*` به‌طور استاندارد در `index.css` وارد شوند.
- **نباید:** تغییری در رنگ‌های `Priority` یا تداخل در کلاس‌های دیگرِ کارت‌ها ایجاد شود.

**معیار پذیرش میکرو:**
- هر پروژه براساس فیلد `color` خود واقعاً یک رنگِ بصری متفاوت و معنادار (آبی، قرمز، زرد، سبز...) تولید می‌کند، فارغ از اینکه تمِ برندِ کلِ اپلیکیشن چیست.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["index.css", "features/projects/components/ProjectCard.tsx", "features/notes/components/NoteCard.tsx", "features/tasks/components/TaskCard.tsx"]
```

---

### تسک M-5: جایگزینیِ گسترده کلاسِ `lime` با `brand` و رفعِ هاردکدهایِ داشبورد

**عنوان:** جستجو و جایگزینی کلاس‌های قدیمیِ `.bg-lime` و اصلاح توکن‌های خنثی در داشبورد/شورتکات‌ها.

**راهنمای پیاده‌سازی فنی:**
1. در فایل‌های زیر، هرگونه وقوع دقیق رشته‌ی `bg-lime` را به `bg-brand`، `text-lime` را به `text-brand`، و `tile-lime` را به `tile-brand` تبدیل کن:
   - `components/BottomNav.tsx`
   - `components/Sidebar.tsx`
   - `features/chat/ChatView.tsx`
   - `features/chat/components/ProposalCard.tsx`
   - `features/dashboard/components/AiComposerPanel.tsx`
   - `features/dashboard/components/KeyProjects.tsx`
   - `features/dashboard/components/StatsOverview.tsx`
   - `features/notes/NotesView.tsx`
   - `features/notes/components/NoteEditorModal.tsx`
   - `features/dashboard/components/FocusTimer.tsx` (همچنین در FocusTimer مقادیر هاردکد `#16161a` را به `var(--ink-bg)` تبدیل کن).
2. در `features/dashboard/components/OverdueTasksModal.tsx` (علاوه بر تغییر `bg-lime` به `bg-brand`)، استفاده‌ی ناصحیح از `shadow-lime/10` را به `shadow-primary/10` و `bg-lime/10 text-lime` را به `bg-primary/10 text-primary` تبدیل کن.
3. در `features/dashboard/components/StatsOverview.tsx` مقادیر `#16161A` در کلاس‌های کپسول‌ها به `bg-[var(--ink-bg)]` تبدیل شوند.

**محدودیت‌های اختصاصی تسک:**
- **باید:** کلاس‌های جایگزین‌شده (مثل `bg-brand`) دقیقاً همان‌هایی باشند که در M-1 تغییرِ نام یافتند.

**معیار پذیرش میکرو:**
- هیچ کلاسی با کلمه‌ی `lime` در فایل‌های ذکرشده باقی نمانده و برنامه‌ی زنده کماکان استایل‌های صحیح دارد (به دلیل تبدیلِ نام).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["components/BottomNav.tsx", "components/Sidebar.tsx", "features/chat/ChatView.tsx", "features/chat/components/ProposalCard.tsx", "features/dashboard/components/AiComposerPanel.tsx", "features/dashboard/components/KeyProjects.tsx", "features/dashboard/components/StatsOverview.tsx", "features/notes/NotesView.tsx", "features/notes/components/NoteEditorModal.tsx", "features/dashboard/components/FocusTimer.tsx", "features/dashboard/components/OverdueTasksModal.tsx"]
```

---

### تسک M-6: رفعِ نقصِ هدر و نمودار و تقویم در داشبورد (Dashboard Widgets fixes)

**عنوان:** رفع لیترال‌هایِ هاردکد در SVG نمودارِ بهره‌وری و رنگ‌های هاردکدِ عادت و امروز.

**راهنمای پیاده‌سازی فنی:**
1. در `features/dashboard/components/ProductivityChart.tsx` مقادیر `stopColor="#38bdf8"` را به `stopColor="rgb(var(--color-primary-hover-rgb))"` (یا هر رنگ توکن‌محور معادل) و `stopColor="#D8F066"` را به `stopColor="rgb(var(--color-primary-rgb))"` (یا مشابه) جایگزین کن تا رنگ‌بندی SVG با تم پویا همگام شود.
2. در `features/dashboard/components/HabitTracker.tsx` لیترال‌های `bg-orange-600/20 text-orange-400` و `text-orange-400` را با `bg-primary/20 text-primary` و توکن‌های primary جایگزین کن (یا اگر هشدار مدنظر است، `warning`). لیترال‌های `bg-green-500/20` و `text-green-300` به توکن‌های معنایی `bg-success/20` و `text-success` تبدیل شوند. کلاسِ حاشیه‌ی موفقیت `border-green-400` به `border-success` تغییر یابد.
3. در `features/dashboard/components/TodaysNotes.tsx`، آیکون نوت‌بوک که رنگ `text-purple-400` دارد به `text-[var(--text-muted)]` یا `text-primary` تغییر یابد و کلاس `hover:border-purple-500/30` به `hover:border-primary/30` جایگزین شود.

**محدودیت‌های اختصاصی تسک:**
- **نباید:** تغییری در مسیر (`L` و `C` هایِ Catmull-Rom) در نمودار داده شود. فقط مقادیرِ رنگِ `defs > linearGradient` تغییر یابند.

**معیار پذیرش میکرو:**
- نمودار بدون خطای SVG کار می‌کند و با سوییچ تم کاملاً رنگ‌بندی خود را آپدیت می‌کند (همانطور که عادت‌ها سبز/قرمزِ هاردکد ندارند).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/ProductivityChart.tsx", "features/dashboard/components/HabitTracker.tsx", "features/dashboard/components/TodaysNotes.tsx"]
```

---

### تسک M-7: مهار و اصلاحِ کامپوننت‌هایِ چت، پیکرها و فرم‌ها (Pickers & Chat & Modals)

**عنوان:** جایگزینی کاملِ لیترال‌های `sky/purple/red/zinc` پراکنده در کامپوننت‌های تعاملی با توکن‌های سیستم.

**راهنمای پیاده‌سازی فنی:**
1. در `features/chat/ChatView.tsx`، سه دکمه‌ی `bg-red-500`/`bg-red-600` و `shadow-red-500` (مربوط به حذفِ تصویرِ پیوست و ریکورد میکروفون) به توکن‌های معنایی `bg-error`/`hover:bg-error/90`/`shadow-error/30` و کلاس `border-red-500/20` به `border-error/20` تغییر یابد.
2. در `features/chat/components/MoreCitationsModal.tsx`، این فایل را یکپارچه بازنویسی/ریفکتورِ کلاسی کن تا از معماری خاکستری/آبیِ هاردکد (`bg-gray-900`, `text-white`, `border-white/10`, `text-sky-400`, `border-sky-500`...) رها شود و از کلاس‌های توکنی استاندارد (`bg-[var(--bg-card)]`, `text-[var(--text-main)]`, `text-[var(--text-muted)]`, `border-[var(--border-subtle)]`, `text-primary`, `border-primary`...) استفاده کند (دقیقاً مطابق لیستِ ممیزیِ ChatView).
3. در `features/notes/components/LinkTaskPicker.tsx`، تمام ارجاعات به `bg-zinc-*`، `text-zinc-*`، و `*-sky-*` را به معادل‌های سیستم طراحی (`bg-[var(--bg-card)]`, `text-[var(--text-muted)]`, `*-primary-*`) تبدیل کن (پالتِ تاریکِ هاردکد ممنوع).
4. در `features/tasks/components/LinkNotePicker.tsx`، عیناً همان الگوی شماره ۳ را پیاده کن (فقط با این تفاوت که اینجا لیترال‌های بنفش `purple` هاردکد بوده‌اند که همه باید به `primary` تبدیل شوند).
5. در `components/PersianDatePicker.tsx` و `components/TimePicker.tsx`، کلاس‌های `slate` و `sky` هاردکد (نظیر `bg-slate-800/60`, `text-slate-400`, `focus:ring-sky-500` و غیره) را با متغیرهای توکنی اپلیکیشن (`bg-[var(--bg-card)]`, `text-[var(--text-muted)]`, `focus:ring-[var(--color-primary)]`...) جایگزین کن تا با لایت/دارک و تمِ رنگی همسو شوند.
6. در `features/announcements/TemporaryModals/archive/_Example.tsx`، مقادیر هاردکد `sky` را با `primary`/`primary-hover`/`on-primary` مطابق کامنتِ ممیزی اصلاح کن.
7. در `features/habits/components/HabitManagerModal.tsx`، کلاسِ `text-black` در کنار `bg-primary` را به `text-on-primary` تغییر بده. در `features/notes/components/NoteEditorModal.tsx` نیز همین اصلاحِ `text-black` → `text-on-primary` (همراه با تیکت و آیکون آن) را انجام بده.
8. در `features/projects/components/ProjectDetailsModal.tsx`، آیکون تسک (`text-green-500` → `text-success`) و آیکون یادداشت (`text-purple-400` → `text-[var(--text-muted)]`) را اصلاح کن.

**محدودیت‌های اختصاصی تسک:**
- **باید:** دقت صددرصدی در جایگزینیِ لایه-به-لایهٔ مودال‌های تودرتو (استایل‌ها مثل `glass-card`، `bg-[var(--bg-card)]` یا `hover:bg-primary/10`).
- **نباید:** دستکاری در بیزینس لاجیکِ تب‌ها یا رویدادهای onClick.

**معیار پذیرش میکرو:**
- پس از اجرا، هیچ رشته‌ای مانند `"sky-"`, `"purple-"`, `"zinc-"`, `"slate-"` در نام کلاس‌های این فایل‌ها پیدا نمی‌شود و همه با تمِ کاربریِ فعلی سازگارند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/chat/ChatView.tsx", "features/chat/components/MoreCitationsModal.tsx", "features/notes/components/LinkTaskPicker.tsx", "features/tasks/components/LinkNotePicker.tsx", "components/PersianDatePicker.tsx", "components/TimePicker.tsx", "features/announcements/TemporaryModals/archive/_Example.tsx", "features/habits/components/HabitManagerModal.tsx", "features/notes/components/NoteEditorModal.tsx", "features/projects/components/ProjectDetailsModal.tsx"]
```

---

### تسک M-8: رفعِ رنگ‌های هاردکد در فایل‌های بخشِ مالی (Billing) و پروفایل [DONE]

**عنوان:** استانداردسازیِ پالتِ مودال‌هایِ پرداخت، آپلودِ رسید و تیکت‌ها با توکن‌های اصلیِ اپلیکیشن.

**راهنمای پیاده‌سازی فنی:**
1. در `features/billing/components/PaymentMethodModal.tsx` تمامِ کلاس‌های `indigo-950/40`، `indigo-400`، `indigo-600` و `emerald-600/teal-500` را به رنگ‌هایِ استاندارد و معناییِ اپ (`primary/10`، `text-primary`، `bg-primary`، `success`) تبدیل کن (پیروِ جدول ممیزی).
2. در `features/billing/components/ReceiptUploadModal.tsx` ارجاعات مشابه `indigo-*` و مقادیر رنگیِ هشداردهنده (تغییر از قرمز هاردکد به `var(--semantic-error)`) را اصلاح کن.
3. در `features/billing/components/RenewReminderModal.tsx` کلاس‌های `red-500/red-600` را با توکن‌های معنایی `bg-warning` / `bg-error` / `border-[var(--semantic-warning)]` برحسب کاربردشان آپدیت کن.
4. در `features/billing/components/SubscriptionModal.tsx` لیترال‌های `amber-*` را با کلاس‌های معناییِ `warning` (مثل `bg-warning/20`) یکسان‌سازی کن.
5. در `components/SupportTicketModal.tsx` تمام پالت‌های هاردکدِ مختص‌به‌تیکت (`indigo`, `sky`, `emerald`, `red`, گرادیان `purple-600`) را با توکن‌های سیستم (`bg-[var(--bg-card)]`, `text-primary`, `bg-primary/10`، و توکن‌های semantic) جابجا کن و پالتِ دکمه‌های CTA را مطابق با رویه‌ی `SubscriptionPage` هماهنگ ساز.

**محدودیت‌های اختصاصی تسک:**
- **نباید:** تغییری در متون خطا، ترجمه‌ها یا روند `startCheckout` / `verifyPayment` ایجاد شود.

**معیار پذیرش میکرو:**
- صفحات مربوط به Subscription و Billing بدون توجه به اینکه تم کاربر سبز، آبی یا بنفش است همخوانی ۱۰۰٪ رنگی و کانتراست استاندارد دارند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/billing/components/PaymentMethodModal.tsx", "features/billing/components/ReceiptUploadModal.tsx", "features/billing/components/RenewReminderModal.tsx", "features/billing/components/SubscriptionModal.tsx", "components/SupportTicketModal.tsx"]
```

---

### تسک M-9: اعمالِ `themeManager` در UI و تکمیل توگلِ تم (`ProfileModal.tsx`, `Sidebar.tsx`) [DONE]

**عنوان:** سیم‌کشیِ دکمه‌هایِ UI برای فراخوانیِ توابعِ `themeManager.ts` و فعال‌سازیِ ۳ تم رنگی.

**راهنمای پیاده‌سازی فنی:**
1. در `components/ProfileModal.tsx` و `components/Sidebar.tsx`، تابع `import { toggleDarkMode, getStoredColorTheme, applyColorTheme, COLOR_THEMES, ColorTheme } from '../utils/themeManager';` را وارد کن.
2. هندلرِ `handleToggleTheme` فعلیِ درونِ هر دو کامپوننت را پاک کرده و به تماس به `toggleDarkMode()` هدایت کن؛ وضعیتِ خروجی (true/false) را در استیتِ محلی `isDarkTheme` ذخیره کن.
3. **فقط در `ProfileModal.tsx`**:
   - یک state محلیِ جدید به نام `selectedColorTheme` تعریف کن (مقدارِ اولیه‌اش با `getStoredColorTheme()` تنظیم شود).
   - یک `<div className="flex gap-2 ...">` جذاب در همان بخش‌هایِ تنظیمی مودال (درست زیر یا کنار توگل دارک مود) اضافه کن که سه دکمه‌ی کوچک و دایره‌ای رندر کند. هر دکمه یکی از سه تم (سبز/آبی/بنفش) را نمایندگی می‌کند.
   - هر دکمه `onClick={() => { applyColorTheme(theme.id); setSelectedColorTheme(theme.id); }}` را صدا بزند. رنگِ درونی دکمه‌ها را به‌صورت hardcode فقط برای خود دکمه (مثلاً `bg-[#D8F066]`, `bg-[#66B6F0]`, `bg-[#A666F0]`) تنظیم کن تا بصری کاربر بتواند ببیند روی چه رنگی کلیک می‌کند؛ دکمه‌ی تمِ فعال را با رینگ (`ring-2 ring-white/50` یا مشابه) برجسته کن.

**محدودیت‌های اختصاصی تسک:**
- **باید:** منطق تمِ رنگیِ جدید و دارک مودِ قدیمی هر دو توسط `themeManager` کپسوله و اعمال شوند.
- **نباید:** دکمه‌های تم رنگی به `Sidebar.tsx` اضافه شوند (در سایدبار فقط توگل خورشید/ماه/دارک‌مود می‌ماند).

**معیار پذیرش میکرو:**
- کاربر در `ProfileModal.tsx` سه دایره‌ی رنگی می‌بیند؛ کلیک روی هر یک بی‌درنگ رنگ‌بندی تمام `primary` ها در اپلیکیشن را تغییر می‌دهد. توگلِ دارک‌مود هم بدون نقص همچنان کار می‌کند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["components/ProfileModal.tsx", "components/Sidebar.tsx"]
```

---

### تسک M-10: ممیزیِ نهایی و Verification Gate (بدون کدنویسی)

**عنوان:** تضمین کیفیت (QA)، اجرای بیلد نهایی، و تست کارکردی اپلیکیشن.

**راهنمای پیاده‌سازی فنی:**
1. هیچ فایلِ TypeScript یا CSS در این مرحله ویرایش نمی‌شود.
2. با اجرای فرمان `npm run build` مطمئن شو که حذف فایل‌های تسک M-3 و refactorهای بعدیِ M-4 تا M-9 **و M-11** هیچ شکستی در ایمپورت‌ها به جا نگذاشته‌اند (M-11 باید پیش از این تسک، طبقِ ترتیبِ اجرای فاز، کامل شده باشد).
3. خطاهای تایپ‌اسکریپت و ESLint بررسی شوند. اگر اروری بود، با ارائه‌ی دلیل ریشه‌ای (Root Cause Analysis) در پرامپت، خطاها مرتفع گردند (در صورت نیاز فایل‌های مورد نظر ویرایش می‌شوند).

**محدودیت‌های اختصاصی تسک:**
- **باید:** خروجی Terminal و CLI دقیقاً خوانده شده و بررسی شود.

**معیار پذیرش میکرو:**
- اپلیکیشن بدونِ خطا build شده، هیچ فایل dead code وجود ندارد و تمام ویژگی‌های رنگی آماده استفاده‌ی پروداکشن هستند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: []
```

---

### تسک M-11: اصلاحِ کنتراستِ رنگِ برند روی سطحِ روشن (توکنِ جدیدِ `--color-primary-text`)

**عنوان:** جداسازیِ توکنِ «رنگِ متن/آیکونِ برند» از توکنِ «رنگِ پس‌زمینه‌ی برند» برای تضمینِ خوانایی در هر ۳ تم و هر دو مد.

**راهنمای پیاده‌سازی فنی:**
1. در `index.css`، دقیقاً بلوک‌های زیر را اضافه کن (کنارِ توکن‌های `--color-primary` موجود؛ این توکن‌ها فقط اضافه می‌شوند، چیزی حذف نمی‌شود):
```css
:root {
  --color-primary-text-rgb: 109 126 27;
  --color-primary-text: #6D7E1B;
}
[data-color-theme="blue"] {
  --color-primary-text-rgb: 39 123 183;
  --color-primary-text: #277BB7;
}
[data-color-theme="purple"] {
  --color-primary-text-rgb: 153 76 240;
  --color-primary-text: #994CF0;
}
.dark {
  --color-primary-text-rgb: var(--color-primary-rgb);
  --color-primary-text: var(--color-primary);
}
[data-color-theme="purple"].dark {
  --color-primary-text-rgb: 172 117 235;
  --color-primary-text: #AC75EB;
}
```
2. در `index.html`، داخلِ همان آبجکتِ `colors` در `tailwind.config` (کنارِ `primary`, `primary-hover`, `on-primary`, ...)، یک کلیدِ جدید اضافه کن:
```js
'primary-text': 'rgb(var(--color-primary-text-rgb) / <alpha-value>)',
```
3. در تمامِ ۳۰ فایلِ فهرست‌شده در ARCHITECTURE §M.9، هر رخدادِ کلاسِ `text-primary` (شاملِ حالت‌های اپاسیتی مثلِ `text-primary/70`, `text-primary/50` و...) را به `text-primary-text` (با همان پسوندِ اپاسیتیِ اصلی، مثلِ `text-primary-text/70`) و هر رخدادِ `text-[var(--color-primary)]` را به `text-[var(--color-primary-text)]` تغییر بده.

**محدودیت‌های اختصاصی تسک:**
- **باید:** این تغییر فقط رویِ کلاسِ `text-*`/مقدارِ متنیِ arbitrary اعمال شود.
- **نباید:** به هیچ‌وجه `bg-primary`, `border-primary`, `ring-primary`, `shadow-primary`, `from-primary`, `via-primary`, `to-primary` یا خودِ متغیرِ `--color-primary` تغییر کند — این‌ها برایِ پس‌زمینه/حاشیه/سایه‌اند و همان رنگِ زنده و پرکنتراستِ فعلی باید بمانند.
- **نباید:** فایل‌هایِ خارج از فهرستِ ۳۰‌تایی دست بخورند (فقط همان‌ها `text-primary`/`text-[var(--color-primary)]` دارند؛ اگر موردِ جدیدی هنگامِ جست‌وجو پیدا شد که در لیست نیست، قبل از تغییر با معمار هماهنگ شود).

**معیار پذیرش میکرو:**
- در سراسرِ کدِ زنده، هیچ رخدادِ باقی‌مانده‌ای از کلاسِ خامِ `text-primary` یا `text-[var(--color-primary)]` وجود ندارد (`grep -rn "text-primary\b\|text-\[var(--color-primary)\]"` روی `components/` و `features/` باید صفر نتیجه بدهد، به‌جز مواردی که خودِ `text-primary-text` است که با `\b` از `text-primary` جدا تشخیص داده می‌شود).
- در هر ۳ تم × هر ۲ مد (۶ حالت)، هر متن/آیکونِ برندی که رویِ زمینه‌ی روشن (`--bg-card` یا سفید) رندر می‌شود، به‌وضوح و بدونِ فشارِ چشم خوانا است.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["index.css", "index.html", "components/Auth.tsx", "components/PaywallModal.tsx", "components/ProfileModal.tsx", "components/ui/ToastNotifications.tsx", "features/billing/components/SubscriptionModal.tsx", "features/billing/components/UsageMeter.tsx", "features/billing/pages/SubscriptionPage.tsx", "features/chat/ChatView.tsx", "features/chat/components/ActionResultCard.tsx", "features/chat/components/ChatHistoryDrawer.tsx", "features/chat/components/CitationCard.tsx", "features/chat/components/ProposalCard.tsx", "features/dashboard/components/AiComposerPanel.tsx", "features/dashboard/components/FocusTimer.tsx", "features/dashboard/components/OverdueTasksModal.tsx", "features/dashboard/components/ProductivityChart.tsx", "features/dashboard/components/WeeklyReportModal.tsx", "features/habits/components/HabitManagerModal.tsx", "features/habits/components/HabitStatsView.tsx", "features/notes/NotesView.tsx", "features/notes/components/NoteCard.tsx", "features/notes/components/NoteEditorModal.tsx", "features/onboarding/components/NameStep.tsx", "features/onboarding/components/SlideCard.tsx", "features/onboarding/components/WelcomeChoice.tsx", "features/projects/components/ProjectCard.tsx", "features/projects/components/ProjectDetailsModal.tsx", "features/tasks/TasksView.tsx", "features/tasks/components/TaskCard.tsx", "features/tasks/components/TaskEditorModal.tsx"]
```

> **نکته‌ی توالی:** M-11 باید پس از **M-1** (چون به توکن‌های پایه‌ی `--color-primary-rgb` هر تم وابسته است) اجرا شود. چون M-11 روی ۳۰ فایل کار می‌کند و برخی از آن‌ها (`ProfileModal.tsx`, `ChatView.tsx`, `ProductivityChart.tsx`, `FocusTimer.tsx`, `OverdueTasksModal.tsx`, `NoteEditorModal.tsx`, `HabitManagerModal.tsx`, `ProjectDetailsModal.tsx`, `TaskCard.tsx`, `ProjectCard.tsx`, `NotesView.tsx`, `AiComposerPanel.tsx`) هم توسطِ M-2/M-4/M-5/M-6/M-7/M-9 ویرایش می‌شوند، **M-11 باید بعد از اتمامِ همه‌ی M-2 تا M-9 روی این فایل‌های مشترک اجرا شود** (آخرین لایه‌ی ویرایش، تا با تغییراتِ آن‌ها تداخل/Merge نداشته باشد). `index.css`/`index.html` هم چون در M-1 ویرایش می‌شوند، این بخش از M-11 باید بعد از M-1 (نه هم‌زمانش) انجام شود.

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
