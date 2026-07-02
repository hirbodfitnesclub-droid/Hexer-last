

# فاز L2 — نقشه‌ی راهِ ریدیزاین بصری (Visual Overhaul)

> **مرجع کامل:** `docs/ARCHITECTURE.md` و `docs/PROJECT.md` فاز L2.
> **هدف:** بازطراحی بصری کامل اپلیکیشن HEXER با تم Soft Cyber-Lime.
> **مدل کدنویس:** Gemini 3.5 Flash — تسک‌ها طوری چیده شده‌اند که ادیت‌های نقطه‌ای روی کلاس‌های Tailwind و JSX انجام شود و به کدهای منطقی دست زده نشود.
> **قانون ممنوعیت کپی:** هیچ کدی از فایل `dashboard_redisign/index.html` کپی نشود. تمام دستورالعمل‌های بصری در این فایل به صورت دقیق مشخص شده‌اند.
> **مرجع جایگزینی رنگ:** جدول جامع در `ARCHITECTURE.md` §۲.۵ و نگاشت توکن در §۹.

> ### ⚠️ هشدارهای حیاتیِ بازنویسی (قبل از شروع هر تسک بخوان)
> 1. **پروتوتایپ = قانون:** `index.html` (ماکت) **طرحِ نهایی و قطعی** است. هیچ فیچری (مثل `FocusTimer`, `ProductivityChart`, `AiComposerPanel`) حذف یا موکول نمی‌شود. شِلِ گلسِ بانددارِ دسکتاپ و عکس‌های پس‌زمینه (با خودمیزبانی) دقیقاً پیاده می‌شوند.
> 2. **لایت‌مود نامرئی نشود:** کاشی‌های تیره (`tile-ink` / پومودورو / چارت / `StatsOverview`) باید مستقیماً رندر شوند، نه داخلِ `WidgetContainer`ِ روشن. متن‌شان همیشه سفید/تیره (`text-white` یا `--ink-text`) بماند. سایه‌های گلس در لایت‌مود حفظ شود.
> 3. **فایل‌های مرده:** هرگز فایل‌های مرده‌ی `components/` را ویرایش نکن (`Dashboard`, `ChatView` و...). فایل‌های زنده در `features/` هستند. رجوع به `ARCHITECTURE.md` §۶.
> 4. **منطقِ جدید فقط Presentational:** تایمر (`setInterval`)، چارت (`useMemo`)، و هندآفِ چت (`composerBridge`) فقط در لایه‌ی view کار می‌کنند. به بک‌اند/سرویس/`useDataManager`/context **دست زده نمی‌شود**.
> 5. **دارک‌مود + رنگ‌های کانالی:** `tailwind.config` در L2-2 باید شاملِ `darkMode:'class'` **و** مَپِ رنگ‌های کانالی باشد تا `bg-primary/10` معتبر بماند و نشکند.
> 6. **toggle تم:** نمایش آیکن CSS-محور است (`.theme-icon-*`). **هرگز کلاسِ `hidden`ی Tailwind روی آیکن‌های تم نگذار**.
> 7. **سایدبارِ دسکتاپ گلوبال:** `Sidebar` در `App.tsx` (کنار `<main>`) رندر می‌شود، نه در `Dashboard.tsx`. `BottomNav` فقط موبایل.
> 8. **حذف‌های تأییدشده:** `TodaysNotes` و `HabitTracker` در پروتوتایپ نیستند و طبق دستور **از درختِ رندرِ داشبورد حذف می‌شوند** (فایل‌ها می‌مانند).

---
گروه‌بندیِ محافظه‌کارانه (هر مرحله ≤۱۰ فایل؛ تسک‌های سنگین/ساختاری تکی):

مرحله	تسک‌ها	فایل‌های تحت تأثیر	تعداد	چرا این گروه؟
۱	L2-1 + L2-2 + L2-3	index.css · index.html · hooks/useMediaQuery.ts (جدید) · components/Sidebar.tsx	۴	پایه (توکن‌ها + کانفیگ Tailwind + هوک + سایدبار). همه سبک و به‌هم‌مرتبط.
۲	L2-4	App.tsx	۱	تکی — ساختاری/پرریسک. شِلِ گلسِ بانددار + جابجاییِ ProfileModal. تنهایی بده.
۳	L2-5 + L2-6	features/chat/composerBridge.ts (جدید) · features/chat/ChatView.tsx · features/dashboard/components/AiComposerPanel.tsx (جدید)	۳	واحدِ «پنل AI» (پل هندآف + خود پنل). به‌هم‌مرتبط.
۴	L2-7	features/dashboard/Dashboard.tsx	۱	تکی — ساختاری. مونتاژِ چیدمانِ دسکتاپ/موبایل. تنهایی بده.
۵	L2-8	features/dashboard/components/ProductivityChart.tsx	۱	تکی — سنگین (منطقِ چارت + داده).
۶	L2-9	features/dashboard/components/FocusTimer.tsx	۱	تکی — سنگین (منطقِ تایمر/interval).
۷	L2-10 + L2-11 + L2-12	StatsOverview.tsx · DashboardHeader.tsx · TodaysPlan.tsx · WeekCalendar.tsx · KeyProjects.tsx · App.tsx · types.ts	۷	استایلِ ویجت‌ها + پاکسازیِ سبکِ props مرده. همه کم‌ریسک.
۸	L2-13	ChatView.tsx · ModeChip.tsx · ChatHistoryDrawer.tsx · CitationCard.tsx · ProposalCard.tsx · ActionResultCard.tsx	۶	تکی — فقط استایلِ چت، ولی ۶ فایل.
۹	L2-14	TasksView · TaskCard · NotesView · NoteCard · ProjectsView · ProjectCard · WeeklyReportModal · ProfileModal · PaywallModal	۹	تکی — ۹ فایل. ↓ پایین را بخوان.


---
---
## فاز اول: ریدیزاین ساختاری و بصری داشبورد

### تسک L2-1: تزریق توکن‌های CSS Variable و کلاس‌های گلس به `index.css`

**عنوان:** اعمال توکن‌های Soft Cyber-Lime، کلاس‌های گلس و پس‌زمینه‌ی عکسِ خودمیزبان

**راهنمای پیاده‌سازی فنی:**
1. در `:root` موجود در `index.css`، **دو دسته توکن** را اضافه/جایگزین کن:
   - **(الف) توکن‌های کانالیِ RGB:** `--color-primary-rgb: 216 240 102`, `--color-primary-hover-rgb: 193 219 60`, `--on-primary-rgb: 0 0 0`, `--text-main-rgb: 17 24 39`, `--text-muted-rgb: 107 114 128`, `--border-subtle-rgb: 229 231 235`, `--success-rgb: 16 185 129`, `--error-rgb: 239 68 68`, `--warning-rgb: 245 158 11`.
   - **(ب) توکن‌های مقدارِ کاملِ Hex/rgba:** `--color-primary: #D8F066`, `--color-primary-hover: #C1DB3C`, `--text-on-primary: #000000`, **`--bg-image: url('/bg-light.jpg')`**, `--bg-app-glass: rgba(244,245,247,0.6)`, `--bg-panel-glass: rgba(255,255,255,0.7)`, `--bg-card: rgba(255,255,255,0.85)`, `--text-main: #111827`, `--text-muted: #6B7280`, `--border-subtle: #E5E7EB`, `--border-neon: transparent`, `--input-focus-ring: #111827`, `--nav-active-bg: var(--color-primary)`, `--nav-active-text: var(--text-on-primary)`, `--nav-hover-bg: rgba(255,255,255,0.6)`, `--ink-bg: #16161A`, `--ink-text: #FFFFFF`, `--semantic-error: #EF4444`, `--semantic-error-soft: rgba(239,68,68,0.1)`, `--semantic-success: #10B981`, `--shadow-glass: 0 30px 60px -15px rgba(0,0,0,0.15)`, `--shadow-card: 0 10px 25px rgba(0,0,0,0.05)`, `--shadow-btn: none`, **`--autofill-bg: #FFFFFF`**, **`--autofill-text: #111827`**, `--radius-sm: 12px`, `--radius-md: 16px`, `--radius-lg: 24px`, `--radius-pill: 9999px`.
2. یک بلوک `.dark` بساز و overrideها را بگذار: کانالی‌ها (`--text-main-rgb: 249 250 251`, `--text-muted-rgb: 156 163 175`, `--border-subtle-rgb: 51 65 85`, `--success-rgb: 34 197 94`, `--error-rgb: 255 107 107`, `--warning-rgb: 251 191 36`) و مقدار-کامل‌ها (**`--bg-image: url('/bg-dark.jpg')`**, `--bg-app-glass: rgba(18,18,20,0.6)`, `--bg-panel-glass: rgba(30,41,59,0.4)`, `--bg-card: rgba(30,41,59,0.55)`, `--text-main: #F9FAFB`, `--text-muted: #9CA3AF`, `--border-subtle: #334155`, `--border-neon: #D8F066`, `--input-focus-ring: #D8F066`, `--nav-active-bg: rgba(216,240,102,0.08)`, `--nav-active-text: var(--color-primary)`, `--nav-hover-bg: rgba(255,255,255,0.05)`, `--ink-bg: rgba(216,240,102,0.08)`, `--ink-text: var(--color-primary)`, `--semantic-error: #FF6B6B`, `--semantic-error-soft: rgba(255,107,107,0.1)`, `--semantic-success: #22C55E`, `--shadow-glass: none`, `--shadow-card: none`, `--shadow-btn: none`, **`--autofill-bg: #09090b`**, **`--autofill-text: #FFFFFF`**).
3. کلاس‌های سمانتیک (طبق ARCHITECTURE §۲.۴) را اضافه کن: `.glass-app`, `.glass-panel`, `.glass-card`, `.tile-ink`, `.tile-lime`, `.nav-active`, `.bg-lime`, `.text-lime`. 
4. **پس‌زمینه‌ی عکسِ پروتوتایپ:** کلاس‌های `.bg-nature` (با `background-image: var(--bg-image)`), `.bg-nature::after` و مدیاکوئریِ `@media(max-width:1023px)` برای overlay را دقیقاً طبق پروتوتایپ اضافه کن.
5. قانون `* { -webkit-tap-highlight-color: transparent; }` را به ابتدای فایل اضافه کن.
6. **کلاس‌های آیکن تم:** `.theme-icon-dark` (`display:none`), `.theme-icon-light` (`display:inline-flex`) و overrideهای `.dark`شان (معکوس).
7. هک autofill توکن‌محور (`input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px var(--autofill-bg) inset !important; ... }`) را اعمال کن.

**محدودیت‌های اختصاصی تسک:**
- **نباید:** متغیرهای `safe-area-inset` را حذف کنی.
- **باید:** `--text-on-primary` در هر دو مود حتماً `#000000` باشد.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["index.css"]
```

---

### تسک L2-2: اضافه کردن اسکریپت تشخیص تم و `tailwind.config` به `index.html`

**عنوان:** پیکربندی `darkMode:'class'`، رنگ‌های کانالی و اسکریپت pre-paint

**راهنمای پیاده‌سازی فنی:**
1. **پیکربندی Tailwind (حیاتی — رفع باگ شفافیت):** بلافاصله **بعد از** `<script src="https://cdn.tailwindcss.com"></script>` یک بلوک اضافه کن:
```html
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: { extend: { colors: {
      primary:        'rgb(var(--color-primary-rgb) / <alpha-value>)',
      'primary-hover':'rgb(var(--color-primary-hover-rgb) / <alpha-value>)',
      'on-primary':   'rgb(var(--on-primary-rgb) / <alpha-value>)',
      main:           'rgb(var(--text-main-rgb) / <alpha-value>)',
      muted:          'rgb(var(--text-muted-rgb) / <alpha-value>)',
      subtle:         'rgb(var(--border-subtle-rgb) / <alpha-value>)',
      success:        'rgb(var(--success-rgb) / <alpha-value>)',
      error:          'rgb(var(--error-rgb) / <alpha-value>)',
      warning:        'rgb(var(--warning-rgb) / <alpha-value>)',
    } } }
  };
