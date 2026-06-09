
---

# tasks.md — نقشه‌ی راه فاز G (Hexer AI)

> فاز G = ۵ قابلیت UX/Feature. هر تسک خرد، متوالی و دارای آرایه‌ی `CONTEXT_FILES` با مسیرهای واقعیِ موجود است. تسک‌هایی که فایل مشترک (به‌ویژه `App.tsx`) را Read/Write می‌کنند **هرگز موازی نمی‌شوند**. جزئیات معماری در `ARCHITECTURE.md §۱۰`.

## خلاصه‌ی نگاشت درخواست‌ها به تسک‌ها
- تسک ۱ (نوتیفیکیشن) ⇒ G1.1 … G1.5
- تسک ۲ (آکاردئون پروژه‌ها) ⇒ G2
- تسک ۳ (مودال‌های موقت) ⇒ G3
- تسک ۴ (لینک تسک↔یادداشت) ⇒ G4.1 … G4.3
- تسک ۵ (داشبورد عادات) ⇒ G5.1 … G5.3

---

## G1 — سیستم نوتیفیکیشن هوشمند تسک‌ها

### تسک G1.1 — هندلرهای Push در Service Worker
- **راهنمای پیاده‌سازی:** در `public/sw.js` افزودن `self.addEventListener('push', e => { const d = e.data?.json(); self.registration.showNotification(d.title, { body: d.body, dir: 'rtl', tag: d.tag, data: d.data }) })` و `notificationclick` (بستنِ notification، `clients.matchAll` برای focus، در نبودِ کلاینت `clients.openWindow('/')`). بامپ `CACHE_VERSION`.
- **محدودیت‌ها:** فقط افزودن دو هندلر؛ استراتژی‌های cache/fetch موجود دست‌نخورده. هیچ pushِ واقعی اینجا ساخته نمی‌شود.
- `CONTEXT_FILES: ["public/sw.js", "public/manifest.webmanifest"]`

### تسک G1.2 — اسکیمای Push Subscriptions + RPC (SQL)
- **راهنمای پیاده‌سازی:** ساخت `supabase/sql/34_push_subscriptions.sql` طبق `ARCHITECTURE.md §۱۰.۱` (جدول `push_subscriptions` + index + RLS بر `auth.uid()=user_id` + RPC `upsert_push_subscription` با `security definer`). فایل کاملاً Idempotent و آماده‌ی اجرای دستی در پنل Supabase.
- **محدودیت‌ها:** بدون اتکا به CLI. `notify pgrst, 'reload schema'` در انتها. هیچ policy خواندنِ public.
- `CONTEXT_FILES: ["supabase/sql/05_reminders.sql", "supabase/sql/30_telegram_notifications.sql"]`

### تسک G1.3 — زمان‌بند سررسید + Edge `push-dispatch`
- **راهنمای پیاده‌سازی:** ساخت `supabase/sql/35_reminder_dispatch.sql` (تابع/ویوِ یافتن تسک‌های زمان‌دارِ سررسیده‌ی پنجره‌ی جاری + دِدوپ با `reminders.is_sent` + زمان‌بندِ `pg_cron` که هر دقیقه با `net.http_post` تابع لبه را صدا می‌زند). ساخت `supabase/functions/push-dispatch/index.ts` که با `service_role` و VAPID از `Deno.env`، Web Push به subscriptionها می‌فرستد و `is_sent` را ست می‌کند؛ تلنگر روزانه را هم پوشش دهد.
- **محدودیت‌ها:** کلید خصوصی VAPID فقط `Deno.env`. ارسال push فقط اینجا. هم‌سبکِ تریگر تلگرامِ موجود.
- **وابستگی:** پس از G1.2.
- `CONTEXT_FILES: ["supabase/sql/34_push_subscriptions.sql", "supabase/sql/30_telegram_notifications.sql", "supabase/sql/05_reminders.sql", "services/reminderService.ts"]`

