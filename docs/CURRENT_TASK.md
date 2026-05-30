# CURRENT_TASK.md — سند تمرکز اجرایی (فوکوس بر تسک‌های ۸، ۹ و ۱۰)

> **توجه بسیار مهم برای شروع کار (بدون کانتکست قبلی):** 
> تمامی تسک‌های فاز ۱ و فاز ۲ (تسک‌های ۱ تا ۷) با موفقیت کامل پیاده‌سازی شده و مستقر گردیده‌اند:
> - **اسکیما، روابط و تریگرهای Postgres:** پروفایل‌ها، پلن‌های فرعی، سیستم اشتراک (امبدد)، جداول مرکزی (پروژه‌ها، تسک‌ها، یادداشت‌ها، عادت‌ها، یادآوری‌ها)، سیستم‌های RLS به صورت کاملاً ایزوله بکار گرفته شده‌اند.
> - **اکشن‌های اتمیک (RPC Library):** توابعی مثل `create_task_with_tags` (با ساخت چک‌لیست)، `create_note_with_tags`، `match_documents` (جستجوی معنایی برداری)، `consume_ai_quota` (اعمال کوتای هوش مصنوعی و مدل داینامیک) و `activate_subscription` (صدور آنی پلن فعال بعد از پرداخت موفق) وجود دارند.
> - **توابع لبه (Edge Functions):** 
>   1. `/supabase/functions/ai-assistant/index.ts` به‌طور کامل ارتقا یافته است. هاردکد Base64 برداشته شده (به جای آن مسیر فایل‌های صوتی و تصویری آپلود شده را می‌گیرد) و سیستم سهمیه/مدل داینامیک و همچنین کلاینت Service Role جهت دانلود محرمانه مدیا را با موفقیت تفکیک کرده است.
>   2. `/supabase/functions/zibal-request/index.ts` ایجاد شده و فلوهای پرداخت را ثبت می‌کند.
>   3. `/supabase/functions/zibal-verify/index.ts` ایجاد شده و با احراز هویت متقابل زیبال، خرید را ثبت و فعال می‌کند.

این سند نقشه راه نهایی و مستقل برای پیاده‌سازی **فاز ۳ — فرانت‌اند و یکپارچه‌سازی** (شامل تسک‌های ۸، ۹ و ۱۰) است که در یک گام یکپارچه و فشرده پیاده‌سازی می‌گردند.

---

## ۱. درخت تمرکز فاز جاری (Focus Tree)

در این فاز نهایی فرانت‌اند، پرونده کلاینت را مقتدرانه می‌بندیم. فایل‌های درگیر در تسک عبارتند از:

```
/
├── types.ts                      (افزودن تایپ‌های مربوط به Plan, Subscription, Usage, Dynamic Reminder)
├── App.tsx                       (مدیریت بازگشت زیبال، Onboarding، رویدادهای Realtime و استیت سراسری)
├── hooks/
│   └── useNetworkStatus.ts       (هوک سناریوی آفلاین / پایش آنلاین بودن کلاینت)
├── services/
│   ├── supabaseClient.ts         (انتقال کلیدهای هاردکد به VITE_* envs)
│   ├── mediaService.ts           (جدید - آپلود مدیا به باکت خصوصی chat-media)
│   ├── billingService.ts         (جدید - فراخوانی توابع لبه‌ی زیبال)
│   └── reminderService.ts        (جدید - توابع مدیریت یادآوری‌ها و ارسال نوتیفیکیشن مرورگر)
└── components/
    ├── ChatView.tsx              (بازطراحی کامل ساختار مدیا، قطع تکیه به Base64، هندلینگ خطای پرداختی ۴۰۲)
    ├── PaywallModal.tsx          (جدید - مودال خرید اشتراک پولی هکسر و نمایش پلن‌ها)
    ├── Onboarding.tsx            (جدید - فرم خوش‌آمدگویی و تکمیل اطلاعات اولیه برای کاربران جدید)
    └── NetworkBanner.tsx         (جدید - بنر وضعیت آفلاین با پیام فارسی)
```

---

## ۲. گزارش وضعیت و پیشرفت کلان سیستم

