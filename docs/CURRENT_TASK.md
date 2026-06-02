# CURRENT_TASK.md — سند تمرکز فاز D (مراحل B3 و B4: بازنویسی ارکستراتور و نوسازی برداری)

> **توجه بحرانی برای مدل مجری:** این سند به عنوان تنها «پنجره تمرکز» (Focus Window) کانتکست شما طراحی شده است. از آنجا که این عملیات در یک چت مستقل با حافظه پاک‌شده اجرا می‌شود، تمام قراردادها، کدها، کلاس‌ها، ایمپورت‌ها و محدودیت‌های فیزیکی دو تسک نهایی فاز D در این سند متمرکز شده‌اند. شما باید دو تسک **B3** (بازنویسی ارکستراتور نازک) و **B4** (اصلاح وب‌هوک وکتورایزر) را در یک تک‌گام بدون دستکاری کدهای فرانت‌اَند یا نقض اصول `PROJECT.md` پیاده‌سازی و نهایی کنید.

---

## وضعیت اجرای فاز D
- [x] **تسک B1:** ساخت `_shared/` (شامل `cors.ts` و `auth-guard.ts` و `gemini-client.ts`) - **با موفقیت کامل انجام شد**
- [x] **تسک B2:** ساخت ماژول‌های مستقل `ai-assistant/lib/` (شامل `system-prompt.ts` و `meta-context.ts` و `rag-context.ts` و `media-handler.ts` و `action-processor.ts`) - **با موفقیت کامل انجام شد**
- [x] **تسک B3:** بازنویسی `ai-assistant/index.ts` به عنوان ارکستراتور نازک و ایمن - **با موفقیت کامل انجام شد**
- [x] **تسک B4:** اصلاح `vectorize/index.ts` جهت یکپارچه‌سازی کامل مدل امبدینگ مشترک - **با موفقیت کامل انجام شد**

---

## ۱. درخت تمرکز (Focus Tree)

فایل‌هایی که در این گام تغییر می‌کنند تا تمام منطق‌ها از فایل اصلی جدا شده و سیستم تبدیل به یک ارکستراتور بسیار زیبا و اتمیک شود:

```
supabase/functions/
├── _shared/                              ← کدهای ساخته شده قبلی (برای استفاده در B3 و B4)
│   ├── cors.ts                           ← هدرهای CORS استاندارد کورتکس
│   ├── auth-guard.ts                     ← اعتبارسنجی توکن کاربر و بازیابی کلاینت امن
│   └── gemini-client.ts                  ← ائتلاف پایدار مدل امبدینگ ثبات و جنریت لنگرگاهی
│
├── ai-assistant/                         
│   ├── index.ts                          ← [ویرایش در تسک B3] ارکستراتور نازک و پاکسازی شده
│   └── lib/                              ← ماژول‌های منطق بیزینس (ساخته شده در تسک قبلی)
│       ├── system-prompt.ts              ← تولید قالب پروامپت متنی پایدار هکسر
│       ├── meta-context.ts               ← کوئری وضعیت کارهای امروز، یادداشتها و پروژه‌ها
│       ├── rag-context.ts                ← تعبیه‌سازی جستار و اجرای RPC هیبریدی (RAG)
│       ├── media-handler.ts              ← دانلود مدیاها از پرایوت استوریج و انکود ایمن
│       └── action-processor.ts           ← هندلر چندگانه تراکنش‌های دیتابیس (CREATE / LINK)
│
└── vectorize/
    └── index.ts                          ← [ویرایش در تسک B4] یکپارچگی مدل امبدینگ با _shared
```

---

## ۲. مشخصات و راهنمای پیاده‌سازی تسک B3 (بازنویسی `ai-assistant/index.ts`)

فایل قدیمی `supabase/functions/ai-assistant/index.ts` حاوی بیش از ۶۰۰ خط کد است که تمام منطق‌های دانلود فایل، کوئری‌های دیتابیس، پردازش اکشن‌ها، لود امبدینگ و تولید پرامپت در آن تجمیع شده بود. این امر ریسک خطاهای ناگهانی و بروز نگهداری سخت را به بالاترین حد می‌رساند.
در تسک B3، این فایل باید به طور کامل بازنویسی شود تا به عنوان یک ارکستراتور نازک، تمیز و گیت‌وی احراز هویت عمل کند.

