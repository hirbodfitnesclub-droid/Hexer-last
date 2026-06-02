---

## فاز D — پایداری بک‌اند: ریفکتور Edge Functions هوش مصنوعی

> **اولویت:** بحران فعلی. این فاز باید **قبل از هر کار دیگری** اجرا شود.
> **قانون:** فرانت‌اند تغییر نمی‌کند. قرارداد API حفظ می‌شود. RPCها دست نمی‌خورند.
> **ترتیب اجرا:** B1 → B2 → B3 (موازی با B2) → B4

---

### تسک B1: ساخت `_shared/` — پایه‌ی مشترک و رفع تناقض مدل

**راهنمای پیاده‌سازی فنی:**

سه فایل جدید در `supabase/functions/_shared/` بساز:

1. **`cors.ts`** — فقط export کردن `corsHeaders` constant:
```typescript
   export const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   };
```

2. **`auth-guard.ts`** — تابع `getAuthUser(authHeader: string | null)`:
   - اگر `authHeader` نبود throw با status 401
   - با `SUPABASE_ANON_KEY` و `authHeader`، یک supabase client کاربر-محور می‌سازد
   - `auth.getUser()` صدا می‌زند؛ اگر user نبود throw با status 401
   - برمی‌گرداند: `{ user, supabaseClient }` (هر دو برای مصرف در index.ts)

3. **`gemini-client.ts`** — سه export:
   - `export const EMBEDDING_MODEL = 'text-embedding-004';` ← **قانون ثبات. فقط اینجا. هرگز هاردکد نشود.**
   - `export function getGoogleGenAI(): GoogleGenAI` — همان singleton factory فعلی
   - `export async function generateEmbedding(ai: GoogleGenAI, text: string): Promise<number[]>` — تابعی که:
     - `ai.models.embedContent({ model: EMBEDDING_MODEL, contents: text })` صدا می‌زند
     - هر دو path پاسخ را چک می‌کند: `response.embeddings?.[0]?.values` و `response.embedding?.values`
     - اگر هیچ‌کدام نبود throw با پیام واضح
     - این تابع بوگ dual-path را یک‌بار برای همیشه حل می‌کند

**محدودیت‌ها:** هیچ منطق بیزینسی اینجا نیست. این فایل‌ها فقط utils هستند. هیچ کد DB یا Gemini generation اینجا نمی‌آید.
⚠️ [تبصره‌های تک‌لید - اصلاحات اجباری بر روی تسک]:
۱. نام مدل Embedding: در فایل `gemini-client.ts`، مقدار `EMBEDDING_MODEL` را برخلاف متن تسک، حتماً برابر با `'gemini-embedding-2-preview'` قرار بده.
۲. ساختار آرگومان: در تابع `generateEmbedding`، متغیر `text` را دقیقاً به شکل رشته متنی مستقیم به جمینی پاس بده (یعنی `contents: text`) و به هیچ وجه آن را داخل آرایه یا آبجکت `parts` نپیچ تا خطای Type Validation نگیریم.

`CONTEXT_FILES: ["supabase/functions/ai-assistant/index.ts", "supabase/functions/vectorize/index.ts"]`

---

### تسک B2: ساخت `ai-assistant/lib/` — ماژول‌های ایزوله

**راهنمای پیاده‌سازی فنی:**

پنج فایل در `supabase/functions/ai-assistant/lib/` بساز. هر فایل یک مسئولیت واحد دارد و import می‌کند از `../../_shared/`.

---

**`system-prompt.ts`** (pure function، بدون async):

```typescript
interface SystemPromptParams {
  context: string;
  isProposalMode: boolean;
  todayStr: string;     // YYYY-MM-DD
  dayName: string;      // Persian day name
  persianDate: string;  // Persian formatted date
}
export function buildSystemPrompt(params: SystemPromptParams): string
```
منطق: همان system prompt فعلی از `index.ts` را **عیناً** کپی کن و به این تابع منتقل کن. هیچ تغییری در محتوای prompt ندهی.

---

**`meta-context.ts`**:

```typescript
export async function buildMetaContext(
  supabaseClient: SupabaseClient,
  mode: ChatMode,
  isProposalMode: boolean,
  todayStr: string
): Promise
```
منطق: کد فعلی مربوط به fetch tasks/notes/projects را از `index.ts` منتقل کن. کل تابع در یک `try/catch` باشد. روی `catch`: `console.error(...)` و `return ""`.

---

**`rag-context.ts`**:

```typescript
export async function buildRagContext(
  supabaseClient: SupabaseClient,
  ai: GoogleGenAI,
  message: string
): Promise
```
منطق:
1. `generateEmbedding(ai, message)` از `_shared/gemini-client.ts` صدا بزن
2. با نتیجه، `hybrid_search` RPC صدا بزن
3. روی موفقیت: context string و citations برگردان
4. کل تابع در `try/catch`: روی هر خطا `return { contextString: '', citations: [] }` (RAG failure نباید سرویس را بکشد)

---

**`media-handler.ts`**:

```typescript
export async function downloadMediaParts(
  supabaseService: SupabaseClient,
  paths: { audioPath?: string; imagePath?: string },
  userId: string
): Promise
```
منطق: کد `getCleanAndValidatedPath`, `getMimeType`, و download از Storage را از `index.ts` منتقل کن. اگر download ناموفق بود → throw (این failure critical است). `encodeBase64` هم اینجا انجام می‌شود. خروجی: آرایه‌ای از `{ inlineData: { mimeType, data } }` objects.

---

**`action-processor.ts`**:

```typescript
export async function processActions(
  actions: any[],
  supabaseClient: SupabaseClient,
  ai: GoogleGenAI,
  userId: string
): Promise
```
منطق: کد `actionPromises` و تمام `if (currentAction === 'CREATE_TASK')` و غیره را از `index.ts` منتقل کن. هر اکشن در `try/catch` مجزا. برای `SUGGEST_LINK`: از `generateEmbedding` در `_shared` استفاده کن.

**محدودیت‌ها:** منطق prompt، quota، و auth اینجا نمی‌آید. هر فایل فقط مسئولیت نامش را دارد. وابسته به B1.

⚠️ [تبصره‌های تک‌لید - اصلاحات اجباری بر روی تسک]:
۱. رفع نشت حافظه (Memory Leak): در فایل `media-handler.ts` برای تبدیل Blob به Base64، استفاده از حلقه `for` و متد `String.fromCharCode` اکیداً ممنوع است. فقط و فقط از ماژول بومی Deno به شکل `import { encodeBase64 } from "jsr:@std/encoding/base64"` استفاده کن.
۲. رفع باگ امنیتی Path Traversal: در تابع اعتبارسنجی مسیر مدیا، حتماً شرطی بنویس که بررسی کند مسیر درخواستی شامل کاراکترهای `..` نباشد. در صورت وجود، خطای `Forbidden` پرتاب کن.

`CONTEXT_FILES: ["supabase/functions/ai-assistant/index.ts", "supabase/functions/_shared/gemini-client.ts", "supabase/functions/_shared/auth-guard.ts", "docs/ARCHITECTURE.md"]`

---

### تسک B3: بازنویسی `ai-assistant/index.ts` به Orchestrator خالص

**راهنمای پیاده‌سازی فنی:**

فایل `supabase/functions/ai-assistant/index.ts` را از صفر بنویس. هدف: دقیقاً **زیر ۱۲۰ خط**. هیچ منطق بیزینسی مستقیم نباشد — فقط فراخوانی ماژول‌های B1 و B2.

ساختار کلی:

```typescript
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser } from '../_shared/auth-guard.ts';
import { getGoogleGenAI } from '../_shared/gemini-client.ts';
import { buildRagContext } from './lib/rag-context.ts';
import { buildMetaContext } from './lib/meta-context.ts';
import { downloadMediaParts } from './lib/media-handler.ts';
import { processActions } from './lib/action-processor.ts';
import { buildSystemPrompt } from './lib/system-prompt.ts';
// ... imports

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // [1] Parse + Auth + Quota (sequential — هر مرحله وابسته به قبلی)
    const body = await req.json();
    const { user, supabaseClient } = await getAuthUser(req.headers.get('Authorization'));
    const quota = await checkAndConsumeQuota(supabaseClient);
    if (!quota.allowed) return quotaErrorResponse(quota.reason, corsHeaders);

    // [2] Media (اگر وجود داشت)
    const supabaseService = createServiceClient();
    const mediaParts = await downloadMediaParts(supabaseService, body, user.id);
    const isProposalMode = mediaParts.length > 0;

    // [3] Context (موازی — هر دو مستقل از هم)
    const ai = getGoogleGenAI();
    const [ragResult, metaContext] = await Promise.all([
      isProposalMode ? Promise.resolve({ contextString: '', citations: [] })
                     : buildRagContext(supabaseClient, ai, body.message),
      buildMetaContext(supabaseClient, body.mode, isProposalMode, todayStr)
    ]);

    // [4] Generate
    const systemPrompt = buildSystemPrompt({
      context: ragResult.contextString + metaContext,
      isProposalMode, todayStr, dayName, persianDate
    });
    const aiResult = await callGeminiAndParse(ai, quota.model, systemPrompt, body, mediaParts);

    // [5] Actions (فقط در non-proposal mode)
    const actionResults = isProposalMode
      ? []
      : await processActions(aiResult.actions || [], supabaseClient, ai, user.id);

    // [6] Response
    return new Response(JSON.stringify({
      reply: aiResult.reply || '',
      citations: ragResult.citations,
      actionResults,
      proposals: aiResult.proposals || [],
      transcription: aiResult.transcription || ''
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    const status = error.status ?? 500;
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status
    });
  }
});
```