- [x] **تسک ۱:** پایهٔ هویت و بیلینگ (Extensions + Profiles + Billing Core) -- **کامل شد**
- [x] **تسک ۲:** جداول دامنهٔ اصلی محصول (Core Domain + Indexes) -- **کامل شد**
- [x] **تسک ۳:** جداول پرداخت و یادآوری (Payments + Reminders) -- **کامل شد**
- [x] **تسک ۴:** توابع و تراکنش‌های اتمیک (RPC) -- **کامل شد** (_ایجاد تابع مصرف سهمیه consume_ai_quota و تعریف تابع activate_subscription در دیتابیس_)
- [x] **تسک ۵:** ذخیره‌سازی فایل و امنیت آن (Storage Private Buckets) -- **کامل شد** (_ایجاد باکت‌های خصوصی chat-media و avatars همراه با RLS پوشه‌ای_)
- [x] **تسک ۶:** ارتقای توابع AI و حذف کامل Base64 -- **کامل شد**
- [x] **تسک ۷:** توابع پرداخت زیبال (Request + Verify) -- **کامل شد**
- [x] **تسک ۸:** بازطراحی خط لولهٔ مدیا در کلاینت (Storage Upload Pipeline) -- **کامل شد**
- [x] **تسک ۹:** اشتراک، Paywall و بازگشت از پرداخت (Billing UI) -- **کامل شد**
- [x] **تسک ۱۰:** تجربهٔ Production (Onboarding + Reminders + Realtime امن + افت تدریجی) -- **کامل شد**

---

## ۳. راهنمای پیاده‌سازی فنی تسک‌های پیش رو

تسک‌های ۸، ۹ و ۱۰ به‌منظور هم‌افزایی و سرعت بیلد در فرانت‌اند به‌یکباره پیاده‌سازی می‌شوند.

### ۳.۱. تسک ۸: بازطراحی خط لولهٔ مدیا در کلاینت (Storage Upload Pipeline)

#### ۳.۱.۱. متغیرهای محیطی استاندارد در `services/supabaseClient.ts`
- هرگونه آدرس هاردکد شده قبلی برای Supabase URL و Anon Key را از فایل حذف کنید.
- از متغیرهای محلی سازگار با Vite استفاده کنید:
  ```typescript
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  ```
- حتماً چک کنید اگر این متغیرها هنوز توسط پلتفرم از منو لود نشده‌اند، از همان مقادیر قبلی به‌عنوان Fallback استفاده کنید تا سرور هیکس کرش نکند.

#### ۳.۱.۲. سرویس جدید `services/mediaService.ts`
- تابعی به نام `uploadChatMedia(blob: Blob, ext: string): Promise<string>` پیاده‌سازی کنید:
  1. شناسه کاربر فعلی را از سیستم دریافت کند.
  2. مسیر منحصر به فرد به صورت `{user_id}/{uuid}.{ext}` بسازد.
  3. با استفاده از کلاینت استاندارد کلاینتی، به باکت خصوصی `chat-media` آپلود کند.
  4. در صورت موفقیت، **مسیر نسبی فایل** (نه URL کامل) را بازگرداند.
  5. فیدبک برای جدول ثبت دارایی‌های رسانه‌ای `media_assets` را نیز به صورت دلخواه اعمال کند.

#### ۳.۱.۳. بازنویسی جریان ارسال در کامپوننت `components/ChatView.tsx`
- **حذف کامل کدهای فشرده‌ساز سنگین تصاویر به بیس۶۴ یا تابع `blobToBase64`**.
- وقتی کاربر دکمه ارسال پیام را می‌زند یا صوت ضبط می‌کند یا عکسی انتخاب می‌کند:
  - ابتدا مدیا را مستقیماً با فراخوانی `uploadChatMedia` به استوریج سوپابیس فرستاده و مسیرِ فایلِ آپلود شده (`audioPath` یا `imagePath`) را برگردانید.
  - پیام نهایی را به صورت وب‌هوک به Edge Function دستیار هوشمند ارسال کنید:
    ```typescript
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        message,
        history,
        mode,
        audioPath: extractedAudioPath || null,
        imagePath: extractedImagePath || null
      })
    });
    ```
- **مدیریت خطای ۴۰۲ (Paywall Gateway):** 
  - در صورت بازگشت خطای ۴۰۲ (Payment Required) از سرور، فرآیند چت را قطع کرده و یک مودال زیباد با نام `PaywallModal` را جهت ارتقای به پلن‌های پولی، پیش روی کاربر باز کنید. پیام فارسی دقیق: *"سقف مصرف دوره آزمایشی یا سهمیه ماهانه هوش مصنوعی شما تمام شده است. لطفاً جهت فعال‌سازی حساب خود اشتراک تهیه فرمایید."*

---

### ۳.۲. تسک ۹: اشتراک، Paywall و بازگشت از پرداخت (Billing UI)

#### ۳.۲.۱. توسعه اتمیک `types.ts`
اطلاعات زیر را به فایل اضافه کنید:
```typescript
export interface Plan {
  plan_code: string;
  display_name: string;
  price_irr: number;
  monthly_quota: number;
  period_days: number;
  ai_model: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_code: string;
  status: 'active' | 'expired' | 'canceled' | 'pending';
  started_at: string;
  expires_at: string;
}

export interface UsageStatus {
  user_id: string;
  period_start: string;
  period_end: string;
  request_count: number;
}
```