</script>
```
2. **اسکریپت pre-paint:** بعد از `<link rel="stylesheet" href="/index.css">` و قبل از `<script type="importmap">`، این را اضافه کن:
```html
<script>
  (function () {
    var t = localStorage.getItem('hexer-theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```
3. `<meta name="theme-color">` را از `#09090b` به `#F4F5F7` تغییر بده (لایت‌مود).
4. در `<style>` موجود، `background-color: transparent;` را به `body` اضافه کن.

**محدودیت‌های اختصاصی تسک:**
- **نباید:** meta tag viewport یا importmap را تغییر بدهی.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["index.html"]
```

---

### تسک L2-3: هوکِ لِی‌اوتِ ریسپانسیو و سایدبارِ گلوبال (`useMediaQuery` + `Sidebar.tsx`)

**عنوان:** ساخت هوکِ `useMediaQuery` و کامپوننت سایدبار با ناوبری Prop-محور

**راهنمای پیاده‌سازی فنی:**
1. **ساخت هوک (جدید):** فایل `hooks/useMediaQuery.ts` بساز:
```ts
import { useState, useEffect } from 'react';
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}
```
2. **ساخت سایدبار:** فایل `components/Sidebar.tsx` خالی را بازنویسی کن. 
   - **ناوبری:** `currentPage` و `setPage` و `onOpenProfile` را از props بگیرد (مثل BottomNav، از App تغذیه می‌شود).
   - **استیت کاربر:** `user` از `useAuth()`، `profile` از `useData()`. آواتار = حرف اول `profile?.full_name || user?.user_metadata?.full_name`.
   - **استایل پروتوتایپ:** `<aside className={`w-[240px] flex flex-col h-full shrink-0 overflow-hidden ${className}`}>`. لوگو در ردیف بالا. `nav` در وسط با لینک‌های ناوبری. آیتم فعال `<button className="nav-active ...">` (بررسی `currentPage === Page.X`، کلیک `setPage(Page.X)`). آیتم غیرفعال با `hover:bg-[var(--nav-hover-bg)] text-muted`.
   - **پروفایل و تم:** پایین سایدبار داخل `glass-card`. یک دکمه برای پروفایل (صدازدن `onOpenProfile`). یک دکمه برای تم با `onClick={toggleTheme}`.
3. **هندلر تم:** فقط این خطوط:
```js
const toggleTheme = () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('hexer-theme', isDark ? 'dark' : 'light');
};
```
   - داخل دکمه، دو SVG (آیکن‌های خورشید/ماه) با کلاس‌های `theme-icon-light` و `theme-icon-dark` بگذار.

**محدودیت‌های اختصاصی تسک:**
- **⛔️ هشدار:** هرگز کلاسِ `hidden`ی Tailwind را روی `<svg>` آیکن‌های تم نگذار! فقط همان کلاس‌های `theme-icon-*`؛ مدیریتِ پنهان‌کردن در CSS است.
- **نباید:** `currentPage` را از `useData()` بگیری. (فقط از props).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["components/Sidebar.tsx", "types.ts", "contexts/AuthContext.tsx", "contexts/DataContext.tsx", "components/icons.tsx"]
```

---

### تسک L2-4: بازطراحی `App.tsx` — شِلِ بانددارِ دسکتاپ و انتقالِ سایدبار

**عنوان:** بازنویسی App.tsx برای پیاده‌سازی شِل گلسِ بانددار، پس‌زمینه‌ی عکس، و انتقال سایدبار/پروفایل

**راهنمای پیاده‌سازی فنی:**
1. در `App.tsx` فعلی، `MainApp` را بازنویسی کن تا از `useMediaQuery('(min-width: 1024px)')` استفاده کند.
2. **استیتِ پروفایل:** `const [isProfileOpen, setIsProfileOpen] = useState(false);` را به `MainApp` اضافه کن. لیسنر رویداد موبایل را اضافه کن:
```js
useEffect(() => {
  const open = () => setIsProfileOpen(true);
  window.addEventListener('hexer:open-profile', open);
  return () => window.removeEventListener('hexer:open-profile', open);
}, []);
```
3. **لِی‌اوتِ ریشه (`return`ِ MainApp):**
```jsx
return (
  <div className="relative flex h-[100dvh] text-main" id="main-app-container">
    {/* تنها پس‌زمینه در کلِ اپ: عکس/گرادیان */}
    <div className="bg-nature" />

    {isDesktop ? (
      /* شِلِ گلسِ بانددارِ دسکتاپ (دقیقاً مثل پروتوتایپ) */
      <div className="hidden lg:flex fixed inset-0 z-10 items-center justify-center px-6 xl:px-10 overflow-hidden">
        <main className="glass-app w-full max-w-[1280px] h-[92vh] max-h-[860px] rounded-[32px] p-4 flex gap-4 overflow-hidden">
          <Sidebar currentPage={currentPage} setPage={setCurrentPage} onOpenProfile={() => setIsProfileOpen(true)} className="shrink-0" />
          <div className="flex-1 min-w-0 h-full overflow-y-auto soft-scroll pb-6" id="view-viewport">
            <NetworkBanner />
            {renderContent()}
          </div>
        </main>
      </div>
    ) : (
      /* لِی‌اوتِ موبایل (اسکرولیِ سیال) */
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <NetworkBanner />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-bottom-nav" id="view-viewport">
          {renderContent()}
        </main>
        <BottomNav currentPage={currentPage} setPage={setCurrentPage} />
      </div>
    )}

    <ToastNotifications notifications={notifications} onRemove={removeNotification} />

    {/* مودال‌های گلوبال */}
    <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} signOut={signOut} subscription={subscription} profile={profile} onTriggerUpgrade={handleTriggerUpgrade} />
    {/* ... بقیه‌ی مودال‌ها دست‌نخورده (TaskEditorModal, NoteEditorModal, PaywallModal, AnnouncementManager, ...) */}
  </div>
);
```
4. `LoadingSpinner`ها: `border-sky-500` → `border-primary`. (کانتینر ریشه‌ی `<App>`: حذف `bg-gray-950`).
5. پاکسازی props مرده: در متد `renderContent`، به کامپوننت `<Dashboard>` تمامِ props پاس داده شده را حذف کن (این کامپوننت پروپ‌لِس است و همه‌چیز را از `useData()` می‌گیرد).

**محدودیت‌های اختصاصی تسک:**
- **نباید:** استیتِ داده‌ای (session, tasks, ...) یا هوک‌های بک‌اند را تغییر دهی.
- **باید:** `ProfileModal` از Dashboard به App منتقل شود.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["App.tsx", "components/Sidebar.tsx", "components/BottomNav.tsx", "components/ProfileModal.tsx", "hooks/useMediaQuery.ts"]
```

---

### تسک L2-5: هندآفِ پنلِ AI (`composerBridge.ts` و `ChatView.tsx`)

**عنوان:** ماژول سبک برای انتقال متنِ تایپ‌شده از داشبورد به چت

**راهنمای پیاده‌سازی فنی:**
1. فایل جدید `features/chat/composerBridge.ts` بساز:
```ts
export type DraftMessage = { text: string };
let pendingDraft: DraftMessage | null = null;
export const setPendingDraft = (draft: DraftMessage) => { pendingDraft = draft; };
export const consumePendingDraft = (): DraftMessage | null => { const d = pendingDraft; pendingDraft = null; return d; };
```
2. در `ChatView.tsx`، تابع `loadActiveSession` را پیدا کن. در انتهای موفقیت‌آمیزِ آن (بعد از fetch کردنِ session و پیام‌ها و `setMessages(...)`)، این کد را اضافه کن تا اگر کاربر از داشبورد متنی نوشته بود، خودکار ارسال شود:
```ts
// After setting messages/session:
const draft = consumePendingDraft();
if (draft?.text) {
  // Use setTimeout to ensure state is settled before triggering send
  setTimeout(() => handleSendMessage(draft.text), 100);
}
```
*(مطمئن شو `consumePendingDraft` ایمپورت شده باشد.)*

**محدودیت‌های اختصاصی تسک:**
- **نباید:** هیچ‌چیز دیگری در `ChatView.tsx` (منطق Gemini، MediaRecorder و...) را دست بزنی. این تنها ویرایش مجاز است.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/chat/ChatView.tsx"]
```

---

### تسک L2-6: ساخت پنلِ AI در داشبورد (`AiComposerPanel.tsx`)

**عنوان:** کامپوننت Inputِ مرکزیِ داشبورد با هندآف به صفحه چت

**راهنمای پیاده‌سازی فنی:**
1. فایل جدید `features/dashboard/components/AiComposerPanel.tsx` بساز.
2. از `useData()` برای گرفتن `setCurrentPage` و از `Page` enum استفاده کن. یک استیت محلی `[input, setInput]` بساز.
3. در `onSubmit` (کلیک روی دکمه ارسال یا فشردن Enter):
   - اگر `input` خالی نیست، `setPendingDraft({ text: input })` (از `composerBridge.ts` ایمپورت شود).
   - سپس `setCurrentPage(Page.Chat)`.
4. کلیک روی آیکن‌های میکروفون/ضمیمه: فقط `setCurrentPage(Page.Chat)`.
5. **استایل پروتوتایپ:**
   - کانتینر بیرونی: `glass-panel p-5 h-[145px] rounded-[var(--radius-lg)] flex flex-col justify-between shrink-0`.
   - عنوان (بالا): آیکن `BotIcon` مشکی + تیتر «دستیار هوش مصنوعی» (`font-black text-[22px]`).
   - باکس input (پایین): `relative flex items-center bg-[var(--bg-card)] border border-subtle rounded-pill p-1 shadow-card focus-within:border-[var(--input-focus-ring)] transition-all`.
   - پس‌زمینه‌ی Glow (پشت input): `absolute inset-0 bg-primary opacity-0 dark:group-hover:opacity-10 blur-xl rounded-full transition duration-500`.
   - دکمه‌ها: میکروفون/گیره گیره کاغذی (`text-muted hover:text-main`). دکمه ارسال (`px-5 py-2.5 bg-lime rounded-full text-xs font-bold text-on-primary shadow-btn hover:scale-105 active:scale-95`).

**محدودیت‌های اختصاصی تسک:**
- **نباید:** هیچ فراخوانی API به بک‌اند/Gemini انجام دهی — پنل کاملاً کلاینتی و Presentational است.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["components/icons.tsx", "contexts/DataContext.tsx", "types.ts"]
```

---

### تسک L2-7: بازطراحی `Dashboard.tsx` — چیدمان ۲ستونه + موبایلِ سیال

**عنوان:** بازنویسی Dashboard به لِی‌اوتِ ۲ستونه‌ی پروتوتایپ

**راهنمای پیاده‌سازی فنی:**
1. `Dashboard.tsx` را برای استفاده از `useMediaQuery` (`isDesktop`) بازنویسی کن. 
   - سایدبار، ProfileModal و bg-nature اینجا نیستند (حذف شدند، رفتند به App.tsx).
   - هدر موبایل (`DashboardHeader`): کماکان با رویداد CustomEvent `onOpenProfile={() => window.dispatchEvent(new CustomEvent('hexer:open-profile'))}`.
2. **لِی‌اوتِ دسکتاپ (`isDesktop`):**
   ```jsx
   <div className="flex gap-4 h-full">
     {/* ستون ۲: مرکز فرمان (انعطاف‌پذیر، دارای اسکرول داخلی) */}
     <section className="flex-1 flex flex-col gap-4 min-w-0 h-full">
       <AiComposerPanel />
       <ProductivityChart />
       {/* TodaysPlan تنها کامپوننتی است که کشسان و دارای اسکرول داخلی است */}
       <div className="flex-1 min-h-0"><TodaysPlan /></div>
     </section>
     {/* ستون ۳: بافتار داده (اسکرول داخلی کل ستون برای ایمنیِ زوم) */}
     <aside className="w-[320px] shrink-0 flex flex-col gap-4 h-full overflow-y-auto soft-scroll pb-2 pr-1">
       <StatsOverview onOpenWeeklyReport={() => setIsReportOpen(true)} />
       <WeekCalendar selectedDate={selectedDate} onDateChange={setSelectedDate} />
       <KeyProjects />
       <FocusTimer />
     </aside>
   </div>
   ```
3. **لِی‌اوتِ موبایل (`!isDesktop`):** یک ستونِ پیوسته (`flex flex-col gap-4 p-4`).
   - ترتیب: `DashboardHeader` → `WeekCalendar` → `AiComposerPanel` → `StatsOverview` → `TodaysPlan` → `ProductivityChart` → `KeyProjects` → `FocusTimer`.
4. مودال `WeeklyReportModal` همچنان در Dashboard بماند.
5. واردکردن‌های `TodaysNotes` و `HabitTracker` **حذف شوند** (از طرح نهاییِ پروتوتایپ حذف شده‌اند — فایل‌هایشان Delete نمی‌شود، فقط رندر نمی‌شوند).

**محدودیت‌های اختصاصی تسک:**
- **حیاتی:** هیچ کامپوننتی دو بار رندر نشود (کدنویس باید از شرطِ سه‌گانه‌ی تمیز برای دسکتاپ/موبایل استفاده کند که خوانا باشد؛ اگرچه هوک `useMediaQuery` mount/unmount می‌کند، اما از نظر معماری ایمن است چون ویجت‌ها state محلی ندارند و داده‌ها از `useData` کَش‌شده می‌آید).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/Dashboard.tsx", "features/dashboard/components/DashboardHeader.tsx", "hooks/useMediaQuery.ts"]
```

---

### تسک L2-8: ساخت `ProductivityChart.tsx` (کاشیِ تیره)

**عنوان:** چارتِ SVG با داده‌ی واقعی روی پس‌زمینه‌ی کاشیِ تیره

**راهنمای پیاده‌سازی فنی:**
1. فایل `features/dashboard/components/ProductivityChart.tsx` را بازنویسی کن.
2. از `tasks` در `useData()` یک `useMemo` بساز که ۷ عدد (درصدِ کارهای انجام‌شده از کلِ کارهای موعددار) برای ۷ روزِ هفته‌ی جاری تولید کند. `utils/dateUtils.ts` (توابع `isSameTehranDay` و غیره) را استفاده کن. **هیچ داده‌ی استاتیکی (`[60,80]`) نگذار.**
3. **استایل (کاشیِ تیره):** `<div className="tile-ink rounded-[var(--radius-lg)] p-5 relative overflow-hidden flex gap-4 h-[200px] shrink-0">`.
4. ستونِ چپ (مشخصات): `w-[38%] bg-white/5 border border-white/10 rounded-[20px] p-3 ...`. آیکن‌های فلش (بجای lucide-react، از SVGهای inline یا `icons.tsx` استفاده کن — **لوکال**). Badge درصد با `bg-lime text-black`.
5. ستونِ راست (چارت): `<svg>` دستی با ۷ تا `rect` و یک `path` منحنی، دقیقاً مطابق پروتوتایپ.
   > ⛔️ **اخطار لایت‌مود:** چون کانتینر `tile-ink` است، پس‌زمینه در هر دو مود تیره است (`#16161A` / گلس تیره). پس متن‌های داخلش حتماً `text-white/90` یا `text-white/50` باشند (کلاس‌های Tailwind برای رنگ ثابتِ روشن).

**محدودیت‌های اختصاصی تسک:**
- **نباید:** پکیجِ چارت نصب کنی (فقط SVG).
- **نباید:** از `lucide-react` استفاده کنی (ریسکِ نصب و کرش — فقط `icons.tsx`).
- **نباید:** داده‌ی استاتیک ساختگی نمایش بدهی (پروداکتِ پرمیوم است).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/ProductivityChart.tsx", "contexts/DataContext.tsx", "utils/dateUtils.ts", "components/icons.tsx"]
```

---

### تسک L2-9: ساخت `FocusTimer.tsx` (پومودورو با منطق کلاینتی)

**عنوان:** تایمر تمرکز با `setInterval` محلی و استایلِ کاشیِ تیره

**راهنمای پیاده‌سازی فنی:**
1. فایل `features/dashboard/components/FocusTimer.tsx` را بازنویسی کن.
2. استیت محلی: `timeLeft` (پیش‌فرض ۲۵*۶۰)، `isRunning`، `selectedTask` (از نام‌های `tasks`ِ `useData` استفاده کن). **مد‌های اضافه مثل ZenMode را حذف کن (در پروتوتایپ نیست).**
3. اثر جانبی:
```ts
useEffect(() => {
  if (!isRunning) return;
  const id = setInterval(() => setTimeLeft(t => t > 0 ? t - 1 : 0), 1000);
  return () => clearInterval(id); // ⛔️ حیاتی (جلوگیری از نشت/Double-run در StrictMode)
}, [isRunning]);
```
4. استایل (کاشیِ تیره در هر دو مود): `<div className="bg-[#16161a] border border-white/10 text-white rounded-[var(--radius-lg)] p-4 relative overflow-hidden h-[160px] shrink-0 flex flex-col justify-between transition-all shadow-lg dark:border-neon dark:shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.15)] mt-auto">`.
5. هاله‌های پس‌زمینه: `bg-gradient-to-tr from-[#16161a] via-black/20 to-white/5 opacity-40` و `bg-white/5 blur-3xl`.
6. دکمه‌های Play/Reset/ورود: `bg-lime text-black` و `bg-white/5 text-white/70`. Dropdown انتخاب تسک با React state (بدون دستکاری کلاسِ DOM).

**محدودیت‌های اختصاصی تسک:**
- **نباید:** از `lucide-react` استفاده کنی. آیکن‌های Clock/Play/Pause/Rotate/Chevron را از پروتوتایپ (SVG inline) استخراج یا از `icons.tsx` استفاده کن.
- **نباید:** به بک‌اند/سرور وصل شوی — تایمر فقط در مرورگرِ همین لحظه کار می‌کند (بدون persist).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/FocusTimer.tsx", "contexts/DataContext.tsx", "types.ts", "components/icons.tsx"]
```

---

### تسک L2-10: بازطراحی `StatsOverview.tsx` (Dual-Brief Box)

**عنوان:** پیاده‌سازی ویجت «امروز در یک نگاه» (تایل‌های رنگی و رینگ)

**راهنمای پیاده‌سازی فنی:**
1. در `StatsOverview.tsx`، ساختار کانتینر قبلی را کاملاً دور بریز و با یک `<div className="flex gap-3 shrink-0 h-[145px]">` جایگزین کن (بدون `WidgetContainer`).
2. **باکس چپ (وضعیت هفته - رینگ):**
   - استایل: `w-[110px] shrink-0 rounded-[var(--radius-lg)] p-3 flex flex-col items-center justify-between relative transition-all bg-[#111113]/85 backdrop-blur-xl border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.25)] dark:bg-card dark:border-subtle dark:shadow-none`.
   - متن: `text-[11px] font-bold text-white/70 dark:text-muted text-center`.
   - رینگ: با استفاده از مقدار `progress`ِ محاسبه‌شده، `stroke-dashoffset` را بده. رنگ stroke پیشرفت: `var(--color-primary)`.
   - دکمه‌ی مشاهده (باز کردن مودال): `bg-primary text-black dark:bg-[var(--ink-bg)] dark:text-[var(--ink-text)] dark:border dark:border-neon`.
3. **باکس راست (کارهای امروز - کاشیِ لایم):**
   - استایل: `tile-lime flex-1 rounded-[var(--radius-lg)] p-3 relative flex flex-col justify-between shadow-sm`.
   - عنوان: `text-[13px] text-black font-black`.
   - ردیف‌ها (`bg-[#16161A] text-white`): 
     - **توجه به سمنتیک:** ردیف‌ها باید مقادیرِ درست از `useData()` نشان دهند (تعداد کارهای امروز، کارهای مهمِ امروز، کارهای عقب‌افتاده).
     - بارهای dashed: طول ثابتِ تزئینی بگذار (مثل پروتوتایپ)، یا با درصدِ معنادار (مثل کارهای انجام‌شده از کل).
   - راهنما (Legend) پایین: تیک‌های `border-black` و `bg-black`.

**محدودیت‌های اختصاصی تسک:**
- **حیاتی (کنتراست لایت‌مود):** در باکسِ راست که `tile-lime` است، متون **حتماً** `text-black` یا `text-white` باشند. اگر `--text-main` بدهی، در لایت‌مود تیره می‌ماند ولی در دارک‌مود سفید می‌شود که روی زمینه‌ی لیمویی خوانا نیست.
- **باید:** باکسِ چپ در لایت‌مود واقعاً تیره (`#111113`) بماند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/StatsOverview.tsx", "contexts/DataContext.tsx", "utils/dateUtils.ts"]
```

---

### تسک L2-11: بازطراحی بقیه‌ی داشبورد (Header, Plan, Calendar, Projects)

**عنوان:** اعمال دقیق استایل‌های پروتوتایپ روی سایر ویجت‌های داشبورد

**راهنمای پیاده‌سازی فنی (ویرایش کلاس‌ها):**
1. **`DashboardHeader.tsx` (فقط موبایل):**
   - کانتینر: `pt-8 pb-4 px-5 sticky top-0 z-20 backdrop-blur-xl border-b border-subtle bg-[var(--bg-app-glass)]`.
   - سلام کاربر: `text-[12px] font-bold text-muted`. داشبورد: `font-black text-[22px] text-main`.
   - دکمه پروفایل: `w-10 h-10 rounded-full bg-main text-[var(--bg-app-glass)]`.
   - دکمه toggle تم: `theme-toggle w-10 h-10 rounded-full glass-card` + دو SVG (خورشید/ماه) با کلاس‌های `.theme-icon-light` و `.theme-icon-dark` (بدون `hidden`!). `onClick={() => document.documentElement.classList.toggle('dark');}`.
   - رینگ پیشرفت دور آواتار را **حذف کن** (در پروتوتایپ موبایلِ نهایی نیست).
2. **`TodaysPlan.tsx`:**
   - کانتینر: `glass-panel rounded-[var(--radius-lg)] p-5 h-full flex flex-col`. کانتینر درونیِ کشسان: `flex-1 min-h-0 overflow-y-auto soft-scroll`.
   - داخلش، تایم‌لاین عمودی با محور (`w-[1.5px] bg-subtle`) و دایره‌ها (`bg-primary text-black border-2 border-subtle` یا `bg-success text-white`).
   - کارت تسک: `glass-card p-3 rounded-[var(--radius-md)] flex items-center gap-3`. دکمه تیک: `task-check`.
3. **`WeekCalendar.tsx`:**
   - کانتینر دسکتاپ: `glass-panel px-3.5 py-3 rounded-[var(--radius-lg)] shrink-0 h-[200px]`.
   - روز فعال: `bg-primary border-transparent shadow-[0_4px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(216,240,102,0.15)] scale-105`.
   - روز غیرفعال: `bg-[var(--bg-card)] border border-subtle hover:bg-black/5 dark:hover:bg-white/5`.
4. **`KeyProjects.tsx`:**
   - کانتینر: `tile-lime p-4 rounded-[var(--radius-lg)] h-[120px] shrink-0`.
   - متن‌ها: `text-black`. نوار پیشرفت: `bg-black/10` و داخلش `bg-black` (دارک) یا `bg-white` (با سایه).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/DashboardHeader.tsx", "features/dashboard/components/TodaysPlan.tsx", "features/dashboard/components/WeekCalendar.tsx", "features/dashboard/components/KeyProjects.tsx"]
```

---

### تسک L2-12: پاکسازی کدهای مرده‌ی App.tsx و Dashboard.tsx

**عنوان:** حذف props بلااستفاده و رفع باگ enum

**راهنمای پیاده‌سازی فنی:**
1. در `App.tsx`، کلاسی به نام `MainApp` یا متد `renderContent()` وجود دارد که به `<Dashboard>` چندین prop پاس می‌دهد (مثل `tasks={tasks} notes={notes} ...`). **تمام این props را از تگ `<Dashboard />` پاک کن.** `Dashboard` پروپ‌لِس است و همه‌چیز را خودش مستقیماً از `useData()` می‌خواند.
2. در `types.ts`، عضوی به نام `Page.PageContainer` وجود ندارد. اما در `App.tsx` (در `switch(currentPage)`) شاخه‌ی `case Page.PageContainer:` نوشته شده است. این خط را حذف کن (باگ کدِ مرده).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["App.tsx", "features/dashboard/Dashboard.tsx", "types.ts"]
```

---

### تسک L2-13: بازطراحی `ChatView.tsx` و زیرکامپوننت‌ها (استایل + رفع باگ‌های شفافیت)

**عنوان:** اعمال توکن‌های Cyber-Lime روی چت و کارت‌هایش، بدون مودیفایر شفافیتِ نامعتبر

> ⚠️ **مسیر زنده:** فایل‌های زنده در `features/chat/` هستند (طبق CONTEXT_FILES). فایل‌های `components/ChatView.tsx` مرده‌اند و نباید ویرایش شوند.

**راهنمای پیاده‌سازی فنی:**
1. در `features/chat/ChatView.tsx`:
   - پس‌زمینه: `bg-gray-950` → `text-main` (پس‌زمینه را از طریق App می‌گیرد).
   - هدر چت: `bg-gray-950/80 backdrop-blur-xl border-white/10` → `backdrop-blur-xl border-subtle` + `style={{ background: 'var(--bg-app-glass)' }}`.
   - پیام کاربر: `bg-sky-600 text-white` → `bg-lime text-[var(--text-on-primary)]`.
   - پیام AI: `bg-gray-800/50` → `glass-card`.
   - کامپوزر چت: `bg-gray-800/70 border-white/10` → `glass-card border-subtle`.
   - دکمه ارسال: `bg-sky-600 text-white hover:bg-sky-500 shadow-sky-900/20` → `bg-lime text-[var(--text-on-primary)] hover:bg-[var(--color-primary-hover)] shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)]`.
   - empty-state: `text-gray-500` → `text-muted`.
2. در `ModeChip.tsx`:
   - فعال: `bg-sky-500 text-white shadow-sky-500/25 ring-sky-400/50` → `bg-primary text-[var(--text-on-primary)] shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)] ring-primary/50`.
   - غیرفعال: `bg-neutral-900 border-neutral-800 ...` → `glass-card border-subtle text-muted hover:bg-[var(--nav-hover-bg)] hover:text-main`.
3. در `ChatHistoryDrawer.tsx` و `CitationCard.tsx` و `ProposalCard.tsx` و `ActionResultCard.tsx`:
   - کانتینرها: `bg-gray-900/60 border-white/10` → `glass-card border-subtle`.
   - متن‌های تیره و روشن: به `text-main` و `text-muted` تبدیل شوند.
   - **آیکن‌های رنگی پس‌زمینه (حیاتی):** هرجا `bg-X-500/10 text-X-400` دیدی (مثل سبز، آبی، بنفش)، از کلاس‌های سمانتیک استفاده کن: `bg-success/10 text-success`، `bg-primary/10 text-primary`، `bg-error/10 text-error`. **هرگز `bg-[var(--color-primary)]/10` ننویس.**
4. **پلِ هندآف (از L2-5):** در `ChatView.tsx`، انتهای موفقیت‌آمیزِ تابع `loadActiveSession`:
   ```ts
   const draft = consumePendingDraft();
   if (draft?.text) {
     setTimeout(() => handleSendMessage(draft.text), 100);
   }
   ```
   (مطمئن شو `consumePendingDraft` ایمپورت شده باشد).

**محدودیت‌های اختصاصی تسک:**
- **نباید:** هیچ منطق (state, useEffect, useRef, handlers, sanitizeHistoryMessage) را در ChatView یا هوک‌ها تغییر دهی.
- **باید:** فقط کلاس‌های رنگی و استایلیِ Tailwind را ری‌پلیس کنی.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/chat/ChatView.tsx", "features/chat/components/ModeChip.tsx", "features/chat/components/ChatHistoryDrawer.tsx", "features/chat/components/CitationCard.tsx", "features/chat/components/ProposalCard.tsx", "features/chat/components/ActionResultCard.tsx"]
```

