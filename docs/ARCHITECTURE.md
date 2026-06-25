# ARCHITECTURE.md — نقشه‌ی مهندسی فاز L2 (Visual Overhaul)

> این سند «چه چیزی» و «چرایی» فاز L2 را تعریف می‌کند؛ «چگونگی» گام‌به‌گام در `tasks.md` (L2-1 تا L2-N).
> اصول حاکم (که از قبل پیاده شده‌اند و دست‌نخورده می‌مانند): **Server-Authoritative**، **RLS-First**، **Atomic via RPC**.

---

## ۱. وضعیت موجود (Snapshot — برای زمینه، نه برای تغییر)

> این بخش فقط برای آگاهی کدنویس است. این موارد ساخته‌شده‌اند و در این فاز بازنویسی نمی‌شوند مگر صریحاً در یک تسک گفته شود.

### ۱.۱. ساختار فعلی فرانت‌اند

- **`App.tsx`** (ورودی اصلی): مدیریت Page routing، رندر `BottomNav`، lazy-load صفحات سنگین (`ChatView`, `ProjectsView`, `SubscriptionPage`)، مودال‌های سراسری (`TaskEditorModal`, `NoteEditorModal`, `HabitManagerModal`, `PaywallModal`, `ProfileModal`)، `NetworkBanner`، `ToastNotifications`. کانتینر ریشه: `bg-gray-950 min-h-screen text-white` با `h-[100dvh]`.
- **`contexts/`**: `AuthContext` (احراز هویت Supabase) و `DataContext` (دسترسی سراسری به داده از طریق `useDataManager`).
- **`hooks/`**: `useDataManager` (CRUD کامل + استیت)، `useOfflineSync`، `useRealtimeSync`، `useReminderScheduler`، `useNetworkStatus`.
- **`services/`**: لایه‌ی ارتباط با Supabase و Gemini. تغییر ساختاری ممنوع.
- **`components/`**: کامپوننت‌های مشترک (`BottomNav`, `Modal`, `icons`, `NetworkBanner`, `ToastNotifications`, `ProfileModal`, `PaywallModal`, `Auth`).
- **`features/`**: ساختار feature-based برای dashboard، tasks، notes، projects، chat، habits، billing، onboarding، announcements.

### ۱.۲. ساختار فعلی داشبورد (`features/dashboard/`)

| فایل | نقش | کلاس‌های پایه‌ی فعلی | نکات حیاتی |
|------|------|----------------------|-------------|
| `Dashboard.tsx` | ارکستراسیون: هدر + grid ۵ ستونی + مودال‌ها | `pb-2` → `px-4 sm:px-6 max-w-7xl mx-auto space-y-6 pt-5` | استیت `isProfileOpen`, `isReportOpen`؛ محاسبه `selectedDayProgressStats` |
| `DashboardHeader.tsx` | هدر چسبان موبایل با رینگ پیشرفت | `bg-gray-950/80 backdrop-blur-xl border-b border-white/10 pt-safe` | **قانون طلایی: ساختار حفظ شود، فقط استایل آپدیت شود**؛ props: `onOpenProfile`, `todayProgress`, `hasTasksToday` |
| `WeekCalendar.tsx` | تقویم هفته‌ی جاری | روز فعال: `bg-gradient-to-br from-indigo-500 to-purple-600` | props: `selectedDate`, `onDateChange`؛ استفاده از `toJalaali`, `persianMonths` |
| `TodaysPlan.tsx` | لیست کارهای امروز | `WidgetContainer` + checkbox `bg-sky-500 border-sky-400` | `toggleTaskCompletion`؛ sort: done → آخر |
| `TodaysNotes.tsx` | یادداشت‌های امروز | `bg-black/30 backdrop-blur-xl border border-white/5 rounded-2xl` | فیلتر با `isSameTehranDay` — مستقل از WidgetContainer |
| `QuickCapture.tsx` | ورودی سریع | `WidgetContainer` + textarea `bg-gray-800/70` + دکمه `bg-sky-600/80` و `bg-purple-600/80` | `addTask`, `addNote`؛ استیت `input` |
| `StatsOverview.tsx` | ۴ کارت آمار + دکمه‌ی گزارش | `WidgetContainer` + StatCard `bg-gray-800/70 border border-white/5` + دکمه `bg-zinc-850/40` | `onOpenWeeklyReport` باید به `WeeklyReportModal` متصل شود |
| `HabitTracker.tsx` | ردیاب عادت‌ها | `WidgetContainer` + checkbox `bg-green-500 border-green-400` + دکمه `bg-orange-600/20` | `toggleHabitCompletion`, `editHabit` |
| `KeyProjects.tsx` | پروژه‌های اولویت‌بالا | `WidgetContainer` + progress bar `bg-gray-700/50` + `getColorClass()` | فیلتر `Priority.High` |
| `WeeklyReportModal.tsx` | مودال گزارش هفتگی | `bg-zinc-950/90 border-t sm:border border-white/10 rounded-t-[2.5rem]` | استیت `activeTab`؛ محاسبه `weekBoundaries`؛ motion/react |
| `WidgetContainer.tsx` | wrapper پایه‌ی ویجت‌ها | `bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/30` | فقط `children` + `className` + `id` |