#### ۳.۲.۲. ایجاد `services/billingService.ts`
- تابعی برای واکشی پلن کلاینت جاری بسازید (`getSubscription()`).
- تابعی برای واکشی میزان درخواست مصرفی و سهمیه دوره جاری کلاینت بسازید (`getUsage()`).
- تابع `startCheckout(plan_code: string): Promise<string>` توسعه دهید:
  - با توکن کاربر، به تابع لبه `/v1/zibal-request` درخواست ثبت پرداختی می‌دهد.
  - فیلد `payUrl` زیبال را استخراج کرده و مقدار `window.location.href = payUrl` را ست می‌کند تا کاربر مستقیم به درگاه پرداخت زیبال برود.
- تابع `verifyPayment(trackId: string): Promise<any>` پیاده‌سازی کنید:
  - با پاس دادن شناسه تراکنش `trackId` به تابع لبه `/v1/zibal-verify` صحت تراکنش را در پشت صحنه (B2B) احراز می‌کند.

#### ۳.۲.۳. طراحی کامپوننت `components/PaywallModal.tsx`
- مودال فارسی، شکیل، واکنش‌گرا و شفاف که شامل جزئیات سه طرح است:
  1. **آزمایشی (free):** ۳ روزه، محدود به ۳۰ درخواست، مدل ۲.۵ لایت، قیمت صفر ریال.
  2. **پلاس (plus):** ۳۰ روزه، ۴۰۰ درخواست، مدل ۲.۵ لایت، قیمت ۹۹,۰۰۰ تومان (۹۹۰,۰۰۰ ریال).
  3. **حرفه‌ای (pro):** ۳۰ روزه، ۱۰۰۰ درخواست، مدل ۳.۱ جینی لایت، قیمت ۲۹۹,۰۰۰ تومان (۲,۹۹۰,۰۰۰ ریال).
- این مودال به عنوان سد پرداخت باز می‌شود و با کلیک روی هر دکمه خرید، وب هوک `startCheckout` را جهت ارسال کاربر به درگاه بانک فراخوانی می‌کند.

#### ۳.۲.۴. بازگشت از پرداخت و تاییدیه (Payment Redirect Handler)
- در بدنه اصلی نرم‌افزار (`App.tsx` یا تابع `useEffect` ریشه بعد از احراز هویت):
  - پارامترهای آدرس وب (URL کوئری‌ها) را جهت وجود `trackId` یا `track_id` کنترل کنید. (زیبال پارامترها را بعد از اتمام پرداخت به مسیر Callback بازمی‌گرداند).
  - اگر پارامتری وجود داشت، بلافاصله آن را از آدرس مرورگر پاک کنید (با `window.history.replaceState` جهت جلوگیری از لوپ) و فراخوانی متد `verifyPayment(trackId)` را آغاز کنید.
  - در صورت موفقیت: یک اعلان (Toast) فارسی نشان دهید: *"پرداخت شما با موفقیت تأیید شد! اشتراک شما هم‌اکنون فعال گردید."* و داده‌های اشتراک کاربر را بازخوانی کنید.
  - در صورت خطا یا رد تراکنش توسط کاربر: اعلان خطای متناسب با پیام زیبال را به او بدهید.

---

### ۳.۳. تسک ۱۰: تجربهٔ Production (Onboarding + Reminders + Realtime امن + افت تدریجی)

#### ۳.۳.۱. جریان خوش‌آمدگویی (کامپوننت `components/Onboarding.tsx`)
- اگر فیلد `profiles.onboarding_completed` پس از ورود کاربر برابر با `false` بود، فلو خوش‌آمدگویی را در قالب یک فرم شیک و مینیمال اجرا کنید.
- نام و نام خانوادگی، علایق یا تخصص کاربر را دریافت نموده، ردیف جدول `profiles` را آپدیت کرده و ستون مربوطه را به `onboarding_completed = true` تغییر دهید تا دیگر این فرم برای کاربر تکرار نشود.

#### ۳.۳.۲. ساختار امن سوپابیس و واکشی بلادرنگ (Secure Realtime Filter)
- یکی از بندهای حیاتی PROJECT.md، محدودسازی اکید چنل‌های ریل‌تایم است.
- کدهای ریل تایم فایل `App.tsx` را به شکل زیر تصحیح کنید تا کلاینت فقط از پوشه و ردیف‌های خود رویداد دریافت کند:
  ```typescript
  const taskChanges = supabase
    .channel('tasks-changes')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'tasks',
      filter: `user_id=eq.${user.id}` // امن‌سازی با UID کاربر
    }, payload => { ... })
    .subscribe();
  ```