---

### تسک L2-14: بازطراحی بقیه‌ی مودال‌ها و صفحات

**عنوان:** اعمال توکن‌های گلس و Cyber-Lime روی سایر بخش‌های اپ

**راهنمای پیاده‌سازی فنی (فقط تغییر کلاس):**
1. **`TasksView`, `TaskCard`**:
   - `bg-sky-500/10 border-sky-500/20 text-sky-400` → `bg-primary/10 border-primary/20 text-primary`.
   - `bg-sky-500 border-sky-500` → `bg-primary border-primary`.
   - `bg-zinc-900/60 border-white/5` → `glass-card border-subtle`.
   - متون `text-zinc-200`, `text-zinc-500` → `text-main`, `text-muted`.
2. **`NotesView`, `NoteCard`**:
   - `from-purple-600 to-fuchsia-600` → حذف گرادیان، تبدیل به `bg-primary`.
   - `from-purple-500/20 to-fuchsia-600/20` → `bg-primary/10`.
   - بقیه توکن‌های تیره به `glass-card` و `text-main`.
3. **`ProjectsView`, `ProjectCard`**:
   - `from-white via-indigo-200 to-sky-300` → رنگ ثابت برند یا حذف.
   - `bg-zinc-900/60 border-white/5` → `glass-card border-subtle`.
   - `colorClasses`/`priorityClasses` را با متغیرهای توکن (`bg-error/10`, `bg-warning/10`) یا مقادیر سالمِ CSS آپدیت کن.