### لاجیک و الگوهای رفتاری ارکستراتور در گام B3:
1. **هدرهای امینیتی و CORS:** مدیریت درخواست‌های مقدماتی (OPTIONS) با پاسخ فوری 'ok' همراه با هدرهای ورودی از فایل مشترک `../_shared/cors.ts`.
2. **کلاینت‌های توزیع شده:**
   - استفاده از متد گارد `getAuthUser(req.headers.get('Authorization'))` برای دریافت سشن تایید شده کاربر و کلاینت کاربر-محور سوپابیس.
   - کلاینت جنبه سرویسِ رول (Service Role) جهت عملیات‌های دانلود فایل‌ها از Storage خصوصی (خارج از محدودیت‌های دسترسی توکن محدود کاربر).
3. **گارد بررسی تراکنش اعتباری (Quota Gateway):**
   - فراخوانی متد RPC با شناسه `consume_ai_quota`.
   - اگر از طرف پایگاه داده خطا پرتاب شد یا خروجی حاوی عدم مجوز بود، سرویس با پاسخ ۴۰۲ (Payment Required) متوقف می‌شود.
   - بازیابی مدل تخصیص داده شده به سشن کاربر از روی خروجی سهمیه (مثلاً `gemini-2.5-flash-lite`).
4. **زمان‌سنجی فیزیکی و بومی ایرانی:**
   - استخراج روز جاری بر اساس فرمت تقویم هجری شمسی به زبان شیرین فارسی جهت تحلیل هوشمند رادارهای تاریخ کاربر:
     ```typescript
     const today = new Date();
     const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD
     const dayName = today.toLocaleDateString('fa-IR', { weekday: 'long' });
     const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
       year: 'numeric',
       month: 'long',
       day: 'numeric'
     }).format(today);
     ```
5. **موتور چندگانه همزمانی (Concurrent Context Architecture):**
   - فراخوانی همزمان پردازش متاداده‌ها (تسک‌ها و یادداشت‌های ۵ روز اخیر) و RAG به کمک ابزار بیزینسی اختصاصی:
     ```typescript
     const isProposalMode = !!(audioPath || imagePath);
     const ai = getGoogleGenAI();

     // همزمانی کوئری‌ها جهت حداقل کردن تاخیر خطی آبشاری (Linear Waterfall Latency)
     const [metaContext, ragData] = await Promise.all([
       buildMetaContext(supabaseClient, mode, isProposalMode, todayStr),
       buildRagContext(supabaseClient, ai, message)
     ]);
     ```
6. **مدیریت محتویات ورودی و تاریخچه گفتگو (mergeConsecutiveRoles):**
   - پیش‌بینی و هندل الگوریتم ادغام هوشمند رول‌های متوالی تکراری جمینی (در صورت بروز ناهماهنگی در آرایه ارسالی از کلاینت):
     ```typescript
     function mergeConsecutiveRoles(contents: any[]) {
       if (!contents || contents.length === 0) return [];
       const merged: any[] = [];
       for (const item of contents) {
         if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
           merged[merged.length - 1].parts.push(...item.parts);
         } else {
           merged.push({ role: item.role, parts: [...item.parts] });
         }
       }
       return merged;
     }
     ```
7. **بارگیری ایمن فایل‌های پیوست مدیا:**
   - استفاده از پکیج کمکی `media-handler.ts` و فرستادن اطلاعات مدیا پارتس به جمینی به صورت تکه‌های Base64 تعبیه‌شده.
8. **فراخوانی هسته مولد مدل جمینی:**
   - فراخوانی `ai.models.generateContent` با ترتیبی کاملاً تمیز از تاریخچه گفتگوها و پارت‌های جدید پیام کاربر.
9. **پردازشگر پس‌لرزه تراکنشی (Action Resolution Engine):**
   - بررسی سناریوی Extraction/Proposal؛ در صورت فعال بودن مود پروپوزال، نوشتن روی دیتابیس مطلقاً ممنوع است (Zero-Write Enforcement).
   - در صورت استفاده از چت آزاد تعاملی، اکشن‌های استخراج شده با فراکشن همزمان در `processActions` اجرا شده و پاسخ بازسازی شده به کاربر تحویل می‌گردد.

### کد دقیق و بهینه نهایی برای فایل `/supabase/functions/ai-assistant/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser } from '../_shared/auth-guard.ts';
import { getGoogleGenAI } from '../_shared/gemini-client.ts';
import { buildSystemPrompt } from './lib/system-prompt.ts';
import { buildMetaContext } from './lib/meta-context.ts';
import { buildRagContext } from './lib/rag-context.ts';
import { downloadMediaParts } from './lib/media-handler.ts';
import { processActions } from './lib/action-processor.ts';

declare const Deno: any;