### ۱.۳. استایل سراسری فعلی (`index.css`)

- متغیرهای `safe-area-inset` (top/bottom) — **حیاتی برای iOS**.
- کلاس‌های `.pt-safe`, `.pb-safe`, `.pb-safe-content`, `.pb-bottom-nav`, `.bottom-nav-inset`, `.pb-safe-lg`, `.safe-spacer-bottom`.
- هک‌های `-webkit-overflow-scrolling: touch`، `overscroll-behavior: contain`، `-webkit-text-size-adjust: 100%`.
- هک autofill برای فیلدهای فرم.
- **هیچ توکن رنگی وجود ندارد.** همه‌ی رنگ‌ها هاردکد شده در کلاس‌های Tailwind کامپوننت‌ها.
- **همه‌ی این موارد باید دست‌نخورده بمانند.**

### ۱.۴. `index.html` فعلی

- Tailwind CDN (`cdn.tailwindcss.com`).
- فونت Vazirmatn از Google Fonts.
- `theme-color` meta = `#09090b`.
- importmap برای React/Vite/Supabase.
- **هیچ اسکریپت تشخیص تم وجود ندارد.**

### ۱.۵. سایر صفحات (فاز دوم)

| صفحه | فایل اصلی | رنگ‌های فعلی که باید جایگزین شوند |
|------|-----------|----------------------------------|
| تسک‌ها | `features/tasks/TasksView.tsx` | `bg-sky-500/10 border-sky-500/20 text-sky-400`, `text-zinc-500`, `bg-zinc-900`, `border-zinc-800` |
| کارت تسک | `features/tasks/components/TaskCard.tsx` | `bg-sky-500 border-sky-500`, `bg-zinc-900/60 border-white/5`, `text-zinc-200`, `text-zinc-500` |
| یادداشت‌ها | `features/notes/NotesView.tsx` | `bg-zinc-950`, `from-purple-600 to-fuchsia-600`, `bg-zinc-900 border-zinc-800` |
| کارت یادداشت | `features/notes/components/NoteCard.tsx` | `bg-zinc-900 border-white/5`, `from-purple-500/20 to-fuchsia-600/20` |
| پروژه‌ها | `features/projects/ProjectsView.tsx` | `bg-slate-950`, `bg-sky-600`, `from-white via-indigo-200 to-sky-300` |
| کارت پروژه | `features/projects/components/ProjectCard.tsx` | `bg-zinc-900/60 border-white/5`, `colorClasses` و `priorityClasses` با sky/red/green/yellow/purple |
| چت AI | `features/chat/ChatView.tsx` | `bg-sky-600`, `bg-gray-800/50`, `text-sky-400`, `ring-sky-400/50` |
| نوار پایین | `components/BottomNav.tsx` | `bg-gray-900/70 backdrop-blur-xl border-white/10`, `from-sky-500 to-fuchsia-500`, `text-sky-400`, `text-gray-500` |
| نوار کناری | `components/Sidebar.tsx` | **خالی (۰ بایت)** — باید ساخته شود |
| Auth | `components/Auth.tsx` | `bg-gray-950`, `text-sky-400`, `bg-sky-600` |
| ProfileModal | `components/ProfileModal.tsx` | `bg-gray-900 border-white/10`, `text-sky-400` |
| PaywallModal | `components/PaywallModal.tsx` | `bg-gray-900 border-white/10`, `bg-sky-600` |