4. **مودال‌های سراسری (`WeeklyReportModal`, `ProfileModal`, `PaywallModal`, `TaskEditorModal`, ...):**
   - پس‌زمینه‌ی مودال‌ها (`bg-zinc-950/90 border-white/10`) → `bg-[var(--bg-card)] border-subtle`. (رنگِ بدنه نباید سیاه مطلق باشد).
   - `bg-black/60 backdrop-blur-md` (overlay) حفظ شود.
   - دکمه‌ها و Badgeها: کلاس‌های هاردکد (`bg-sky-600`) → `bg-lime text-[var(--text-on-primary)]` یا `bg-primary/10 text-primary`.
   - در `WeeklyReportModal`، رنگ stroke دایره (دونوت چارت) از `stroke-sky-400` به `stroke-[var(--color-primary)]` تغییر یابد.
5. **Auth / Onboarding / Subscription:**
   - پس‌زمینه‌های `bg-gray-950` حذف شوند (پایه در App.tsx تنظیم شده).
   - دکمه‌های اصلی به `bg-lime` و `text-black`.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/tasks/TasksView.tsx", "features/tasks/components/TaskCard.tsx", "features/notes/NotesView.tsx", "features/notes/components/NoteCard.tsx", "features/projects/ProjectsView.tsx", "features/projects/components/ProjectCard.tsx", "features/dashboard/components/WeeklyReportModal.tsx", "components/ProfileModal.tsx", "components/PaywallModal.tsx"]
```

---

## ترتیب اجرای توصیه‌شده

1. **L2-1** (توکن‌های CSS: کانالی `*-rgb` + مقدار-کامل) + **L2-2** (`tailwind.config`: `darkMode:'class'` + مَپِ رنگ‌های کانالی + اسکریپت pre-paint) — پایه‌ی همه‌چیز. **این دو اول و حتماً با هم.**
2. **L2-3** (useMediaQuery + Sidebar).
3. **L2-5** (پلِ هندآفِ composerBridge).
4. **L2-6** (پنل AiComposerPanel).
5. **L2-8** (ProductivityChart — کاشیِ تیره) + **L2-9** (FocusTimer — کاشیِ تیره).
6. **L2-10** (StatsOverview) + **L2-11** (بقیه داشبورد: Header, Plan, Calendar, KeyProjects).
7. **L2-12** (پاکسازیِ props مرده از App.tsx).
8. **L2-4** (Dashboard.tsx + App.tsx orchestration) — شِل گلس بانددارِ دسکتاپ و انتقال ProfileModal. **این تسک هم‌زمان لِی‌اوت ریشه و داشبورد را متصل می‌کند.**
9. **L2-13** (ChatView و زیرکامپوننت‌ها).
10. **L2-14** (بقیه‌ی صفحات و مودال‌ها).

---

## معیار پذیرش نهایی

1. **وفاداریِ مطلق به پروتوتایپ در دسکتاپ:** کلِ اپ روی دسکتاپ در یک پنجره‌ی گلس‌مورفیکِ بانددار (`max-w-[1280px] h-[92vh] max-h-[860px]`) وسط‌چین است و هرگز اسکرول سراسری نمی‌خورد (فقط ستون‌ها اسکرول داخلی دارند).
2. **وفاداریِ مطلق به پروتوتایپ در موبایل:** لِی‌اوتِ سیال و اسکرولی یک‌ستونه. 
3. **Double-Mount صفر:** از `useMediaQuery` برای رندرِ انحصاریِ `<DashboardDesktop>` یا `<DashboardMobile>` (یا ساختارِ JSXِ شرطی) استفاده شده تا تایمر/چارت دو بار Mount نشوند.
4. **کنتراست لایت‌مود سالم باشد:** عکسِ پس‌زمینه (self-hosted) موجود است. کاشی‌های ProductivityChart و FocusTimer و وضعیت‌هفته (`StatsOverview`) تیره هستند (`tile-ink` / `#16161A`) و متونِ داخلشان همیشه روشن است. کارت‌های دیگر گلسِ روشن هستند با سایه‌ی قابلِ تشخیص.
5. **تله‌ی ناوبری وجود نداشته باشد:** سایدبارِ دسکتاپ یک اِلمانِ Global در `App.tsx` است (بیرونِ `renderContent()`) و هرگز با تعویض صفحه Unmount نمی‌شود.
6. **شفافیت درست کار کند:** هیچ `bg-[var(--color-primary)]/NN` در کد نباشد؛ Badgeها/پس‌زمینه‌های شفاف با کلاس‌های کانالی (`bg-primary/10` و...) تعریف شده باشند (`tailwind.config`).
7. **تم light/dark با کلاسِ `.dark` روی `<html>` کار کند** و `dark:`های Tailwind نیز با آن همگام باشند (`darkMode:'class'`). دکمه‌ی toggle بشکند ممنوع؛ روی آیکن‌های تم هیچ کلاس `hidden`ی نباشد.
8. **هندآفِ پنل AI درست کار کند:** پنلِ وسطِ داشبورد متن را می‌گیرد، به چت ناوین می‌شود، و چت خودکار آن را با همان مکانیزمِ اعتبارسنجیِ قبلی‌اش ارسال می‌کند (بدون تکرار منطق).
9. **هیچ منطق/سرویس/دیتابیس/هوکِ داده‌ای تغییر نکرده باشد** (جز افزودنِ `isProfileOpen` و لیسنرهای `useMediaQuery` / رویدادها).
10. **ProductivityChart داده‌ی واقعیِ کلاینتی داشته باشد** و **FocusTimer شمارش معکوس با cleanupِ تمیزِ استیتِ محلی** (بدونِ نشت حافظه).
11. `npm run build` بدون خطا عبور کند.
12. هیچ کدی از `dashboard_redisign/index.html` کپی نشده باشد.

---

# فاز L3 — نقشهٔ راهِ پرداختِ بصری و ریسپانسیو (Visual & Responsive Polish)

> **مرجع کامل:** `docs/PROJECT.md` فاز L3 و `docs/ARCHITECTURE.md` §L3.
> **دامنه:** فقط لایهٔ view. هیچ سرویس/هوک/RPC/دیتابیس تغییر نمی‌کند. هیچ فایلی ساخته یا Delete نمی‌شود.
> **مدلِ کدنویس:** مهارتِ بالا، درکِ کودکانه؛ پس هر تسک با کلاس‌های دقیقِ Tailmind، قدم‌به‌قدم و با معیارِ پذیرشِ میکرو تعریف شده تا توهم/بداجرا رخ ندهد.
> **قانونِ ممنوعیتِ کپی:** هیچ کدی از `dashboard_redisign/index.html` کپی نشود؛ فقط به‌عنوان مرجعِ بصری خوانده شود.

> ### ⚠️ هشدارهای حیاتی (قبل از هر تسک بخوان)
> ۱. **لایم فقط پس‌زمینه:** هرگز `--color-primary` را رنگِ متن روی سطحِ روشن نکن (§L3-1). ۲. **بدونِ `hidden` روی آیکن‌های تم** (نبایدِ L2-24). ۳. **بدونِ کتابخانهٔ جدید** (نه d3، نه framer اضافه). ۴. **`min-h` به‌جای ارتفاعِ ثابتِ قیچی‌کننده** در موبایل. ۵. اتریبیوت‌های SVG در JSX **camelCase**. ۶. به فایل‌های مرده (`TodaysNotes`,`HabitTracker`,`QuickCapture`) دست نزن.

---

### تسک L3-1: رفعِ باکس «کارهای امروز در یک نگاه» (`StatsOverview.tsx`)

**عنوان:** مقیّدسازیِ کپسول‌های نقطه‌چین + متنِ تک‌خطی + رفعِ سرریز/فروپاشی.

**راهنمای پیاده‌سازی فنی:**
1. در `StatsOverview.tsx`، در ردیف ۱ و ۲ (باکسِ راستِ `tile-lime`)، کپسولِ متن (`bg-[#16161A] text-white ... flex-1`) کلاسِ `whitespace-nowrap min-w-0 overflow-hidden` بگیرد تا «تعداد: X/Y» و «مهم: X/Y» هرگز دوخطی نشوند.
2. کپسولِ نقطه‌چینِ کناری را از عرضِ خام رها کن و با `clamp` مقیّد کن. یک هلپرِ خالص بساز، مثلاً `const dashW = (p:number) => Math.min(50, Math.max(30, Math.round(p)))` و در استایل: `style={{ width: `${dashW(inProgressPercent)}%` }}` و برای ردیف ۲ همان با `nonHighPriorityProjectsPercent`. (کف ۳۰٪، سقف ۵۰٪ → متن همیشه ≥۵۰٪.)
3. بوردرِ نقطه‌چین را نرم کن: `border-[1.5px] border-dashed border-black/40` (به‌جای `border-black`). هر دو کپسولِ نقطه‌چین `shrink-0` و `h-[24px]` بمانند.
4. **حالتِ پیش‌فرضِ بدونِ داده:** چون کف ۳۰٪ است، وقتی داده صفر است کپسول ۳۰٪ پر می‌ماند (خواستهٔ کاربر) و متن تک‌خطی می‌ماند.
5. اتریبیوتِ SVGِ دکمهٔ «چشم» در ردیف ۳ را از `stroke-width="2.5"` به `strokeWidth="2.5"` اصلاح کن (رفعِ هشدارِ React — یافتهٔ L3-X1).
6. **سمنتیک (یافتهٔ L3-X3):** اگر رینگِ باکسِ چپ بر `selectedDate` است اما شمارشِ ردیف‌ها بر `new Date()`، این تناقض را با تراز کردنِ شمارش‌ها بر `selectedDate` رفع کن (یا اگر عمدی است، کامنتِ توضیحی بگذار). پیش‌فرضِ معمار: تراز بر `selectedDate`.

**محدودیت‌های اختصاصی تسک:**
- **باید:** متنِ باکسِ لایم `text-black`/`text-white` بماند (نه `--text-main`؛ نبایدِ کنتراستِ L2-10). باکسِ چپ در لایت واقعاً تیره (`#111113`) بماند.
- **نباید:** عرضِ درصدیِ نامقیّد؛ بوردرِ سختِ `border-black`؛ تغییرِ منطقِ `useMemo`های محاسباتی جز ترازِ تاریخِ بند ۶.