function mergeConsecutiveRoles(contents: any[]) {
  if (!contents || contents.length === 0) return [];
  const merged: any[] = [];
  for (const item of contents) {
    if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
      merged[merged.length - 1].parts.push(...item.parts);
    } else {
      merged.push({ role: item.role, parts: [...item.parts] });
    }
  }
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { user, supabaseClient } = await getAuthUser(authHeader);

    const { message, history, mode, audioPath, imagePath } = await req.json();

    // ۱. بررسی اعتبار و سهمیه هوش مصنوعی (Quota Gateway)
    const { data: quotaResult, error: quotaError } = await supabaseClient.rpc('consume_ai_quota');
    if (quotaError) {
      console.error("Quota Check Error from RPC:", quotaError);
      throw new Error(`Quota restriction check failed: ${quotaError.message}`);
    }

    const quota = Array.isArray(quotaResult) ? quotaResult[0] : quotaResult;
    if (!quota) {
      throw new Error("Unable to retrieve quota information");
    }

    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: "Quota exceeded or subscription expired",
        reason: quota.reason || "quota_exceeded"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402
      });
    }

    const modelName = quota.model || 'gemini-2.5-flash-lite';
    const ai = getGoogleGenAI();

    // ۲. پردازش تاریخ‌های امروزی شمسی و میلادی
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const dayName = today.toLocaleDateString('fa-IR', { weekday: 'long' });
    const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(today);

    // ۳. همزمانی کوئری‌ها جهت جلوگیری از Waterfall Latency
    const isProposalMode = !!(audioPath || imagePath);

    const [metaContext, ragData] = await Promise.all([
      buildMetaContext(supabaseClient, mode, isProposalMode, todayStr),
      buildRagContext(supabaseClient, ai, message)
    ]);

    const context = `${metaContext}${ragData.contextString}`;
    const systemPrompt = buildSystemPrompt({
      context,
      isProposalMode,
      todayStr,
      dayName,
      persianDate
    });

    // ۴. دانلود و الحاق فایل‌های چندرسانه‌ای به کمک کلید سرویس رول امن
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userMessageParts: any[] = [];
    if (message) userMessageParts.push({ text: message });

    if (audioPath || imagePath) {
      const mediaParts = await downloadMediaParts(supabaseService, { audioPath, imagePath }, user.id);
      userMessageParts.push(...mediaParts);
    }

    // ۵. فرمت‌بندی تاریخچه تعاملی کاربر
    const modelHistoryRaw = history ? history.slice(-5).map((h: any) => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })) : [];

    const modelHistory = mergeConsecutiveRoles(modelHistoryRaw);

    // ۶. استعلام پاسخ از مدل هوشمند جمینی
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...modelHistory,
        { role: 'user', parts: userMessageParts }
      ],
      config: {
        responseMimeType: 'application/json',
        systemInstruction: systemPrompt,
        temperature: 0.0,
        maxOutputTokens: 8192
      }
    });

    const rawText = response.text;
    let aiResult;
    try {
      const cleanText = rawText?.replace(/```json\n?|\n?```/g, '').trim() || "{}";
      aiResult = JSON.parse(cleanText);
    } catch (e) {
      console.error("JSON Parse Error. Raw Text:", rawText);
      throw new Error("Failed to parse AI response. Invalid JSON format returned from model.");
    }

    const { actions, transcription, reply, proposals } = aiResult;
    let actionResults: any[] = [];

    // ۷. تفکیک پردازش به اکشن‌ها بر اساس نوع ورودی
    if (isProposalMode) {
      console.log("Zero write constraint: Skipping database mutations in extraction mode.");
    } else if (actions && Array.isArray(actions)) {
      actionResults = await processActions(actions, supabaseClient, ai, user.id);
    }

    return new Response(JSON.stringify({
      reply: reply || "انجام شد.",
      citations: ragData.citations,
      actionResults,
      proposals: proposals || [],
      transcription: transcription || ""
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("AI Assistant Orchestrator General Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.status || 500,
    });
  }
});
```

---

## ۳. مشخصات و راهنمای پیاده‌سازی تسک B4 (اصلاح وب‌هوک `vectorize/index.ts`)

تفاوت مدلِ امبدینگ تعبیه‌سازی در چت جمینی (`gemini-embedding-2-preview`) با وکتورایزر مستقل دیتابیس (`text-embedding-004`) یکی از بزرگترین چالش‌های کارایی سیستم به حساب می‌آمد. برای اطمینان از تجانس کامل و شباهت بردارها در کوئری هیبریدی، هردو ماژول باید به صورت ۱۰۰٪ همگام رفتار کنند.

### لاجیک ارتقا یافته‌ی وب‌هوک وکتورایزر در گام B4:
1. **استفاده از هدرهای CORS به طور اشتراکی** برای یکپارچگی پاسخ‌ها.
2. **استفاده از سیستم جمینی لنگرگاهی مشترک:**
   - حذف ساختار دستی ساخت امپورت `new GoogleGenAI` با اطلاعات تکراری.
   - ورود تابع `getGoogleGenAI()` و `generateEmbedding()` به طور مستقیم از پوشه `../_shared/gemini-client.ts`.
3. **مقاوم‌سازی خطاهای تعبیه‌سازی:** در صورت روبرو شدن با عدم مقدار در امبدینگ، خطا بلافاصله گزارش داده شود.
4. **ثبت اطلاعات بردار نویسی شده:** بازگشت متد موفق با ابعاد وکتور نهایی ذخیره شده برای لاگ مانیتورینگ سیستم.

### کد دقیق و بهینه نهایی برای فایل `/supabase/functions/vectorize/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGoogleGenAI, generateEmbedding } from '../_shared/gemini-client.ts';
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, id } = payload;
    
    if (!id || !type) {
      console.error("Missing payload required fields (id, type):", payload);
      return new Response(JSON.stringify({ message: "Invalid payload: id or type missing" }), { status: 400, headers: corsHeaders });
    }

    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      SERVICE_ROLE_KEY
    );

    const table = type === 'task' ? 'tasks' : 'notes';

    // بازیابی نسخه جدید رکورد
    const { data: record, error: fetchError } = await supabaseClient
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !record) {
      throw new Error(fetchError ? `Fetch error: ${fetchError.message}` : `Record with id ${id} not found in ${table}`);
    }

    // ساخت ترکیب متنی برای برداری کردن داده
    let combinedText = '';
    if (type === 'task') {
      const title = record.title || '';
      const description = record.description || '';
      const tags = Array.isArray(record.tags) ? record.tags.join(' ') : '';
      combinedText = `${title} ${description} ${tags}`.trim();
    } else {
      const title = record.title || '';
      const content = record.content || '';
      const tags = Array.isArray(record.tags) ? record.tags.join(' ') : '';
      combinedText = `${title} ${content} ${tags}`.trim();
    }

    if (!combinedText) {
      return new Response(JSON.stringify({ message: "Constructed content is empty, skipping vectorization" }), { status: 200, headers: corsHeaders });
    }

    // اجرای امبدینگ هوشمند با متد مشترک و هماهنگِ کل سیستم
    const ai = getGoogleGenAI();
    console.log(`Generating embedding for ${type} ID: ${id} with consistent model...`);
    
    const embeddingValues = await generateEmbedding(ai, combinedText);

    // به‌روزرسانی مقدار برداری رکورد
    const { error: updateError } = await supabaseClient
      .from(table)
      .update({ embedding: embeddingValues })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Supabase DB Error during update: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ message: "Vectorized successfully", length: embeddingValues.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Vectorize Error Details:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