- این تغییرات را بر روی چنل‌های پروژه‌ها (`projects`)، یادداشت‌ها (`notes`)، عادت‌ها (`habits`) و یادآوری‌ها (`reminders`) نیز اعمال کنید.

#### ۳.۳.۳. زیرسیستم یادآوری‌ها (System Reminders)
- ایجاد لایه `services/reminderService.ts` با توابع زیر:
  - `getReminders()`: واکشی یادآوری‌های کاربر از دیتابیس.
  - `markAsRead(id: string)`: تغییر وضعیت یادآوری به خوانده شده.
- به صورت بلادرنگ هم نوتیفیکیشن‌ها را گوش دهید و در صورتی که زمان یادآوری کارهایی فرارسید، علاوه بر توسترِ درون برنامه، از **Web Notifications API** مرورگر استفاده کنید تا خارج از برنامه نیز به کاربر اعلانات فارسیِ جذاب بفرستد (همراه با کسب اجازه دسترسی مرورگر).

#### ۳.۳.۴. هوک و بنر وضعیت آفلاین (Graceful Network Degradation)
- **هوک مدیریت اینترنت `hooks/useNetworkStatus.ts`:**
  - وضعیت شبکه را با استفاده از وب ای‌پی‌آی مرورگر (`window.navigator.onLine`) همواره گوش دهید و استیت اتمیک `isOnline` را بروزرسانی کنید.
- **بنر وضعیت شبکه `components/NetworkBanner.tsx`:**
  - در بالاترین سطح بدنه به صورت شناور، بنر زیبایی با پس‌زمینه رنگی و متن فارسی هادی آفلاین بودن کلاینت نشان داده شود: *"دسترسی شما به اینترنت قطع شده است؛ تغییرات شما ثبت کلاینت گردیده و بعد از اتصال مجدد ذخیره خواهد شد."*
- تمام جریان‌های فچ داده را مجهز به ساختار `try-catch` همراه با توسترهای فارسیِ حاوی دکمه تلاش مجدد (Retry) کنید تا کرش یا سفید شدن صفحه کلاً برچیده شود.

---
# Zibal API Reference (CRITICAL)
- **Base URL:** `https://gateway.zibal.ir/v1`
- **Request Endpoint:** POST `/request`
  - Body: `merchant` (string), `amount` (integer, in RIAL), `callbackUrl` (string), `orderId` (string/UUID).
  - Returns: `trackId` (string), `result` (int). If result == 100, redirect user to `https://gateway.zibal.ir/start/{trackId}`.
- **Verify Endpoint:** POST `/verify`
  - Body: `merchant` (string), `trackId` (string).
  - Returns: `result` (int), `refNumber` (string). If result == 100, payment is successful. If result == 201, it was already verified.
- **Merchant Key:** Use `ZIBAL_MERCHANT` from environment variables. For testing, it might be the string `'zibal'`.
---

## ۴. لیست نبایدها و ضدالگوهای حیاتی فاز جاری (Anti-Patterns Check)

قبل از بیلد و کامپایل نهایی فرانت‌اند، مطمئن شوید که خطوط قرمز زیر هرگز نقض نگردند:

1. **انتقال مستقیم بیس۶۴:** هیچگونه تبدیل بیس۶۴ یا فولد کردن عکسی داخل چت برای کلاینت انجام نشود. کلاینت فقط فایل را در `chat-media` آپلود نموده و مسیر آن‌ را ارسال می‌کند.
2. **سکیور رل کلید:** کلید `service_role` هرگز نباید پای آن به سورس فرانت‌اند (`/src/` یا کامپوننت‌ها یا سرویس‌ها) باز شود. کلاینت فقط با Anon Key و هدر Authorization کار می‌کند.
3. **داده‌های هاردکد مکتوب:** مبالغ پلن‌ها به ریال، سهمیه کوتاها و مدل‌ها باید از سرور و متد لبه و کوئری خوانده شوند نه اینکه در دایره لایه فرانت‌اند هاردکد شوند.
4. **تاییدیه لوکال پرداخت:** هیچ دکمه‌ای برای "اشتراک من را فعال کن" به صورت مستقیم و بدون پیوند با وب‌هوک تاییدیه سرور زیبال (`zibal-verify`) نسازید.
5. **شیر فیلتر ریل‌تایم:** ثبت اشتراک ریل‌تایم بدون فیلتر `user_id=eq.` ممنوع است.

همه چیز آماده است تا در گام بعدی با استفاده از این نقشه راه غنی، نرم‌افزار را به مرز انتشار برسانیم!