**معیار پذیرش میکرو:**
- در ۰، ۵۰، ۱۰۰ درصد و حالتِ بدونِ تسک، هیچ کپسولی سرریز/فروپاشی نمی‌کند و «تعداد/مهم» همیشه یک‌خطی است.
- هیچ هشدارِ React دربارهٔ `stroke-width` در کنسول نیست.
- در لایت و دارک، متنِ باکسِ لایم و باکسِ تیره خوانا است.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/StatsOverview.tsx", "contexts/DataContext.tsx", "utils/dateUtils.ts", "dashboard_redisign/index.html"]
```

---

### تسک L3-2: رفعِ سرریزِ نامِ روزها در تقویم (`WeekCalendar.tsx`)

**عنوان:** نگاشتِ نامِ کوتاهِ روز + بزرگ‌ترکردنِ کپسول + کاهشِ گپ.

**راهنمای پیاده‌سازی فنی:**
1. یک نگاشتِ کوتاه اضافه کن (مطابق پروتوتایپ): `شنبه→شنبه، یکشنبه→یک، دوشنبه→دو، سه‌شنبه→سه، چهارشنبه→چهار، پنجشنبه→پنج، جمعه→جمعه`. تابعِ `getCustomDayName` را نگه‌دار ولی خروجی‌اش را از این نگاشت عبور بده (نامِ کوتاه در کپسولِ هفتهٔ جاری نمایش داده شود).
2. گپِ گریدِ هفتهٔ جاری از `gap-1 sm:gap-2` به `gap-1 sm:gap-1.5` تغییر کند.
3. اسپنِ نامِ روز: `truncate w-full text-center text-[8px] sm:text-[9px]` و کپسول کمی بزرگ‌تر: به‌جای `style={{height:'4.5rem'}}` از کلاسِ `h-[64px] sm:h-[70px]` استفاده کن (حذفِ استایلِ اینلاین).
4. عددِ روز و نقطهٔ «امروز» بدون تغییرِ منطق باقی بماند؛ فقط اطمینان از `leading-none`.

**محدودیت‌های اختصاصی تسک:**
- **باید:** نامِ کوتاه فقط برای کپسولِ هفتهٔ جاری؛ بخشِ «روزهای آینده» (که از قبل `.slice(0,3)` دارد) دست‌نخورده.
- **نباید:** تغییرِ منطقِ `weekDays`/`nextWeekDays`/`onDateChange`؛ استفاده از نامِ کامل در کپسول.

**معیار پذیرش میکرو:**
- در عرضِ ۳۶۰px موبایل، هیچ نامِ روزی از کپسول بیرون نمی‌زند و کلیپ نمی‌شود.
- ۷ کپسول با گپِ کوچک‌تر جا می‌شوند؛ روزِ انتخاب‌شده `bg-primary text-black` و خوانا است.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/WeekCalendar.tsx", "utils/dateUtils.ts", "dashboard_redisign/index.html"]
```

---

### تسک L3-3: منحنیِ صاف + ریسپانسیوِ داخلیِ نمودار بهره‌وری (`ProductivityChart.tsx`)

**عنوان:** جایگزینیِ خطِ شکسته با منحنیِ Catmull-Rom + استکِ موبایل / ستونِ دسکتاپ.

**راهنمای پیاده‌سازی فنی:**
1. **منحنی:** `pathD`ِ فعلی (که با `L` ساخته می‌شود) را با یک تابعِ خالصِ هموارساز جایگزین کن که از `points` مسیرِ `C` (بزیهٔ مکعبی) تولید می‌کند (الگوریتمِ Catmull-Rom→Cubic؛ فرمول در `ARCHITECTURE.md` §L3.۳). داخلِ همان `useMemo` بماند. `strokeLinejoin="round"` و `strokeLinecap="round"` حفظ شوند.
2. **ریسپانسیوِ داخلی:** کانتینرِ ریشه از `flex gap-4` به `flex flex-col lg:flex-row gap-3 lg:gap-4` تغییر کند. ستونِ اطلاعاتِ هفته/ماه: در موبایل یک **ردیفِ افقیِ بالا** (`w-full flex-row justify-between`)، در دسکتاپ ستونِ کناری (`lg:w-[38%] lg:flex-col`). ارتفاعِ ثابتِ دسکتاپ در موبایل با `min-h-[200px]` (نه `h-` قیچی‌کننده).
3. لیبل‌های روز (اختیاری، یافتهٔ L3-X4): در صورتِ امکان از `weekData` مشتق شوند تا با ترتیبِ داده هماهنگ بمانند؛ در غیر این صورت ثابت بماند.
4. `preserveAspectRatio="none"` مطابقِ پروتوتایپ بماند؛ فقط اگر کشیدگیِ strokeWidth زشت بود، در همین تسک یادداشت شود (تغییرش خارج از دامنه است مگر لازم).

**محدودیت‌های اختصاصی تسک:**
- **باید:** منحنی داده‌محور بماند (از `points`)، نه مختصاتِ ثابتِ پروتوتایپ. کاشی `tile-ink` (همیشه تیره) و متونِ سفید حفظ شوند.
- **نباید:** افزودنِ d3/کتابخانه؛ کپیِ `M 0 80 Q 25 80 ...`ِ پروتوتایپ؛ تغییرِ `useMemo`های محاسبهٔ نرخ.

**معیار پذیرش میکرو:**
- خطِ روند در همهٔ حالت‌ها گرد و بدونِ گوشهٔ تیز است.
- در عرضِ موبایل، کپسولِ هفته/ماه بالای نمودار می‌نشیند و نمودار زیرِ آن کشیده نمی‌شود/له نمی‌شود؛ در `lg:` چیدمانِ ستونیِ کناری بازمی‌گردد.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/ProductivityChart.tsx", "contexts/DataContext.tsx", "utils/dateUtils.ts", "dashboard_redisign/index.html"]
```

---

### تسک L3-4: بازگرداندنِ هویتِ هدرِ قدیمی — فقط موبایل، توکنیزه (`DashboardHeader.tsx`)

**عنوان:** بازسازیِ رینگِ نئونیِ دورِ آواتار + «سلام {نام}» + وردمارکِ HEXER، با توکن و با حفظِ toggle تم.

**راهنمای پیاده‌سازی فنی:**
1. مرجعِ بصری: `DashboardHeader(old).tsx` (فقط خواندنی). هویتِ آن را در `DashboardHeader.tsx` بازبساز: (الف) دکمهٔ آواتار با یک SVGِ رینگِ پیشرفت دورِ آن بر اساسِ `todayProgress` (`strokeDasharray`/`strokeDashoffset`)، (ب) «سلام {firstName}» + زیرنویسِ درصد، (ج) وردمارکِ «HEXER» در سمتِ چپ (RTL end).
2. **توکنیزه‌سازیِ اجباری (خوانا در هر دو تم):** کانتینر `bg-[var(--bg-app-glass)] backdrop-blur-xl border-b border-subtle`. متن‌ها با `--text-main`/`--text-muted`. رینگ: track با `--border-subtle`، پیشرفت با `var(--color-primary)` (یا نئون فقط در `dark:`). وردمارکِ HEXER: `text-[var(--text-main)] font-black tracking-tight` — **گرادیانِ بنفش/آبیِ `bg-clip-text` ممنوع** (نبایدِ سیستم طراحی).
3. **حفظِ toggle تم (حیاتی):** دکمهٔ toggle تمِ هدرِ فعلی را عیناً نگه‌دار (کلاسِ `theme-toggle glass-card` + دو SVGِ `.theme-icon-light`/`.theme-icon-dark` **بدونِ `hidden`** + `onClick` که `document.documentElement.classList.toggle('dark')` و `localStorage` را ست می‌کند).
4. **نامِ نمایشی:** از `profile.full_name → firstName` استفاده کن (نه `user.email[0]`). اگر نام خالی بود، «رفیق».
5. چون `DashboardHeader` فقط در شاخهٔ موبایلِ `Dashboard.tsx` رندر می‌شود، هیچ گاردِ `lg:hidden` لازم نیست؛ اما اگر افزوده شد، دسکتاپ را نشکن.

**محدودیت‌های اختصاصی تسک:**
- **باید:** toggle تم حفظ شود؛ خوانایی در لایت‌مود کامل باشد؛ اینترفیسِ props (`onOpenProfile`, `todayProgress`, `hasTasksToday`) بدون تغییر بماند.
- **نباید:** رنگِ هارد‌کدِ `bg-gray-950`/`text-white`/`text-gray-400`؛ گرادیانِ بنفش؛ حذفِ toggle؛ رندرِ این هدر در دسکتاپ.

**معیار پذیرش میکرو:**
- در موبایلِ لایت‌مود همهٔ متن‌ها و رینگ خوانا؛ در دارک‌مود جلوهٔ نئونی حس می‌شود.
- دکمهٔ toggle تم کار می‌کند و آیکن خورشید/ماه درست جابه‌جا می‌شود (CSS-محور، نه `hidden`).
- دسکتاپ بدون تغییر (هدر رندر نمی‌شود).

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/DashboardHeader.tsx", "features/dashboard/components/DashboardHeader(old).tsx", "features/dashboard/Dashboard.tsx", "contexts/AuthContext.tsx", "contexts/DataContext.tsx", "components/icons"]
```

---

### تسک L3-5: رفعِ کنتراستِ لایت‌مودِ مودال + ممیزیِ کامپوننت‌ها با سیستم طراحی (`WeeklyReportModal.tsx`)

**عنوان:** حذفِ رنگِ لایمِ پیش‌زمینه‌ای؛ توکنیزه‌سازیِ متن/بَج/بوردر مطابق سیستم طراحی.

**راهنمای پیاده‌سازی فنی:**
1. در `WeeklyReportModal.tsx` هر `text-[var(--color-primary)]` که **رنگِ متن** است حذف شود:
   - `healthRating.color` برای «خوب»/«نیاز به بهبود»: به توکنِ سمنتیک تغییر کن (مثلاً «خوب»→`text-[var(--semantic-success)]`، «نیاز به بهبود»→`text-[var(--semantic-warning)]`)؛ «بحرانی»→`--semantic-error`؛ «عالی»→`--semantic-success`.
   - عددِ «با تاخیر»: از `text-[var(--color-primary)]` به `text-[var(--text-main)]` (یا `--semantic-warning`).
   - بَج‌های «به‌موقع»/«در جریان»: `bg-primary/10 text-[var(--color-primary)] border border-[var(--border-neon)]` → `bg-primary/10 text-[var(--text-main)] border border-[var(--border-subtle)]` (بوردرِ دائمیِ قابل‌دیدن در لایت).
2. سایرِ توکن‌ها (`--bg-card`, `--text-main`, `--text-muted`, `--shadow-card`, `--semantic-error-soft`) که درست‌اند حفظ شوند.
3. **یافتهٔ L3-X2 (اختیاری، اولویت متوسط):** برای فعال‌شدنِ انیمیشنِ exit، گیتِ `if (!isOpen) return null;` را از بالای return بردار و به‌جای آن رندرِ شرطیِ محتوای داخلِ `<AnimatePresence>` را با `isOpen &&` انجام بده (یا گیت در والد). اگر ریسکِ رفتاری داشت، فقط در رجیستر بماند و لمس نشود.
4. **ممیزیِ سیستم طراحی (خواستهٔ کاربر «همهٔ کامپوننت‌ها»):** قانونِ §L3-الف را روی همهٔ کامپوننت‌های *فعالِ* رندرشونده اعمال کن؛ اگر جای دیگری `--color-primary` رنگِ متن روی سطحِ روشن بود، مطابق همین الگو اصلاح کن. **به فایل‌های مرده دست نزن** (L3-8).

**محدودیت‌های اختصاصی تسک:**
- **باید:** رنگِ لایم فقط پس‌زمینه با متنِ `--text-on-primary`؛ هر تغییری در هر دو تم چک شود.
- **نباید:** تغییرِ منطقِ محاسبهٔ `healthScore`/`weekBoundaries`/تب‌ها؛ دست‌زدنِ `HabitTracker`/`TodaysNotes`/`QuickCapture`.