---

## ۴. لیست نبایدهای بحرانی و الگوهای ضدبحران (Anti-Patterns)

- [ ] **تحت هیچ شرایطی** از مدل‌های منسوخ شده مانند `text-embedding-004` در هیچ فایلی استفاده نکنید؛ پیاده‌سازی متد امبدینگ ثبات صرفاً متعهد به مدل تعریف شده در `_shared/gemini-client.ts` است.
- [ ] **از نوشتن منطق‌های تکراری** کلاینت سازی دیتابیس یا چک امنیتی مسیرها در بدنه فایل‌های index خودداری کنید؛ همه این بخش‌ها از پکیج‌های بیزینسی و به اشتراک‌گذاری شده بارگذاری می‌شوند.
- [ ] **هرگز کدهای قدیمی به درد نخور را کامنت نکنید**؛ پس از استقرار منطق جدید، فایل‌ها به صورت تمیز عاری از لاگ‌های شلوغ یا کدهای بلااستفاده باشند.
- [ ] **تا تایید نهایی از سلامت ریبیلد کل اپ مطمئن نشوید**؛ ران کردن گام موفق compile_applet یکی از بندهای اصلی تضمین لید دولوپر در کدیار است.

---

**موتور اجرایی کدیار! وظیفه شما هم‌اکنون آغاز می‌شود. فایل‌های تسک B3 و B4 را با توجه کامل به تمامی نکات مطرح شده تغییر دهید و پایداری برداری را به کل کورتکس هوشمند بازگردانید!**