### تسک G1.4 — لایه‌ی سرویس کلاینت + متن تلنگر
- **راهنمای پیاده‌سازی:** ویرایش `services/reminderService.ts`: افزودن `subscribeToPush(vapidPublicKey)` (استفاده از `serviceWorker.ready.pushManager.subscribe`)، `saveSubscription()` (صدا زدن RPC `upsert_push_subscription`)، و `showViaSW(title, body)`. ساخت `utils/notificationCopy.ts` (توابع خالص، آرایه‌ی کوچک کپی صمیمیِ نسل‌Z، چرخش بدون رباتیک‌بودن).
- **محدودیت‌ها:** کلید عمومی VAPID از `import.meta.env.VITE_*`. خطا silent نه — مدیریت با پیام فارسی. متن‌ها فقط از util.
- **وابستگی:** پس از G1.2 (RPC).
- `CONTEXT_FILES: ["services/reminderService.ts", "services/supabaseClient.ts", "utils/dateUtils.ts", "vite.config.ts"]`

### تسک G1.5 — هوک زمان‌بندِ Foreground + اتصال در App
- **راهنمای پیاده‌سازی:** ساخت `hooks/useReminderScheduler.ts` (لایه A: `setTimeout` برای تسک‌های زمان‌دارِ امروز + تلنگر روزانه با ضدِ تکرارِ `localStorage` به‌وقت Tehran؛ پاکسازی timeoutها در cleanup؛ واکنش به `visibilitychange`/`online`). اتصال هوک در `App.tsx` و درخواست permission در لحظه‌ی طبیعی؛ ثبت subscription با `reminderService` اگر مرورگر پشتیبانی می‌کند.
- **محدودیت‌ها:** هیچ نوتیفیکیشن دوتایی؛ تلنگر حداکثر ۱/روزِ Tehran؛ افت تدریجی اگر Push پشتیبانی نشد (فقط لایه A).
- **وابستگی:** پس از G1.1 و G1.4. **روی `App.tsx` با G3/G4.1/G5 سریال است.**
- `CONTEXT_FILES: ["App.tsx", "hooks/useReminderScheduler.ts", "services/reminderService.ts", "utils/notificationCopy.ts", "utils/dateUtils.ts", "contexts/DataContext.tsx", "hooks/useDataManager.ts"]`

---

## G2 — آکاردئون لیست پروژه‌ها در نمای کارها

### تسک G2 — پیاده‌سازی ساختار آکاردئونی لایه‌ی نمایش تسک‌ها در TasksView
- **راهنمای پیاده‌سازی:** بازآرایی فایل `features/tasks/TasksView.tsx` برای پیاده‌سازی آکاردئون بر روی گروه‌بندی پروژه‌ها (زمانی که `viewMode === 'project'` است). هدر هر گروه پروژه باید به یک باتن کلیک‌پذیر با ابعاد دسترسی مناسب (Tap Target ≥ 44px) تبدیل شود که شامل نام پروژه، تعداد کارهای فعال/کل، و یک آیکون متحرک `ChevronDownIcon` (با جابجایی زاویه چرخش در حالت‌های باز و بسته) باشد. استیت باز یا بسته بودن هر آکاردئون باید بر اساس ساختار داده‌ایِ `Record<string, boolean>` (کلید پروژه‌ها به مقدار Boolean) در `TasksView.tsx` مدیریت شود تا با تضمین Immutable بودن تغییرات، از باگ‌های رندری رفرنس ساید ریکت جلوگیری شود. مقدار پیش‌فرض آکاردئون‌ها در بارگذاری اولیه بسته (`false` یا غایب در دیکشنری) است، اما وضعیت توسعه‌یافتگی آکاردئون‌ها (Expanded State) به صورت زنده متناسب با ساختار فوق در `localStorage` ذخیره و بازیابی (Persist) شود. همچنین در صورت عدم وجود پروژه، گروه «بدون پروژه» در انتها رندر می‌شود.
- **محدودیت‌ها و راهکار تله‌ی UX (بسیار مهم):** به دلیل رفتارهای سنکرون Optimistic UI کلاینت، اگر پیش‌فرض تمام آکاردئون‌ها «بسته» باشد، با ثبت تسک جدید توسط کاربر، کار جدید در دیتابیس محلی ساخته می‌شود اما از منظر کاربر ناپدید خواهد ماند، چون آکاردئون پروژه مربوطه بسته است و احساس باگ به کاربر القا می‌شود. **الزاماً** باید مکانیزمی با استفاده از `useEffect` پیاده‌سازی شود که با گوش دادن مستمر به تغییرات آرایه `tasks` (اضافه شدن تسک جدید با مقایسه شناسه با رفرنس حالت قبل)، به محض ساخته شدن تسک جدید در یک پروژه، آیدیِ آن پروژه را در استیت آکاردئون به حالت `true` (باز) درآورد تا کاربر بلافاصله تسک جدیدش را ببیند و آکاردئون خودکار Expand شود. استفاده از `Set<string>` به عنوان استیت بازآرایی به علت لزوم به تغییرات ایمیوتبل مطلقاً ممنوع است.
- `CONTEXT_FILES: ["features/tasks/TasksView.tsx", "utils/taskGrouping.ts", "features/tasks/components/TaskCard.tsx", "features/tasks/components/TaskEditorModal.tsx", "components/icons.tsx", "contexts/DataContext.tsx", "types.ts"]`