---

## ۲. معماری فاز L2 — ریدیزاین داشبورد (فاز اول)

### ۲.۱. استراتژی کلی

تمام کامپوننت‌های زنده از تم تیره‌ی هاردکد شده استفاده می‌کنند. هدف: جایگزینی تمام رنگ‌های هاردکد با توکن‌های CSS Variable که در `index.css` تعریف می‌شوند، و افزودن چیدمان دسکتاپ سه‌ستونه.

**رویکرد:** «توکن جایگزین هاردکد» — هر کلاس رنگی هاردکد شده (مثل `bg-gray-900/50`) با کلاس توکنی معادل (مثل `glass-card`) جایگزین می‌شود. هیچ کدی از فایل ماکت استاتیک کپی نمی‌شود. تمام دستورالعمل‌ها در `tasks.md` به صورت دقیق «کلاس X را حذف کن، کلاس Y را اضافه کن» مشخص شده‌اند.

### ۲.۲. ساختار چیدمان دسکتاپ (سه‌ستونه) — الگوی گرید واحد

در `Dashboard.tsx` فعلی، چیدمان `grid grid-cols-1 lg:grid-cols-5` وجود دارد. باید به یک گرید واحد ارتقا یابد که در دسکتاپ سه‌ستونه و در موبایل تک‌ستونه می‌شود — **بدون دو کپی از کامپوننت‌ها**.

**الگوی صحیح (Single-Tree Responsive Grid):**

```
<div className="bg-nature" />  ← پس‌زمینه (fixed, z-index: -1)

<div className="px-4 sm:px-6 max-w-[1280px] mx-auto pt-5 pb-2">
  {/* هدر موبایل — فقط در موبایل */}
  <div className="lg:hidden">
    <DashboardHeader ... />
  </div>

  {/* گرید واحد — در موبایل ۱ ستون، در دسکتاپ ۳ ستون */}
  <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] gap-4 lg:gap-6">

    {/* ستون ۱: Sidebar — فقط در دسکتاپ */}
    <div className="hidden lg:flex">
      <Sidebar onOpenProfile={() => setIsProfileOpen(true)} />
    </div>

    {/* ستون ۲: مرکز فرمان — همیشه */}
    <div className="space-y-6">
      <QuickCapture />
      <ProductivityChart />
      <TodaysPlan />
    </div>

    {/* ستون ۳: بافتار داده — همیشه */}
    <div className="space-y-6">
      <StatsOverview onOpenWeeklyReport={() => setIsReportOpen(true)} />
      <WeekCalendar ... />
      <KeyProjects />
      <FocusTimer />
    </div>
  </div>
</div>
```

**قانون حیاتی — ممنوعیت Duplicate Mounting:**
- هر کامپوننت (`QuickCapture`, `TodaysPlan`, `StatsOverview` و...) **دقیقاً یک بار** در درخت JSX نوشته شود.
- چیدمان موبایل/دسکتاپ فقط از طریق کلاس‌های responsive گرید (`grid-cols-1 lg:grid-cols-[...]`) و wrapper های `hidden lg:flex` / `lg:hidden` کنترل شود.
- ساخت کانتینرهای مجزا برای موبایل و دسکتاپ که همان کامپوننت‌ها را دوباره رندر کنند **اکیداً ممنوع است** — این کار باعث Double Mount، دو بار اجرای `useData()`، Race Condition در سینک آفلاین و هدر منابع می‌شود.
- `DashboardHeader` در یک wrapper `lg:hidden` قرار گیرد (فقط موبایل).
- `Sidebar` در یک wrapper `hidden lg:flex` قرار گیرد (فقط دسکتاپ).
- بقیه کامپوننت‌ها بدون wrapper نمایش/پنهان باشند — گرید به طور خودکار در موبایل تک‌ستونه و در دسکتاپ سه‌ستونه می‌شود.