**معیار پذیرش میکرو:**
- در لایت‌مود، همهٔ لیبل‌ها/اعداد/بَج‌های مودالِ گزارش هفتگی خوانا و بوردردار‌اند (هیچ متنِ لیمویی روی سفید).
- در دارک‌مود ظاهر حفظ شده.
- هیچ `text-[var(--color-primary)]`ِ متنی در کامپوننت‌های فعال باقی نمانده.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/WeeklyReportModal.tsx", "index.css", "dashboard_redisign/DesignSystem.md"]
```

---

### تسک L3-6: پرداختِ لِی‌اوتِ موبایلِ داشبورد (`Dashboard.tsx`)

**عنوان:** هم‌ترازیِ فاصله‌گذاری و اطمینان از ریسپانسیوِ ستونِ موبایل با پروتوتایپ.

**راهنمای پیاده‌سازی فنی:**
1. در شاخهٔ موبایلِ `Dashboard.tsx` (`#mobile-dashboard`)، فاصله‌گذاری را با پروتوتایپ هم‌تراز کن: از `flex flex-col gap-4 p-4` به `flex flex-col gap-6 px-5 pt-5` (مطابق موبایلِ پروتوتایپ). فاصله از BottomNav (§۷.۵) حفظ شود.
2. اطمینان از این‌که پس از تسک‌های L3-1..L3-3 هر ویجت در ستونِ موبایل بدونِ سرریزِ افقی رندر می‌شود (هیچ عرضِ ثابتِ بزرگ‌تر از عرضِ صفحه). اگر ویجتی هنوز عرضِ ثابت دارد، در همان ویجت (نه اینجا) اصلاح شود — این تسک فقط کانتینرِ داشبورد است.
3. ترتیبِ ویجت‌های موبایل مطابقِ فعلی/پروتوتایپ حفظ شود؛ `DashboardHeader` بالای همه.

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط کلاس‌های کانتینرِ موبایل تغییر کند؛ شاخهٔ دسکتاپ دست‌نخورده.
- **نباید:** افزودن/حذفِ ویجت؛ تغییرِ منطقِ `useMediaQuery`/`selectedDayProgressStats`.

**معیار پذیرش میکرو:**
- در موبایل هیچ اسکرولِ افقی وجود ندارد؛ فاصله‌ها یکنواخت و منطبق با پروتوتایپ است.
- دسکتاپ کاملاً بدون تغییر.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/Dashboard.tsx", "dashboard_redisign/index.html"]
```

---

### تسک L3-7: ممیزیِ نهایی و رجیسترِ فایل‌های مرده (بدون کد — Verification Gate)

**عنوان:** بازبینیِ کیفیت + مستندسازیِ فایل‌های مرده (هیچ ویرایشِ کدی).

**راهنمای پیاده‌سازی فنی:**
1. فهرستِ فایل‌های مرده را تأیید کن: `TodaysNotes.tsx`, `HabitTracker.tsx`, `QuickCapture.tsx` (رنگ‌های هارد‌کدِ تیره؛ در لایت‌مود نامرئی؛ اما از رندرِ داشبورد حذف‌اند طبقِ نبایدِ #۲۲). این‌ها **ویرایش نشوند**؛ فقط اگر روزی به رندر بازگردند، اول باید توکنیزه شوند.
2. یک بازبینیِ چشمیِ کامل روی هر دو تم و روی موبایل/دسکتاپ برای همهٔ ویجت‌های فعال انجام بده و انطباق با معیارهای L3-1..L3-6 را تأیید کن.

**محدودیت‌های اختصاصی تسک:**
- **نباید:** هیچ تغییرِ کدی در فایل‌های مرده؛ هیچ فایلِ جدید؛ هیچ Delete.

**معیار پذیرش میکرو:**
- گزارشِ کوتاهِ انطباق برای هر ۶ تسکِ قبل ارائه شود؛ فایل‌های مرده بدون تغییر و مستند بمانند.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/TodaysNotes.tsx", "features/dashboard/components/HabitTracker.tsx", "features/dashboard/components/QuickCapture.tsx"]
```

---

## ترتیب اجرای توصیه‌شدهٔ فاز L3 (رعایتِ تداخلِ Read/Write)

> هیچ دو تسکی که روی یک فایل می‌نویسند نباید هم‌زمان اجرا شوند. تسک‌های L3 روی فایل‌های *مجزا* عمل می‌کنند، پس می‌توانند مستقل پیش بروند؛ ترتیبِ زیر برای انسجامِ بازبینی توصیه می‌شود:
1. **L3-1** (`StatsOverview.tsx`)
2. **L3-2** (`WeekCalendar.tsx`)
3. **L3-3** (`ProductivityChart.tsx`)
4. **L3-4** (`DashboardHeader.tsx`)
5. **L3-5** (`WeeklyReportModal.tsx` + ممیزیِ کنتراست)
6. **L3-6** (`Dashboard.tsx` — پس از L3-1..L3-3 تا سرریزِ افقی سنجیده شود)
7. **L3-7** (بازبینیِ نهایی — بدون کد)

## معیار پذیرش نهاییِ فاز L3
۱. هر ۶ محورِ گزارش‌شدهٔ کاربر رفع شده و در موبایل/دسکتاپ و لایت/دارک بی‌نقص است.
۲. هیچ متن/بوردری در لایت‌مود نامرئی نیست؛ `--color-primary` هیچ‌جا رنگِ متنِ روی سطحِ روشن نیست.
۳. کپسول‌های «امروز در یک نگاه» هرگز سرریز/فروپاشی/دوخطی نمی‌شوند.
۴. نامِ روزهای تقویم داخلِ کپسول جا می‌شود.
۵. منحنیِ نمودار گرد است و نمودار در موبایل استکِ عمودیِ درست دارد.
۶. هدرِ موبایل هویتِ قدیمی را دارد، توکنیزه و خوانا در هر دو تم، و toggle تم کار می‌کند؛ دسکتاپ بدون تغییر.
۷. `npm run build` بدون خطا و بدونِ هشدارِ جدیدِ React عبور می‌کند.
۸. هیچ منطق/سرویس/هوک/دیتابیس تغییر نکرده؛ هیچ فایلی ساخته یا Delete نشده؛ هیچ کدی از `index.html` کپی نشده.

---
---
---

# فاز L4 — نقشهٔ راهِ رفعِ نواقصِ عملکردی/تعاملی

> مرجع: `docs/ARCHITECTURE.md §L4` و `docs/PROJECT.md` فاز L4. دامنه: فقط فایل‌های ذکرشده. هیچ فایلِ جدید/حذف؛ هیچ .sql. آخرین نسخه با code_execution+read_file (بدون کش) خوانده شود.
> گروه‌بندیِ اجرا: **گروه ۱ = L4-1 (تنها)** · **گروه ۲ = L4-2 + L4-3** · **گروه ۳ = L4-4 + L4-5**.