---

## G3 — سیستم مودال‌های موقت (Announcements)

### تسک G3.1 — اسکلت پوشه، تایپ، config و storage
- **راهنمای پیاده‌سازی:** ساخت `features/announcements/types.ts` (`AnnouncementMeta`), `features/announcements/config.ts` (۳ بازه‌ی Asia/Tehran + `MAX_PER_DAY=3`), `features/announcements/storage.ts` (هلپرهای `localStorage` کلیدخورده با `getTehranDateString`: impression هر بازه + `dismissedIds`+version), و `features/announcements/TemporaryModals/_Example.tsx` (الگوی `export default` + `export const meta`), و `features/announcements/TemporaryModals/archive/.gitkeep`.
- **محدودیت‌ها:** مرز روز فقط با `utils/dateUtils.ts`. `localStorage` فقط برای ردگیری نمایش (مجاز). الگوی نمونه باید با `components/Modal.tsx` بسازد.
- `CONTEXT_FILES: ["components/Modal.tsx", "utils/dateUtils.ts", "components/icons.tsx"]`

### تسک G3.2 — کنترلر AnnouncementManager + اتصال در App
- **راهنمای پیاده‌سازی:** ساخت `features/announcements/AnnouncementManager.tsx` با کشف خودکار `import.meta.glob('./TemporaryModals/*.tsx', { eager: true })` (آرشیو خودکار مستثنا)؛ اعمال سیاست ۳/روز در ۳ بازه؛ انتخاب بر اساس `priority`/`version`؛ رندر مودال منتخب و ثبت impression. اتصال `<AnnouncementManager />` در `App.tsx` (هم‌تراز مودال‌های سراسری).
- **محدودیت‌ها:** بدون رجیستری دستی. مودال‌های `archive/` هرگز نمایش داده نشوند. سقف ۳/روز نشکند. **روی `App.tsx` با G1.5/G4.1/G5 سریال است.**
- **وابستگی:** پس از G3.1.
- `CONTEXT_FILES: ["App.tsx", "features/announcements/config.ts", "features/announcements/storage.ts", "features/announcements/types.ts", "components/Modal.tsx", "utils/dateUtils.ts"]`

---

## G4 — بازطراحی فلوی لینک تسک↔یادداشت