`checkAndConsumeQuota` و `callGeminiAndParse` دو helper function کوچک در همین فایل تعریف می‌شوند (<۲۰ خط هر کدام) تا index.ts خوانا بماند.

**محدودیت‌ها:**
- هیچ `if (currentAction === ...)` در این فایل نیست
- هیچ base64 encoding در این فایل نیست  
- هیچ SQL یا RPC مستقیم در این فایل نیست (جز quota که یک خط است)
- وابسته به B1 و B2

⚠️ [تبصره‌های تک‌لید - اصلاحات اجباری بر روی تسک]:
۱. جلوگیری از خطای 400 جمینی (Alternate Roles): در زمان ساخت `modelHistory` (قبل از پاس دادن به جمینی)، حتماً یک تابع فشرده‌ساز (Collapser) بنویس که پیام‌های متوالی با نقش یکسان (مثلاً دو پیام `user` پشت سر هم یا دو `model` متوالی) را با یکدیگر ترکیب (Merge) کند. API جمینی به شدت روی تناوب نقش‌ها حساس است و بدون این کار کرش می‌کند.

`CONTEXT_FILES: ["supabase/functions/ai-assistant/index.ts", "supabase/functions/ai-assistant/lib/rag-context.ts", "supabase/functions/ai-assistant/lib/meta-context.ts", "supabase/functions/ai-assistant/lib/media-handler.ts", "supabase/functions/ai-assistant/lib/action-processor.ts", "supabase/functions/ai-assistant/lib/system-prompt.ts", "supabase/functions/_shared/cors.ts", "supabase/functions/_shared/auth-guard.ts", "supabase/functions/_shared/gemini-client.ts"]`

---

### تسک B4: اصلاح `vectorize/index.ts` — رفع تناقض مدل

**راهنمای پیاده‌سازی فنی:**

این تسک کوچک‌ترین تسک فاز D است اما حیاتی‌ترین. سه تغییر دقیق:

1. **Import اضافه کن:**
```typescript
   import { EMBEDDING_MODEL, generateEmbedding, getGoogleGenAI } from '../_shared/gemini-client.ts';
```

2. **حذف کن:**
   - تعریف داخلی `GoogleGenAI` instance
   - کد تعریف مدل embedding هاردکد (`'text-embedding-004'` یا هر رشته‌ی دیگری)
   - کل بلوک `Robust Extraction Logic` (dual-path check) — این حالا در `generateEmbedding()` شریک است

3. **جایگزین کن:**
```typescript
   // قبل:
   const ai = new GoogleGenAI({ apiKey: API_KEY });
   const response = await ai.models.embedContent({ model: 'text-embedding-004', ... });
   // [۱۵+ خط dual-path extraction]
   
   // بعد:
   const ai = getGoogleGenAI();
   const embeddingValues = await generateEmbedding(ai, combinedText);
```

بقیه فایل دست نمی‌خورد. منطق ساخت `combinedText` (title + content + tags) حفظ می‌شود.

**چرا این تسک جداست:** B3 و B4 می‌توانند موازی اجرا شوند اما هر دو به B1 وابسته‌اند.

`CONTEXT_FILES: ["supabase/functions/vectorize/index.ts", "supabase/functions/_shared/gemini-client.ts"]`

---

## نقشه وابستگی فاز D
B1 (_shared modules + EMBEDDING_MODEL)
├──→ B2 (lib modules — import از _shared)
│       └──→ B3 (index.ts orchestrator — import از _shared و lib)
└──→ B4 (vectorize fix — import از _shared)
B3 و B4 می‌توانند موازی اجرا شوند.

> **نکته تحویل:** پس از اجرای B4، تمام embeddingهای موجود در DB باید مجدداً تولید شوند چون مدل قبلی (`gemini-embedding-2-preview`) بردارهای ناسازگار ذخیره کرده. این می‌تواند با یک اسکریپت یک‌بار‌مصرف که روی همه recordهای `tasks` و `notes` تریگر vectorize را trigger می‌کند انجام شود.