### تسک L4-1 (F1): کارکردِ کاملِ باکس هوش مصنوعی
**عنوان:** ارسالِ واقعیِ متن/عکس/ویس از پنلِ داشبورد با هندآفِ بدونِ گم‌شدن به چت.
**راهنمای پیاده‌سازی فنی:**
1. `composerBridge.ts`: `DraftMessage = { text: string; imageFile?: Blob | null; audioFile?: Blob | null }` (توابع بدونِ تغییرِ منطقی).
2. `ChatView.tsx` (فقط دو نقطه): امضای `handleSendMessage(textOverride?, mediaOverride?: { imageFile?; audioFile? })`؛ تعریفِ `audioToSend`/`imageT بقیهٔ منطق دست‌نخورده. در `loadActiveSession` مصرفِ draft، مدیا را هم به `handleSendMessage` پاس بده.
3. `AiComposerPanel.tsx`: اینپوتِ فایلِ عکس واقعی (ری‌یوزِ همان compressImage/dataURLtoBlobِ ChatView)، `useMediaRecorder` برای ویس، پیش‌نمایشِ ضمیمه، لودینگِ کوتاه (isSubmitting)، بسته‌بندی به bridge + پاک‌سازیِ state + `setCurrentPage(Page.Chat)`. ریسپانسیوِ موبایل: placeholderِ کوتاه «تعریف کن؛ چه خبر از امروز؟» با `useMediaQuery`، دکمهٔ ارسالِ داخلِ نوار (shrink-0/min-w-0؛ در موبایل آیکونی)، رنگ‌ها توکنی.
**محدودیت‌های اختصاصی تسک:** فقط ۳ فایل؛ منطقِ ارسال تکرار نشود؛ util/هوکِ موجود بازساخته نشود؛ منطقِ تک‌ضمیمه‌ای؛ به session/proposal/citation/renderِ ChatView دست نزن؛ بدونِ کتابخانهٔ جدید؛ SVG camelCase.
**معیار پذیرش میکرو:** ارسالِ متن، عکس، و ویس هر سه از پنل کار کند و در چت ادامه یابد؛ پیام/فایل گم نشود؛ در سهمیهٔ تمام‌شده پی‌وال بیاید و پیامِ کاربر باقی بماند؛ در موبایل دکمهٔ ارسال بیرون نزند و placeholder کوتاه باشد.
**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/AiComposerPanel.tsx", "features/chat/composerBridge.ts", "features/chat/ChatView.tsx", "services/geminiService.ts", "services/mediaService.ts", "features/chat/hooks/useMediaRecorder.ts", "hooks/useMediaQuery.ts"]
تسک L4-2 (F2): TodaysPlan — ساعت/مرتب‌سازی/سقفِ ۴ ردیف/خطِ یکسره
عنوان: اصلاحِ نمایشِ زمان، ترتیب، ارتفاعِ ثابتِ اسکرول‌دار و خطِ تایم‌لاینِ پیوسته. راهنمای پیاده‌سازی فنی:

formatTime: ساعت/دقیقهٔ تهران را با Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',hour:'numeric',minute:'numeric',hour12:false}) محاسبه کن؛ اگر ۱۲:۰۰ (یا ۰۰:۰۰) بود «خالی» (''/—) برگردان.
مرتب‌سازی: زمان‌دارها اول به‌ترتیبِ ساعتِ صعودی، سپس بی‌زمان‌ها (۱۲:۰۰) به‌ترتیبِ اولویت High→Medium→Low، و doneها ته لیست.
لیستِ داخلی: ارتفاعِ ثابتِ ≈ ۴ ردیف (مثلاً max-h-[...] متناسب) + overflow-y-auto soft-scroll — در موبایل و دسکتاپ یکسان.
خطِ تایم‌لاین: به‌جای خطِ per-item، یک خطِ عمودیِ واحدِ پیوسته پشتِ همهٔ دایره‌ها رسم شود. محدودیت‌های اختصاصی تسک: فقط TodaysPlan.tsx؛ منطقِ داده/toggleTaskCompletion تغییر نکند؛ قراردادِ ۱۲:۰۰ همان‌طور که در TaskEditorModal هست رعایت شود (تغییرش نده). معیار پذیرش میکرو: تسکِ بی‌ساعت خالی نشان دهد؛ ترتیبِ زمان→اولویت→done درست باشد؛ بیش از ۴ تسک اسکرول شود و باکس ثابت بماند؛ خط یکسره باشد. آرایه کانتکست ماشین‌خوان:
JSON

CONTEXT_FILES: ["features/dashboard/components/TodaysPlan.tsx", "utils/dateUtils.ts", "types.ts", "features/tasks/components/TaskEditorModal.tsx"]
تسک L4-3 (F3): StatsOverview — نمودارِ پرشونده (گزینهٔ B)
عنوان: بازتابِ پیشرفتِ واقعی؛ خط‌چین با پیشرفت کوچک شود و کپسولِ متن بزرگ. راهنمای پیاده‌سازی فنی: عرضِ کپسولِ خط‌چین = درصدِ باقی‌مانده (row1: بر مبنای completedToday/totalTodayTasks؛ row2: highPriorityProjects/projects.length) با کف/سقفِ منطقی (خط‌چین همیشه دیده شود؛ کپسولِ متنِ flex-1 هیچ‌وقت زیرِ ~۴۰٪ نرود). با افزایشِ پیشرفت، خط‌چین کوچک و کپسولِ متن بزرگ شود. متن whitespace-nowrap. محدودیت‌های اختصاصی تسک: فقط StatsOverview.tsx؛ ساختارِ دو-کپسولی و رنگ‌ها (لایم فقط پس‌زمینه، متنِ کاشیِ لایم text-black) حفظ شود؛ منطقِ useMemo دست نخورد جز محاسبهٔ عرض. معیار پذیرش میکرو: در ۰٪/۵۰٪/۱۰۰٪، solid و خط‌چین متناسب تغییر کنند؛ روی ۳۰٪ ثابت نماند؛ متن تک‌خطی بماند. آرایه کانتکست ماشین‌خوان:

JSON

CONTEXT_FILES: ["features/dashboard/components/StatsOverview.tsx", "contexts/DataContext.tsx", "utils/dateUtils.ts"]
تسک L4-4 (F4): بازطراحیِ هدرِ موبایل + انتقالِ toggle تم به مودالِ پروفایل
عنوان: هدرِ دو-المانیِ زمان‌محور + سوییچِ فعالِ «تِم هکسر» در ProfileModal. راهنمای پیاده‌سازی فنی:

DashboardHeader.tsx: فقط دو المان — (چپ / RTL-start) دکمهٔ آواتار + رینگِ پیشرفت (بر مبنای todayProgress، توکنیزه، مثل L3-4)؛ (راست / RTL-end) سلامِ زمان‌محور «{بازه} بخیر {firstName}» با بازه‌های تهران: صبح ۵–۱۱، ظهر ۱۱–۱۷، عصر ۱۷–۲۰، شب ۲۰–۵. وردمارکِ «HEXER» و دکمهٔ toggle تم حذف شوند.
ProfileModal.tsx: دکمهٔ غیرفعالِ «تم دارک 🌙» (~خط ۲۹۱–۲۹۵) با یک سوییچِ کاربردیِ زیبا با برچسبِ «تِم هکسر» جایگزین شود؛ از مکانیزمِ موجود استفاده کند: document.documentElement.classList.toggle('dark') + localStorage.setItem('hexer-theme', ...) + meta[name=theme-color]. وضعیتِ اولیه از classList.contains('dark') خوانده شود. محدودیت‌های اختصاصی تسک: فقط این دو فایل؛ توگلِ سایدبارِ دسکتاپ دست نخورد؛ روی آیکن‌های تم کلاسِ hidden نباشد؛ رنگِ هارد‌کدِ بنفش/خاکستری ممنوع؛ اینترفیسِ propsِ هدر بدونِ تغییر. معیار پذیرش میکرو: هدر فقط دو المان دارد؛ سلام با ساعت درست تغییر می‌کند؛ سوییچِ تم در پروفایل واقعاً کار می‌کند (تنها راهِ تمِ موبایل)؛ لایت/دارک خوانا. آرایه کانتکست ماشین‌خوان:
JSON

CONTEXT_FILES: ["features/dashboard/components/DashboardHeader.tsx", "components/ProfileModal.tsx", "contexts/AuthContext.tsx", "contexts/DataContext.tsx", "components/Sidebar.tsx"]
تسک L4-5 (F5): رفعِ افتادنِ FocusTimer پشتِ نوار ناوبری
عنوان: تضمینِ فاصلهٔ اسکرولِ کافی در موبایل تا آخرین ویجت پشتِ BottomNav نرود. راهنمای پیاده‌سازی فنی: در FocusTimer.tsx، mt-auto را به lg:mt-auto محدود کن (فقط دسکتاپ). در Dashboard.tsx (شاخهٔ موبایل و/یا والد)، اطمینان حاصل کن اسکرولِ موبایل با نوار ناوبری تداخل ندارد (اتکا به pb-bottom-navِ main و رفعِ تداخلِ h-full؛ در صورتِ نیاز فاصلهٔ پایینِ کافی به کانتینرِ موبایل بده). محدودیت‌های اختصاصی تسک: فقط FocusTimer.tsx و Dashboard.tsx؛ شاخهٔ دسکتاپ و منطق دست نخورد؛ از توکن/کلاس‌های موجودِ safe-area/bottom-nav استفاده شود (کلاس/متغیرِ جدید نساز). معیار پذیرش میکرو: در موبایل با اسکرول تا پایین، کلِ باکسِ تایمر بالای نوار ناوبری دیده شود؛ دسکتاپ بدون تغییر. آرایه کانتکست ماشین‌خوان:

JSON

CONTEXT_FILES: ["features/dashboard/components/FocusTimer.tsx", "features/dashboard/Dashboard.tsx", "index.css", "App.tsx"]
معیار پذیرش نهاییِ فاز L4
۱. پنلِ AI متن/عکس/ویس را واقعاً می‌فرستد؛ لودینگ دارد؛ هیچ payloadی گم نمی‌شود؛ اعتبارسنجی/پی‌وال بعد از انتقال کار می‌کند. ۲. زمانِ تسک‌ها درست (۱۲:۰۰=خالی)، ترتیب و اسکرولِ ۴-ردیفه و خطِ یکسره درست است. ۳. نمودارِ StatsOverview پیشرفتِ واقعی را نشان می‌دهد. ۴. هدرِ موبایل دو-المانی و زمان‌محور است و سوییچِ تم در پروفایل کار می‌کند. ۵. FocusTimer پشتِ نوار ناوبری نمی‌افتد. ۶. npm run build بدونِ خطا. ۷. هیچ سرویس/RPC/دیتابیس/فایلِ .sql تغییر نکرده؛ هیچ فایلی ساخته/حذف نشده.


---
---
---

# فاز L4 — پرداختِ تعامل و تمرکز (Focus & Interaction Polish)

> مرجعِ کامل: `docs/PROJECT.md` §فاز L4 و `docs/ARCHITECTURE.md` §L4.
> قانونِ طلایی: هیچ کامپوننتی داخلِ بدنه‌ی render تعریف نشود؛ هیچ سرویس/RPC/جدولِ جدید؛ فقط APIهای موجود.

---

### تسک L4-1: فشرده‌سازیِ ارتفاعِ تقویم در موبایل (`WeekCalendar.tsx`)

**عنوان:** پنهان‌کردنِ ردیفِ «روزهای آینده» در موبایل و آزادسازیِ ارتفاعِ ثابت، تا ارتفاعِ کارتِ تقویم در موبایل کمتر شود. دسکتاپ بدونِ تغییر.

**راهنمای پیاده‌سازی فنی:**
1. در `WeekCalendar.tsx`، بلاکِ «روزهای آینده» (همان `<div className="border-t border-subtle/30 pt-2 mt-2">` که `nextWeekDays` را رندر می‌کند) را فقط در دسکتاپ نمایش بده: کلاسِ کانتینرِ آن بلاک را به `hidden lg:block border-t ...` تغییر بده (بریک‌پوینتِ `lg` تا با تفکیکِ دسکتاپ/موبایلِ `Dashboard.tsx` یکسان بماند).
2. ارتفاعِ ثابتِ کارت را از حالتِ همیشگی خارج کن تا در موبایل جمع شود: در کلاسِ ریشه‌ی کامپوننت، `min-h-[200px]` را به `lg:min-h-[200px]` تغییر بده (یعنی حداقل‌ارتفاع فقط در دسکتاپ اعمال شود). `flex flex-col justify-between` باقی بماند.
3. اگر لازم شد فاصله‌ی داخلیِ عمودی در موبایل کمی متعادل شود، فقط با کلاس‌های موجودِ padding/gap تنظیم کن؛ چیدمانِ گریدِ ۷ستونیِ روزها دست‌نخورده بماند.

**محدودیت‌های اختصاصی تسک:**
- **باید:** فقط کلاس‌های Tailwindِ همین کامپوننت تغییر کند؛ منطقِ `useMemo`ها (`weekDays`, `nextWeekDays`, `headerInfo`) دست‌نخورده بماند (محاسبه‌ی `nextWeekDays` می‌ماند؛ صرفاً در موبایل رندر نمی‌شود).
- **نباید:** حذفِ کاملِ کدِ `nextWeekDays`؛ تغییرِ رفتارِ دسکتاپ؛ تغییرِ props/امضای کامپوننت؛ افزودنِ `useMediaQuery` (نیازی نیست، با کلاسِ `hidden lg:block` حل می‌شود).

**معیار پذیرش میکرو:**
- در موبایل (< `lg`): بلاکِ «روزهای آینده» دیده نمی‌شود و کارتِ تقویم کوتاه‌تر از قبل است (بدونِ فضای خالیِ اضافه در پایین).
- در دسکتاپ (≥ `lg`): تقویم دقیقاً مثلِ قبل با ردیفِ روزهای آینده و `min-h-[200px]` رندر می‌شود.
- هیچ سرریزِ افقی/عمودی و هیچ warningِ جدیدِ React.

**آرایه کانتکست ماشین‌خوان:**
```json
CONTEXT_FILES: ["features/dashboard/components/WeekCalendar.tsx", "features/dashboard/Dashboard.tsx"]
تسک L4-2: رفعِ باگ‌های مودالِ ساخت/ویرایشِ تسک (TaskEditorModal.tsx + PersianDatePicker.tsx + TimePicker.tsx)
عنوان: رفعِ ریشه‌ایِ دو باگِ گزارش‌شده: (الف) بسته‌شدنِ دراپ‌داونِ تاریخ وسطِ انتخاب، (ب) پرش/گلیچِ محسوس هنگامِ تایپِ عنوان و توضیحات. علتِ هر دو، remountِ زیردرخت به‌خاطرِ تعریفِ کامپوننت داخلِ بدنه‌ی render است (به ARCHITECTURE.md §L4.2 مراجعه کن).

راهنمای پیاده‌سازی فنی:

در TaskEditorModal.tsx: تعریفِ const PropertyRow: React.FC<...> = (...) => (...) را از داخلِ کامپوننت خارج کن و در module scope (بالای فایل، بعد از importها و کنارِ priorityConfig) بگذار. امضای propsها (icon, label, children, className) و JSXِ آن دقیقاً حفظ شود؛ چون هیچ متغیرِ stateای از کلوژر استفاده نمی‌کند، انتقال بدونِ تغییرِ رفتار است.
مطمئن شو در بدنه‌ی کامپوننت دیگر تعریفِ کامپوننت (function/arrow که JSX برمی‌گرداند) باقی نمانده باشد. React.useMemo(displayedNotes) و توابعِ handler (که کامپوننت نیستند) باید همان‌جا بمانند.
در components/PersianDatePicker.tsx: const SelectWrapper: React.FC<...> = ... را به module scope منتقل کن (بیرونِ PersianDatePicker). استفاده‌ی سه‌گانه از <SelectWrapper> بدونِ تغییر بماند.
در components/TimePicker.tsx: همان کار برای SelectWrapper (انتقال به module scope).
بازبینیِ ضدِ رگرسیون (بدونِ تغییر): تأیید کن useEffect(..., [isOpen, task]) که setFormState(task) می‌کند دست‌نخورده است و formState به وابستگی‌ها اضافه نشده. همچنین autoFocus روی inputِ عنوان بماند.
محدودیت‌های اختصاصی تسک:

باید: فقط جابه‌جاییِ محلِ تعریفِ سه helper (بدونِ تغییرِ محتوای آن‌ها)؛ رفتار، ظاهر و کلاس‌ها ۱۰۰٪ یکسان بماند.
نباید: جایگزینیِ <select>های نیتیو با دراپ‌داونِ سفارشی؛ تغییرِ منطقِ handleSave/handleChange/timezone؛ تغییرِ امضای props؛ دست‌زدن به components/TaskEditorModal.tsxِ legacy؛ افزودنِ useCallback/memoِ غیرضروری.
معیار پذیرش میکرو:

بازکردنِ دراپ‌داونِ روز/ماه/سال در تاریخِ ددلاین و انتخابِ مقدار، بدونِ بسته‌شدنِ ناگهانیِ لیست انجام می‌شود.
تایپِ پیوسته در «عنوان» و «توضیحات» بدونِ پرش، بدونِ ازدست‌رفتنِ فوکوس و بدونِ لگِ محسوس (به‌ویژه روی موبایل) است.
ساختِ تسکِ جدید و ویرایشِ تسکِ موجود (شاملِ تنظیمِ تاریخ+ساعت و لینکِ یادداشت) دقیقاً مثلِ قبل کار می‌کند؛ npm run build بدونِ خطا/هشدارِ جدید.
آرایه کانتکست ماشین‌خوان:

JSON

CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "components/PersianDatePicker.tsx", "components/TimePicker.tsx", "types.ts", "utils/dateUtils.ts"]
تسک L4-3: بازطراحیِ باکس فوکوس/تایمر با انتخابِ مودالی و ذخیره‌ی خودکار (FocusTimer.tsx)
عنوان: جایگزینیِ دراپ‌داونِ انتخابِ تسک با یک مودال، و ارتقای حالتِ تمرکز (Zen) به یک تجربه‌ی «خفن» با دو باکسِ ثبتِ حواس‌پرتی و یادداشت، همراه با ذخیره‌ی خودکار هنگامِ خروج. (منطقِ داده در ARCHITECTURE.md §L4.1.)

راهنمای پیاده‌سازی فنی:

stateها و APIها: از useData() مقادیرِ tasks, addTask, addNote, addNotification را بگیر. import { linkTaskNote } from '../../../services/linkService';، import { newId } from '../../../utils/uuid';، و import type { ChecklistItem } from '../../../types';.
مدلِ انتخابِ تسک: selectedTask را از string | null به { id: string | null; title: string } | null تغییر بده. متنِ نمایشیِ دکمه = selectedTask?.title ?? 'انتخاب تسک'. در Zen mode هم selectedTask?.title نمایش داده شود.
حذفِ دراپ‌داون، افزودنِ مودالِ انتخابِ تسک: state isDropdownOpen و بلاکِ absolute bottom-full ... و dropdownRef/handleClickOutside را حذف کن (این دراپ‌داونِ absolute در sidebarِ دسکتاپ که overflow-y-auto است کلیپ می‌شود = علتِ باگِ «باز شدن ولی توی همه»). به‌جایش state isTaskPickerOpen بساز. دکمه‌ی «انتخاب تسک» فقط setIsTaskPickerOpen(true) کند.
مودالِ انتخابِ تسک: یک overlayِ fixed inset-0 z-[70] (بالاتر از Zenِ z-50) با motion.div بساز (الگوی موجودِ همین فایل). داخلش: عنوان، یک لیستِ اسکرول‌دارِ tasks.filter(t => t.status !== 'done') که هر آیتم onClick → setSelectedTask({ id: t.id, title: t.title }); setIsTaskPickerOpen(false). دو گزینه‌ی سریعِ ثابت هم در بالا: «تمرکز آزاد» و «مطالعه و یادگیری» با { id: null, title: ... }. دکمه‌ی بستن/انصراف. RTL و توکنایز‌شده با متغیرهای رنگیِ موجود.
باکس‌های حالتِ تمرکز (Zen): داخلِ overlayِ Zen، بینِ تایمرِ مرکزی و کنترل‌های پایین، دو باکس اضافه کن (چیدمانِ عمودی، عرضِ max-w-md، ظاهرِ گلاسی/نئونیِ خیلی تمیز، هماهنگ با تمِ تیره‌ی Zen):
باکسِ ۱ — «حواس‌پرتی»: state distractions: string[] و distractionInput: string. یک input + دکمه‌ی «+»؛ زدنِ «+» یا Enter، متنِ trimشده را (اگر غیرخالی) به distractions اضافه و input را خالی می‌کند. آیتم‌های افزوده‌شده به‌صورتِ لیست/چیپ زیرِ input نمایش داده شوند (با امکانِ حذفِ هر آیتم). زیرِ عنوانِ باکس یک توضیحِ کوتاه: این‌ها بعداً به ساب‌تسک تبدیل می‌شوند.
باکسِ ۲ — «یادداشت‌های این تسک»: state sessionNote: string؛ یک textarea.
زیرِ هر دو باکس این متنِ ثابت نوشته شود (بدونِ دکمه‌ی ذخیره): «هر وقت کارت اینجا تموم بشه من برات ذخیرش می‌کنم».
ذخیره‌ی خودکار هنگامِ خروج: یک تابعِ async handleExitFocus() بساز که هنگامِ زدنِ دکمه‌ی «خروج از تمرکز» (و نه دکمه‌های play/pause/reset) اجرا شود. منطق دقیقاً طبقِ ARCHITECTURE.md §L4.1:
اگر distractions.length > 0 → await addTask({ title: 'چیزایی که نیاز به بررسی دارن', priority: 'medium', tags: [], checklist: distractions.map(text => ({ id: newId(), text, isCompleted: false } as ChecklistItem)) }).
اگر sessionNote.trim() → const note = await addNote({ title: selectedTask?.title ? یادداشت تمرکز: ${selectedTask.title} : 'یادداشت جلسه‌ی تمرکز', content: sessionNote.trim(), tags: [] })؛ سپس اگر selectedTask?.id (idِ واقعی) بود → await linkTaskNote(selectedTask.id, note.id).
در try/catch؛ در موفقیت addNotification('...با موفقیت ذخیره شد', 'success') (پیامِ مناسب بسته به این‌که تسک/یادداشت ساخته شد)، در خطا addNotification('خطا در ذخیره‌ی جلسه‌ی تمرکز', 'error') + console.error.
در پایانِ موفق: setDistractions([]); setDistractionInput(''); setSessionNote(''); و setIsZenMode(false). اگر هر دو خالی بودند، صرفاً setIsZenMode(false) بدونِ ساختِ چیزی و بدونِ توست.
مهم: تایمر (isRunning/timeLeft) را می‌توانی هنگامِ خروج pause کنی (setIsRunning(false))، اما ریست‌کردنِ خودِ زمان اختیاری است؛ رفتارِ فعلیِ toggle mode را نشکن.
ورودِ دوباره: با هر بار زدنِ «ورود» به Zen، اگر جلسه‌ی قبلی ذخیره و ریست شده، باکس‌ها خالی شروع شوند (stateها بعد از خروج ریست شده‌اند؛ نیازی به کارِ اضافه نیست).
محدودیت‌های اختصاصی تسک:

باید: فقط از addTask/addNote/linkTaskNoteِ موجود استفاده شود؛ idهای چک‌لیست با newId()؛ لینک فقط وقتی selectedTask.id واقعی است؛ همه‌چیز RTL و با متغیرهای رنگیِ موجود؛ انیمیشن‌ها با motion/react.
نباید: ساختِ سرویس/RPC/جدولِ جدید؛ لینکِ معکوسِ دستی (RPC دوطرفه است)؛ افزودنِ دکمه‌ی «ذخیره»؛ ساختِ تسک/یادداشتِ خالی؛ لینک‌زدن وقتی تسکِ فعال id ندارد؛ تعریفِ کامپوننت داخلِ بدنه‌ی render؛ بلوکه‌کردنِ UI (فراخوانی‌ها async و پشتِ خروج).
نباید: تغییرِ منطقِ اصلیِ تایمرِ Pomodoro (ثانیه‌های ۲۵/۵، useEffectِ interval، formatTime).
معیار پذیرش میکرو:

زدنِ «انتخاب تسک» یک مودالِ تمام‌صفحه باز می‌کند (نه دراپ‌داونی که در sidebarِ دسکتاپ کلیپ/خراب می‌شود)؛ انتخابِ تسک، عنوانش را روی دکمه و در Zen نشان می‌دهد.
در حالتِ تمرکز، دو باکسِ «حواس‌پرتی» و «یادداشت‌های این تسک» با ظاهرِ تمیز و خفن دیده می‌شوند و متنِ «هر وقت کارت اینجا تموم بشه من برات ذخیرش می‌کنم» زیرشان هست؛ دکمه‌ی ذخیره وجود ندارد.
افزودنِ چند آیتمِ حواس‌پرتی + متنِ یادداشت، سپس «خروج از تمرکز» → یک تسکِ جدید با عنوانِ «چیزایی که نیاز به بررسی دارن» و همان ساب‌تسک‌ها ساخته می‌شود، و یک یادداشت ساخته و (اگر تسکِ فعال idدار بود) دوطرفه به آن لینک می‌شود؛ یک توستِ موفقیت نمایش داده می‌شود.
خروج با باکس‌های خالی هیچ داده‌ای نمی‌سازد. npm run build بدونِ خطا/هشدارِ جدید. در sidebarِ دسکتاپ هیچ کلیپ/سرریزی رخ نمی‌دهد.
آرایه کانتکست ماشین‌خوان:

JSON

CONTEXT_FILES: ["features/dashboard/components/FocusTimer.tsx", "contexts/DataContext.tsx", "hooks/useDataManager.ts", "services/linkService.ts", "services/taskService.ts", "services/noteService.ts", "types.ts", "utils/uuid.ts", "components/icons.tsx", "features/notes/components/NoteEditorModal.tsx"]
تسک L4-4: هم‌ترازیِ فاصله‌ی بالای هدرِ موبایل با استانداردِ اپل (DashboardHeader.tsx + index.css + Dashboard.tsx)
عنوان: جایگزینیِ مارجینِ بالای ثابتِ هدر با فاصله‌ی safe-areaآگاهِ کوچک (استانداردِ اپل): هدر نه بچسبد به بالا و نه فاصله‌ی زیاد داشته باشد، و روی دستگاه‌های ناچ/Dynamic Island درست زیرِ ناحیه‌ی امن بنشیند.

راهنمای پیاده‌سازی فنی:

در index.css، کنارِ utilityهای موجودِ safe-area، یک کلاسِ جدید اضافه کن:
CSS

.pt-app-safe { padding-top: calc(env(safe-area-inset-top, 0px) + 0.5rem) !important; }
(روی دستگاهِ بدونِ ناچ ≈ ۸px؛ روی ناچ/Dynamic Island خودش را با مقدارِ امنِ دستگاه تطبیق می‌دهد.)
در DashboardHeader.tsx، کلاسِ ریشه‌ی <header> را از pt-8 pb-4 px-5 sticky top-0 ... به pt-app-safe pb-3 px-5 sticky top-0 ... تغییر بده (یعنی pt-8 → pt-app-safe و pb-4 → pb-3). بقیه‌ی کلاس‌ها (backdrop-blur-xl border-b ... bg-[var(--bg-app-glass)] z-20) دست‌نخورده بماند.
در Dashboard.tsx، در شاخه‌ی موبایل (#mobile-dashboard)، برای این‌که فاصله‌ی بالای هدر دوباره‌کاری نشود، top-paddingِ کانتینر را حذف کن: کلاسِ flex flex-col gap-6 px-5 pt-5 pb-bottom-nav را به flex flex-col gap-6 px-5 pt-0 pb-bottom-nav تغییر بده (فقط pt-5 → pt-0؛ چون هدرِ sticky حالا خودش فاصله‌ی امنِ بالا را مدیریت می‌کند). gap-6, px-5, pb-bottom-nav بماند.
محدودیت‌های اختصاصی تسک:

باید: فاصله‌ی بالا فقط از env(safe-area-inset-top) + یک مقدارِ کوچکِ ثابت بیاید؛ شاخه‌ی دسکتاپِ Dashboard.tsx (که DashboardHeader را رندر نمی‌کند) دست‌نخورده بماند.
نباید: استفاده از مقدارِ pxِ هاردکد برای ناچ؛ inline styleِ فاصله‌گذاری؛ تغییرِ منطقِ حلقه‌ی پیشرفت (SVG ring)، greeting یا avatar؛ دست‌زدن به کلاسِ .pt-safeِ موجود (که هدرهای سایرِ صفحات مثلِ Tasks/Notes از آن استفاده می‌کنند — خارج از دامنه‌ی این تسک است تا رگرسیون رخ ندهد).
معیار پذیرش میکرو:

روی موبایلِ ناچ‌دار، متنِ greeting درست زیرِ ناحیه‌ی امن می‌نشیند (نه زیرِ ناچ، نه چسبیده به بالا) با فاصله‌ی کم و اصولی.
روی موبایلِ بدونِ ناچ، هدر فاصله‌ی کوچکِ ثابت (~۸px) از بالا دارد و نه فاصله‌ی زیادِ قبلی.
هیچ فاصله‌ی خالیِ اضافه بینِ بالای ناحیه‌ی اسکرول و نوارِ هدرِ sticky دیده نمی‌شود؛ دسکتاپ کاملاً بدونِ تغییر. npm run build سالم.
آرایه کانتکست ماشین‌خوان:

JSON

CONTEXT_FILES: ["features/dashboard/components/DashboardHeader.tsx", "index.css", "features/dashboard/Dashboard.tsx"]
ترتیب اجرای توصیه‌شده‌ی فاز L4 (رعایتِ تداخلِ Read/Write)
هیچ دو تسکی روی فایلِ مشترک نمی‌نویسند؛ پس از نظرِ فنی موازی‌پذیرند. ترتیبِ زیر صرفاً بر اساسِ ریسک/وابستگیِ منطقی توصیه می‌شود:

L4-1 (WeekCalendar.tsx) — کوچک و ایزوله.
L4-4 (DashboardHeader.tsx + index.css + Dashboard.tsx) — ایزوله.
L4-2 (TaskEditorModal.tsx + PersianDatePicker.tsx + TimePicker.tsx) — رفعِ باگِ ریشه‌ای.
L4-3 (FocusTimer.tsx) — بزرگ‌ترین و پرریسک‌ترین؛ آخر انجام شود.
نکته: L4-1 و L4-4 هر دو Dashboard.tsx را در CONTEXT_FILES دارند، اما فقط L4-4 روی Dashboard.tsx می‌نویسد (L4-1 فقط آن را برای زمینه می‌خواند). پس این دو را هم‌زمان اجرا نکن؛ L4-1 سپس L4-4 (یا برعکس، به‌صورتِ ترتیبی).

معیار پذیرش نهاییِ فاز L4
۱. هر ۴ محورِ گزارش‌شده‌ی کاربر رفع شده و در موبایل/دسکتاپ و لایت/دارک بی‌نقص است. ۲. باکس فوکوس: انتخابِ تسک مودالی است، دو باکسِ حواس‌پرتی/یادداشت کار می‌کنند، ذخیره‌ی خودکار هنگامِ خروج تسک+ساب‌تسک و یادداشتِ لینک‌شده می‌سازد، و هیچ دکمه‌ی ذخیره‌ای وجود ندارد. ۳. مودالِ تسک: دراپ‌داونِ تاریخ وسطِ انتخاب بسته نمی‌شود و تایپِ عنوان/توضیحات بدونِ پرش و لگ است. ۴. تقویمِ موبایل کوتاه‌تر است (بدونِ ردیفِ روزهای آینده) و دسکتاپ بدونِ تغییر. ۵. هدرِ موبایل استانداردِ اپل (safe-area + فاصله‌ی کم) دارد؛ دسکتاپ بدونِ تغییر. ۶. هیچ سرویس/RPC/دیتابیس/هوکی تغییر نکرده؛ هیچ فایلِ جدیدی ساخته نشده؛ به فایل‌های legacyِ components/** دست زده نشده. ۷. npm run build بدونِ خطا و بدونِ هشدارِ جدیدِ React عبور می‌کند.