### ۲.۳. توکن‌های CSS Variable (اضافه شدن به `index.css`)

این توکن‌ها باید به `index.css` اضافه شوند (در `:root` و `.dark`):

**Light Mode (`:root`):**
`--color-primary: #D8F066`، `--color-primary-hover: #C1DB3C`، `--text-on-primary: #000000`
`--bg-image: url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2500&auto=format&fit=crop')`
`--bg-app-glass: rgba(244,245,247,0.6)`، `--bg-panel-glass: rgba(255,255,255,0.7)`، `--bg-card: rgba(255,255,255,0.85)`
`--text-main: #111827`، `--text-muted: #6B7280`، `--border-subtle: #E5E7EB`، `--border-neon: transparent`
`--input-focus-ring: #111827`، `--nav-active-bg: var(--color-primary)`، `--nav-active-text: var(--text-on-primary)`
`--nav-hover-bg: rgba(255,255,255,0.6)`، `--ink-bg: #16161A`، `--ink-text: #FFFFFF`
`--semantic-error: #EF4444`، `--semantic-error-soft: rgba(239,68,68,0.1)`، `--semantic-success: #10B981`
`--shadow-glass: 0 30px 60px -15px rgba(0,0,0,0.15)`، `--shadow-card: 0 10px 25px rgba(0,0,0,0.05)`، `--shadow-btn: none`
`--radius-sm: 12px`، `--radius-md: 16px`، `--radius-lg: 24px`، `--radius-pill: 9999px`

**Dark Mode (`.dark`):**
`--bg-image: url('https://images.unsplash.com/photo-1480497490787-505ec076689f?q=80&w=2500&auto=format&fit=crop')`
`--bg-app-glass: rgba(18,18,20,0.6)`، `--bg-panel-glass: rgba(30,41,59,0.4)`، `--bg-card: rgba(30,41,59,0.55)`
`--text-main: #F9FAFB`، `--text-muted: #9CA3AF`، `--border-subtle: #334155`، `--border-neon: #D8F066`
`--input-focus-ring: #D8F066`، `--nav-active-bg: rgba(216,240,102,0.08)`، `--nav-active-text: var(--color-primary)`
`--nav-hover-bg: rgba(255,255,255,0.05)`، `--ink-bg: rgba(216,240,102,0.08)`، `--ink-text: var(--color-primary)`
`--semantic-error: #FF6B6B`، `--semantic-error-soft: rgba(255,107,107,0.1)`، `--semantic-success: #22C55E`
`--shadow-glass: none`، `--shadow-card: none`، `--shadow-btn: none`

### ۲.۴. کلاس‌های کمکی (اضافه شدن به `index.css`)