### تسک G4.1 — لایه‌ی داده: بازگشتِ موجودیت ساخته‌شده با حفظ Optimistic UI
- **راهنمای پیاده‌سازی:** ویرایش `hooks/useDataManager.ts`: منطق سنکرون Optimistic UI (یعنی استفاده از tempId و نمایش آنی در لیست) باید کاملاً حفظ شود. اما توابع `addTask` و `addNote` باید علاوه بر به‌روزرسانی محلی آنی، به‌صورت نامتقارن پس از اتمام ریکوئست سرور، آبجکت نهایی دیتابیس (با آیدی واقعی) را در قالب `Promise<Task>` و `Promise<Note>` برگردانند (return کنند). ویرایش هندلرهای save در `App.tsx` (`handleSaveModalTask`/`handleSaveModalNote`) و `features/projects/ProjectsView.tsx` تا موجودیتِ ذخیره‌شده را `return`/`await` کنند (قرارداد `onSave: => Promise<Task|Note>`) تا در فلو ایجاد همزمان، از آیدی واقعی استفاده شود.
- **محدودیت‌ها:** منطق سنکرون و آنی Optimistic UI (استفاده از `tempId` و نمایش فوری در لیست کلاینت) نباید بشکند یا آسیب ببیند. پروپاگیت مناسب مقدار برگشتی بدون هیچ رگرسیون در optimistic UI الزامی است. **هاتْ‌اسپات `App.tsx` — با G1.5/G3.2/G5 سریال.**
- `CONTEXT_FILES: ["hooks/useDataManager.ts", "App.tsx", "features/projects/ProjectsView.tsx", "services/taskService.ts", "services/noteService.ts", "types.ts"]`

### تسک G4.2 — لینک در حالت ایجاد + refactor LinkNotePicker (مودال تسک)
- **راهنمای پیاده‌سازی:** ویرایش `features/tasks/components/LinkNotePicker.tsx` به الگوی انتخاب‌گر فقط با callbackِ `onSelect` (تاکید بر عدم فراخوانی مستقیم و مستقل `linkService` در زمان ایجاد/Draft تسک جدید). ویرایش `features/tasks/components/TaskEditorModal.tsx`: state `pendingLinkIds`؛ در حالت new انتخاب‌ها در pending جمع و به‌صورت چیپ نمایش؛ هنگام Save پس از دریافت `saved.id` (آیدی واقعی سرور) لینک‌ها کامیت (`commit`) شوند؛ حالت ویرایش بدون تغییرِ منطق فعلی.
- **محدودیت‌ها:** در زمان ایجاد (Draft) تسک جدید، Picker نباید کلاینت را به صدا زدن مستقیم `linkService.linkTaskNote` وادار کند؛ ایجاد و ثبت نهایی لینک‌ها منوط و مشروط به ثبت موفقیت‌آمیز تسک در دیتابیس و دریافت شناسه واقعی آن از سرور است (commit لینک فقط پس از insert موفق تسک). استفاده از RPC `link_task_note` اتمیک. بدون رگرسیون UI ویرایش.
- **وابستگی:** پس از G4.1. (با G4.3 فایل مشترک ندارد ⇒ قابل‌موازی.)
- `CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/tasks/components/LinkNotePicker.tsx", "services/linkService.ts", "utils/dateUtils.ts", "types.ts"]`

### تسک G4.3 — لینک در ایجاد + جابه‌جایی UI + refactor LinkTaskPicker (مودال یادداشت)
- **راهنمای پیاده‌سازی:** ویرایش `features/notes/components/LinkTaskPicker.tsx` به الگوی `onSelect` (تاکید بر عدم فراخوانی مستقیم و مستقل `linkService` در زمان ایجاد/Draft یادداشت جدید). ویرایش `features/notes/components/NoteEditorModal.tsx`: (الف) `pendingLinkIds` و commit پس از دریافت `saved.id` (آیدی واقعی سرور) مشابه G4.2؛ (ب) **انتقال** بلوک «کارهای لینک‌شده + picker» از میان عنوان/بدنه به ناحیه‌ی متادیتای پایین (کنار تگ‌ها/پروژه)، هم‌ساختار با `TaskEditorModal`.
- **محدودیت‌ها:** بخش لینک نباید در ناحیه‌ی نوشتنِ متن باشد (ناحیه‌ی نوشتن = فقط عنوان + بدنه). در زمان ایجاد (Draft) یادداشت جدید، Picker نباید کلاینت را به صدا زدن مستقیم `linkService.linkTaskNote` وادار کند؛ ایجاد و ثبت نهایی لینک‌ها منوط و مشروط به ثبت موفقیت‌آمیز یادداشت در دیتابیس و دریافت شناسه واقعی آن از سرور است (commit لینک فقط پس از insert موفق یادداشت).
- **وابستگی:** پس از G4.1. (با G4.2 قابل‌موازی.)
- `CONTEXT_FILES: ["features/notes/components/NoteEditorModal.tsx", "features/notes/components/LinkTaskPicker.tsx", "features/tasks/components/TaskEditorModal.tsx", "services/linkService.ts", "utils/dateUtils.ts", "types.ts"]`