```css
.glass-app { background: var(--bg-app-glass); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-glass); transition: all 0.4s ease; }
.glass-panel { background: var(--bg-panel-glass); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-card); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: all 0.4s ease; }
.glass-card { background: var(--bg-card); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-card); transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
.glass-card:hover { transform: translateY(-2px); }
.tile-ink { background: var(--ink-bg); color: var(--ink-text); border: 1px solid var(--border-neon); box-shadow: var(--shadow-card); transition: all 0.4s ease; }
.tile-lime { background-color: var(--color-primary); color: var(--text-on-primary) !important; border: none; box-shadow: var(--shadow-card); }
.dark .tile-lime { box-shadow: 0 0 25px rgba(216,240,102,0.15); }
.nav-active { background: var(--nav-active-bg); color: var(--nav-active-text); border: 1px solid var(--border-neon); font-weight: bold; transition: all 0.3s ease; }
.bg-lime { background-color: var(--color-primary); color: var(--text-on-primary) !important; }
.text-lime { color: var(--color-primary); }
.bg-nature { position: fixed; inset: 0; z-index: -1; background-image: var(--bg-image); background-size: cover; background-position: center; transition: background-image 0.8s ease-in-out; }
.bg-nature::after { content: ''; position: absolute; inset: 0; background: rgba(244,245,247,0.1); transition: all 0.8s ease-in-out; }
.dark .bg-nature::after { background: rgba(12,12,14,0.4); }
@media (max-width: 1023px) { .bg-nature::after { background: rgba(244,245,247,0.35); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); } .dark .bg-nature::after { background: rgba(12,12,14,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); } }
.soft-scroll::-webkit-scrollbar { width: 4px; }
.soft-scroll::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 99px; opacity: 0.3; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.task-check.is-done { background: var(--color-primary); border-color: var(--color-primary); }
.task-check.is-done svg { color: var(--text-on-primary); }
```

### ۲.۵. جدول جایگزینی جامع رنگ‌ها

> این جدول مرجع اصلی تمام تسک‌هاست. هر کلاس قدیمی در کامپوننت‌ها باید با معادل جدید جایگزین شود.

| کلاس قدیمی (هاردکد) | کلاس جدید (توکنی) | کاربرد |
|---------------------|-------------------|--------|
| `bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl` | `glass-card rounded-[var(--radius-lg)]` | WidgetContainer و کارت‌ها |
| `bg-gray-800/70 border border-white/5` | `glass-card rounded-[var(--radius-md)]` | StatCard و کارت‌های کوچک |
| `bg-gray-950/80 backdrop-blur-xl` | `backdrop-blur-xl` + `style={{ background: 'var(--bg-app-glass)' }}` | هدر چسبان |
| `bg-gray-950/90 backdrop-blur-xl` | `backdrop-blur-xl` + `style={{ background: 'var(--bg-app-glass)' }}` | هدر صفحات |
| `text-white` | `text-[var(--text-main)]` | متن اصلی |
| `text-gray-400` / `text-zinc-400` / `text-gray-500` | `text-[var(--text-muted)]` | متن فرعی |
| `border-white/5` / `border-white/10` / `border-zinc-800` | `border-[var(--border-subtle)]` | حاشیه‌ها |
| `bg-sky-500` / `bg-sky-600` | `bg-lime` یا `bg-[var(--color-primary)]` | دکمه‌ی Primary |
| `text-sky-400` | `text-[var(--color-primary)]` | متن لیمویی |
| `from-sky-500 to-fuchsia-500` | `bg-lime` (حذف gradient) | دکمه‌ی مرکزی BottomNav |
| `from-indigo-500 to-purple-600` | `bg-[var(--color-primary)]` | روز فعال تقویم |
| `bg-sky-500 border-sky-400` (checkbox done) | `bg-[var(--color-primary)] border-[var(--color-primary)]` | checkbox انجام‌شده |
| `border-sky-500` (hover/focus) | `border-[var(--input-focus-ring)]` | focus state |
| `ring-sky-500` / `ring-sky-400/50` | `ring-[var(--color-primary)]/50` | ring focus |
| `bg-sky-500/10 text-sky-400 border-sky-500/20` | `bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--border-neon)]` | ViewMode فعال / badge |
| `bg-red-500/20 text-red-300` | `bg-[var(--semantic-error-soft)] text-[var(--semantic-error)]` | badge خطا |
| `bg-green-500/20 text-green-300` | `bg-[var(--color-primary)]/10 text-[var(--color-primary)]` | badge موفقیت |
| `bg-orange-600/20 text-orange-400` | `bg-[var(--color-primary)]/10 text-[var(--color-primary)]` | دکمه عادت |
| `bg-gray-950` (ریشه App) | حذف — `bg-nature` div اضافه شود | پس‌زمینه ریشه |
| `shadow-sky-500/30` | `shadow-[0_0_15px_rgba(216,240,102,0.3)]` | سایه لیمویی |
| `bg-zinc-950/90 border-white/10` (مودال) | `bg-[var(--bg-card)] border-[var(--border-subtle)]` | بدنه مودال |