---

## G5 — داشبورد و مدیریت جامع عادات

### تسک G5.1 — توابع خالص آماری عادت
- **راهنمای پیاده‌سازی:** ساخت `utils/habitStats.ts`: `computeStreaks`, `weekdayBreakdown`, `monthlyTrend`, `weeklyHeatmap` — ورودی `completedDates: string[]` (YYYY-MM-DD)، همه Tehran-aware با `utils/dateUtils.ts`.
- **محدودیت‌ها:** توابع کاملاً خالص و بدون side-effect؛ هیچ I/O؛ مرز روز/ماه با منطقه‌ی Tehran.
- `CONTEXT_FILES: ["utils/dateUtils.ts", "services/habitService.ts", "types.ts"]`

### تسک G5.2 — نمای آماری + فرم مشترک عادت
- **راهنمای پیاده‌سازی:** ساخت `features/habits/components/HabitStatsView.tsx` (heatmap هفتگی، میله‌های ماهانه، نوار روزهای هفته، streak — همه با **SVG/CSS سبک**). استخراج فرم ویرایش به `features/habits/components/HabitForm.tsx` از روی `features/habits/components/HabitEditorModal.tsx`.
- **محدودیت‌ها:** بدون کتابخانه‌ی چارت. کلاس‌های Tailwind معتبر، single-column. منطق آماری فقط از `utils/habitStats.ts`.
- **وابستگی:** پس از G5.1.
- `CONTEXT_FILES: ["utils/habitStats.ts", "features/habits/components/HabitEditorModal.tsx", "components/icons.tsx", "types.ts"]`

### تسک G5.3 — مودال مدیر عادت + سوییچ در App
- **راهنمای پیاده‌سازی:** ساخت `features/habits/components/HabitManagerModal.tsx` (new ⇒ فقط `HabitForm`؛ موجود ⇒ تب «آمار» با `HabitStatsView` و تب «مدیریت» با `HabitForm` + حذف کامل با تأیید؛ استفاده از `habitService`). ویرایش `App.tsx`: سوییچ مودال `editingHabit` از `HabitEditorModal` به `HabitManagerModal` (همان state `editingHabit`/`setEditingHabit`).
- **محدودیت‌ها:** حذف با تأیید. بدون supabase مستقیم در کامپوننت. **هاتْ‌اسپات `App.tsx` — با G1.5/G3.2/G4.1 سریال.**
- **وابستگی:** پس از G5.2.
- `CONTEXT_FILES: ["App.tsx", "features/habits/components/HabitManagerModal.tsx", "features/habits/components/HabitStatsView.tsx", "features/habits/components/HabitForm.tsx", "services/habitService.ts", "contexts/DataContext.tsx", "features/dashboard/components/HabitTracker.tsx", "types.ts"]`

---

## ترتیب اجرای پیشنهادی (سریال‌سازیِ هاتْ‌اسپات `App.tsx`)
1) G1.1 → G1.2 → G1.3 → G1.4 → G1.5
2) G4.1 → (G4.2 ∥ G4.3)
3) G3.1 → G3.2
4) G5.1 → G5.2 → G5.3
5) G2 (مستقل، هر زمان پس از آزاد بودن منابع)
> همه‌ی تسک‌هایی که `App.tsx` را ویرایش می‌کنند (G1.5, G3.2, G4.1, G5.3) باید نسبت به هم **متوالی** اجرا شوند.