---

## ۳. معماری فاز L2 — ریدیزاین سایر صفحات (فاز دوم)

### ۳.۱. اصول

- **بدون شکستن ساختار المان‌ها** (مگر موارد خاص و ضروری).
- تمرکز: جایگزینی رنگ‌های هاردکد با توکن‌های CSS Variable، بومی‌سازی چیدمان دسکتاپ، ریسپانسیو کردن.
- تمام صفحات باید خط‌به‌خط با سیستم جدید منطبق شوند.
- **هدر موبایل:** ساختار فعلی حفظ، فقط رنگ/پدینگ/استایل آپدیت شود.
- **BottomNav:** ساختار فعلی حفظ، فقط رنگ/استایل آپدیت شود.

### ۳.۲. هک‌های iOS/Safari که نباید آسیب ببینند

1. `env(safe-area-inset-bottom/top)` در `index.css` و کامپوننت‌ها.
2. `-webkit-overflow-scrolling: touch` برای اسکرول نرم مودال‌ها.
3. `overscroll-behavior: contain/none` برای جلوگیری از scroll chaining.
4. `-webkit-text-size-adjust: 100%` برای جلوگیری از zoom متن.
5. `h-[100dvh]` به جای `h-screen` در `App.tsx`.
6. `-webkit-tap-highlight-color: transparent` (در ماکت وجود دارد، باید به `index.css` اضافه شود).
7. `viewport-fit=cover` در meta tag.
8. کلاس‌های `.pb-safe`, `.pt-safe`, `.pb-bottom-nav`, `.bottom-nav-inset`, `.safe-spacer-bottom`.
9. `maximum-scale=1.0, user-scalable=no` در viewport meta.
10. هک autofill `-webkit-box-shadow: 0 0 0px 1000px #09090b inset` — **باید در دارک‌مود باقی بماند ولی در لایت‌مود باید رنگ آن به سفید تغییر کند.**

---

## ۴. مسیردهی فایل‌های جدید

| فایل جدید | مسیر | نقش |
|-----------|------|------|
| `ProductivityChart.tsx` | `features/dashboard/components/` | چارت SVG بهره‌وری هفته |
| `FocusTimer.tsx` | `features/dashboard/components/` | تایمر تمرکز عمیق / Pomodoro |
| `Sidebar.tsx` (بازنویسی) | `components/` | نوار کناری دسکتاپ |

> **توجه:** هیچ فایل جدیدی خارج از مسیرهای فوق ساخته نشود. هیچ پکیج npm جدیدی نصب نشود.

---

## ۵. قوانین تطبیق با کامپوننت‌های زنده

1. **هر مودال باید به هندلر زنده متصل بماند.** مثال: دکمه «مشاهده» در StatsOverview → `onOpenWeeklyReport()` → `WeeklyReportModal`.
2. **هر آیتم ناوبری باید به `setPage()` متصل شود.** مثال: «خانه» → `Page.Dashboard`، «کارها» → `Page.Tasks`.
3. **هر checkbox باید به `toggleTaskCompletion()` متصل بماند.**
4. **هر input در QuickCapture باید به `addTask()` / `addNote()` متصل بماند.**
5. **رینگ پیشرفت هدر باید به `todayProgress` و `hasTasksToday` متصل بماند.**
6. **toggle تم (light/dark) باید به مکانیزم `localStorage('hexer-theme')` متصل شود.**
7. **هیچ داده‌ی استاتیک به عنوان hardcode در کامپوننت نماند؛ همه باید به داده‌های زنده از `useData()` متصل شود.**
8. **هیچ کدی از فایل ماکت استاتیک `dashboard_redisign/index.html` کپی نشود. تمام دستورالعمل‌های بصری در `tasks.md` به صورت دقیق کلاس‌به‌کلاس مشخص شده‌اند.**