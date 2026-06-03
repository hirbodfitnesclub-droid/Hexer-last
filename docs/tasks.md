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




> وابستگی: R11 → R12 → R13 → R14 (متوالی)

---

## فاز D — رفع باگ‌های بنیادی UI/CSS

### تسک R11: Global CSS Foundation (index.css)

**راهنمای پیاده‌سازی فنی:**

فایل `index.css` باید آپدیت (یا ساخته) شود تا موارد زیر را cover کند:

۱. **Autofill Override:** مرورگرها روی فیلدهای autofill رنگ سفید/آبی اعمال می‌کنند که با تم تیره ما تضاد دارد. باید با `-webkit-autofill` selector این را override کنیم:
```css
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
select:-webkit-autofill {
  -webkit-box-shadow: 0 0 0px 1000px #09090b inset !important;
  -webkit-text-fill-color: #ffffff !important;
  caret-color: #ffffff;
  transition: background-color 5000s ease-in-out 0s;
}
```

۲. **Safe Area Variables:**
```css
* { box-sizing: border-box; }
:root {
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-top: env(safe-area-inset-top, 0px);
}
```

۳. **iOS Smooth Scroll Fix:** برای اسکرول روان داخل مودال‌ها:
```css
.overflow-y-auto {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

۴. **Prevent text size adjustment (iOS):**
```css
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

**محدودیت‌ها:** فقط `index.css` لمس می‌شود؛ هیچ component تغییر نمی‌کند.

`CONTEXT_FILES: ["index.html"]`

---

### تسک R12: Systematic Tailwind Class Audit — جایگزینی سراسری کلاس‌های نامعتبر

**راهنمای پیاده‌سازی فنی:**

این تسک یک **search-and-replace سیستماتیک** در تمام فایل‌های زیر است. هر جایگزینی با توضیح منطق آن:

**نقشه جایگزینی (Replacement Map):**

| نامعتبر | معتبر |
|---------|-------|
| `bg-zinc-855` | `bg-zinc-900` |
| `bg-zinc-850` | `bg-zinc-900` |
| `bg-zinc-750` | `bg-zinc-800` |
| `border-zinc-850` | `border-zinc-800` |
| `border-zinc-855` | `border-zinc-800` |
| `text-zinc-350` | `text-zinc-300` |
| `text-zinc-450` | `text-zinc-400` |
| `text-zinc-550` | `text-zinc-500` |
| `text-zinc-650` | `text-zinc-600` |
| `text-zinc-750` | `text-zinc-700` |
| `text-zinc-850` | `text-zinc-800` |
| `hover:bg-zinc-750` | `hover:bg-zinc-800` |
| `hover:bg-zinc-850` | `hover:bg-zinc-900` |
| `bg-neutral-850` | `bg-neutral-900` |
| `border-neutral-850` | `border-neutral-800` |
| `hover:bg-neutral-850` | `hover:bg-neutral-900` |
| `text-neutral-350` | `text-neutral-300` |
| `text-neutral-850` | `text-neutral-800` |
| `bg-red-650` | `bg-red-600` |
| `hover:bg-red-650` | `hover:bg-red-600` |
| `from-purple-650` | `from-purple-600` |
| `bg-purple-650` | `bg-purple-600` |
| `text-sky-450` | `text-sky-400` |
| `z-15` | `z-10` |
| `z-45` | `z-40` |

**علاوه بر این، در `features/billing/components/RenewReminderModal.tsx`:**
- `bg-red-650` → `bg-red-600`
- `hover:bg-red-550` → `hover:bg-red-500`
- `bg-red-550` → `bg-red-500`

**فایل‌هایی که باید آپدیت شوند:**
1. `features/tasks/components/TaskEditorModal.tsx`
2. `features/habits/components/HabitEditorModal.tsx`
3. `features/notes/components/NoteCard.tsx`
4. `features/notes/components/NoteEditorModal.tsx`
5. `features/billing/components/UsageMeter.tsx`
6. `features/billing/components/RenewReminderModal.tsx`
7. `features/billing/pages/SubscriptionPage.tsx`
8. `components/PaywallModal.tsx`
9. `components/ProfileModal.tsx`
10. `features/tasks/TasksView.tsx` (فقط `z-15` → `z-10`)
11. `features/projects/components/ProjectDetailsModal.tsx` (فقط `z-45` → `z-40`)

**محدودیت‌ها:** فقط class name replacement — هیچ منطق، ساختار یا JSX تغییر نمی‌کند. باید مطمئن شویم هیچ جایگزینی ظاهر visual را به شکل ناخواسته تغییر ندهد (رنگ‌های جایگزین باید به 900/800/400 نزدیک باشند نه دور).

`CONTEXT_FILES: ["features/tasks/components/TaskEditorModal.tsx", "features/habits/components/HabitEditorModal.tsx", "features/notes/components/NoteCard.tsx", "features/notes/components/NoteEditorModal.tsx", "features/billing/components/UsageMeter.tsx", "features/billing/components/RenewReminderModal.tsx", "features/billing/pages/SubscriptionPage.tsx", "components/PaywallModal.tsx", "components/ProfileModal.tsx", "features/tasks/TasksView.tsx", "features/projects/components/ProjectDetailsModal.tsx"]`

---

### تسک R13: Modal Architecture Fix — Z-index + Dir Attribute + Min-H-0 + Page Import

**راهنمای پیاده‌سازی فنی:**

این تسک چهار اصلاح معماری مجزا را در فایل‌های مودال انجام می‌دهد:

**۱. رفع ایمپورت `Page` در ChatView (🔴 بحرانی):**

در `features/chat/ChatView.tsx`، خط ایمپورت types باید آپدیت شود:
```typescript
// قبل:
import { ChatMessage, ChatMode, Citation, Task, Note, ActionResult, Project, ChatSession, ExtractionProposal } from '../../types';
// بعد:
import { ChatMessage, ChatMode, Citation, Task, Note, ActionResult, Project, ChatSession, ExtractionProposal, Page } from '../../types';
```

**۲. رفع `dir-rtl` (کلاس ساختگی):**

در تمام فایل‌های زیر، `className="... dir-rtl ..."` باید تبدیل شود. این کلاس هیچ اثری ندارد:
- هرجا `dir-rtl` به صورت CSS class نوشته شده → باید به عنوان HTML attribute روی element ظاهر شود: `dir="rtl"`
- مثال: `<div className="flex flex-col dir-rtl">` → `<div className="flex flex-col" dir="rtl">`

فایل‌های affected:
- `features/tasks/components/TaskEditorModal.tsx`
- `features/habits/components/HabitEditorModal.tsx`
- `features/projects/components/ProjectDetailsModal.tsx`
- هر فایل دیگری که `dir-rtl` را به عنوان className داشته باشد

**۳. افزودن `min-h-0` به content area در مودال‌ها:**

در ساختار مودال، div اسکرول‌پذیر باید `min-h-0` داشته باشد:
```jsx
// قبل:


// بعد:

```

این تغییر در فایل‌های زیر اعمال می‌شود:
- `features/tasks/components/TaskEditorModal.tsx`
- `features/habits/components/HabitEditorModal.tsx`
- `features/notes/components/NoteEditorModal.tsx`
- `features/projects/components/ProjectDetailsModal.tsx`

**۴. تنظیم سلسله مراتب Z-Index طبق جدول §۷.۲:**

| فایل | z-index فعلی | z-index صحیح |
|------|-------------|-------------|
| `features/tasks/components/TaskEditorModal.tsx` | `z-50` | `z-[60]` |
| `features/habits/components/HabitEditorModal.tsx` | `z-50` | `z-[60]` |
| `features/notes/components/NoteEditorModal.tsx` | `z-[60]` | ✅ صحیح است |
| `features/projects/components/ProjectDetailsModal.tsx` | `z-45` (invalid) | `z-[70]` |
| `features/chat/components/ChatHistoryDrawer.tsx` | `z-50` | `z-[60]` |

**محدودیت‌ها:** هیچ منطق یا ساختار JSX تغییر نمی‌کند؛ فقط class attribute ها آپدیت می‌شوند. وابسته به R12 (چون برخی فایل‌ها مشترک هستند).

`CONTEXT_FILES: ["features/chat/ChatView.tsx", "features/tasks/components/TaskEditorModal.tsx", "features/habits/components/HabitEditorModal.tsx", "features/notes/components/NoteEditorModal.tsx", "features/projects/components/ProjectDetailsModal.tsx", "features/chat/components/ChatHistoryDrawer.tsx", "types.ts"]`

---

### تسک R14: Mobile-Only Polish — ProjectsView و Bottom Nav Safety

**راهنمای پیاده‌سازی فنی:**

**۱. حذف Breakpoint‌های Desktop از ProjectsView:**

در `features/projects/ProjectsView.tsx`، گرید به mobile-only تبدیل می‌شود:
```jsx
// قبل (desktop + mobile):


// بعد (mobile-only):

```

**۲. اصلاح مودال inline پروژه برای موبایل:**

مودال ویرایش پروژه درون `ProjectsView.tsx` باید با الگوی استاندارد §۷.۳ همخوانی داشته باشد:
- `h-[100dvh]` روی modal sheet
- Header و Footer با `shrink-0`
- Content با `flex-1 overflow-y-auto min-h-0`
- حذف هر `overflow-hidden` از root container (چون باعث clip محتوا می‌شود)

**۳. بررسی `pb-24` در صفحات اسکرول‌دار:**

تمام صفحات (نه مودال‌ها) باید `pb-24` داشته باشند تا محتوا زیر Bottom Nav مخفی نشود:
- `features/tasks/TasksView.tsx`: دارد ✅ (`pb-32`)
- `features/notes/NotesView.tsx`: دارد ✅ (`pb-32`)
- `features/projects/ProjectsView.tsx`: دارد ✅ (`pb-32`)
- `features/billing/pages/SubscriptionPage.tsx`: بررسی شود

**۴. اصلاح فاصله‌های گوشه و padding در ProjectCard:**

در `features/projects/components/ProjectCard.tsx`، فاصله‌ها باید مینیمال‌تر شوند:
- padding داخلی card: `p-5` → `p-4`
- gap بین card ها در گرید: `gap-6` → `gap-4`

این تغییر برای صفحات موبایل کوچک‌تر فضای بهتری ایجاد می‌کند.

**محدودیت‌ها:** فقط `features/projects/` لمس می‌شود؛ هیچ منطق داده‌ای تغییر نمی‌کند.

`CONTEXT_FILES: ["features/projects/ProjectsView.tsx", "features/projects/components/ProjectCard.tsx", "features/projects/components/ProjectDetailsModal.tsx", "features/billing/pages/SubscriptionPage.tsx"]`

---

## نقشه وابستگی (فاز D)
R11 (index.css) → R12 (invalid classes) → R13 (modal arch) → R14 (projects mobile)
↓                     ↓                      ↓
autofill fix         visual repair         structural fix

> R11 و R12 مستقل‌ترین هستند و می‌توانند با یک session اجرا شوند.  
> R13 وابسته به R12 است چون برخی فایل‌ها مشترکند.  
> R14 کاملاً ایزوله است.

---

## فاز E — پرداخت «کارت به کارت + رسید» (سهم کلاینت Hexer AI)

> مرجع معماری: `ARCHITECTURE.md §۸`. تسک‌های ادمین در `docs_of_manager_panel/tasks.md` (TASK 5–6).
> ترتیب اجبارا متوالی: C1 → C2 → C3 → C4 → C5. تسک‌هایی که روی فایل‌های یکسان می‌نویسند موازی نشده‌اند.

---

### تسک C1 — Migration دیتابیس و Storage (پایه‌ی مشترک)

**راهنمای پیاده‌سازی فنی:**
فایل جدید `supabase/sql/28_card_to_card_system.sql` بساز (Idempotent، اجرای دستی توسط مالک):
1. `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS offline_receipt_url TEXT;` و `... manual_decline_reason TEXT;`
2. باکت خصوصی: `INSERT INTO storage.buckets (id, name, public) VALUES ('receipts','receipts',false) ON CONFLICT (id) DO NOTHING;` (RLS سراسری `storage.objects` از قبل own-folder را پوشش می‌دهد؛ policy جدید لازم نیست).
3. RPC `preview_discount(p_plan_code text, p_code text)` — فقط خواندنی؛ خروجی `(valid bool, reason text, plan_price bigint, discount_amount bigint, final_amount bigint, is_full_discount bool)`. منطق محاسبه‌ی تخفیف **عیناً** مثل `zibal-request` (درصدی/مبلغی، cap روی قیمت پلن).
4. RPC `submit_manual_payment(p_plan_code text, p_code text, p_receipt_path text) RETURNS uuid` — طبق `ARCHITECTURE.md §۸.۳`: گارد یک `pending_manual` باز، خواندن قیمت پلن، رزرو کوپن با `FOR UPDATE` و `used_count++`، خطا اگر `final_amount=0`، درج ردیف با `status='pending_manual'`, `gateway='card_to_card'`, `user_id=auth.uid()`.
5. RPC `activate_manual_subscription(p_payment_id uuid) RETURNS boolean` — اعتبار `pending_manual`؛ `paid`+upsert subscription+ریست usage؛ **بدون لمس کوپن**.
6. RPC `reject_manual_payment(p_payment_id uuid, p_reason text) RETURNS boolean` — `failed`+`manual_decline_reason`؛ رول‌بک `used_count = greatest(0, used_count-1)` اگر کوپن داشت.
7. انتها: `NOTIFY pgrst, 'reload schema';`

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط فایل `28_...` جدید. ✅ همه چیز Idempotent (`IF NOT EXISTS`/`create or replace`). ✅ پول `bigint` ریالی.
- ❌ هیچ فایل SQL موجود ویرایش نشود. ❌ `activate_subscription` و `زیبال` دست نخورند. ❌ RLS جداول تغییر نکند. ❌ INSERT/UPDATE policy کلاینت روی `payments` اضافه نشود (RPC کافی است).

CONTEXT_FILES: ["supabase/sql/04_payments.sql", "supabase/sql/23_add_discount_system.sql", "supabase/sql/02_billing.sql", "supabase/sql/11_storage.sql"]

---

### تسک C2 — تایپ‌ها و لایه‌ی سرویس کلاینت

**راهنمای پیاده‌سازی فنی:**
1. `types.ts`: افزودن `'pending_manual'` به اتحاد وضعیت در صورت نیاز نمایش؛ افزودن تایپ `ManualPaymentState = { state: 'none' | 'pending' | 'rejected'; reason?: string }`.
2. `services/billingService.ts`:
   - `startCheckout(planCode, discountCode?)`: آرگومان اختیاری اضافه شود و در `body` به `zibal-request` پاس داده شود (`{ plan_code, discount_code }`).
   - `previewDiscount(planCode, code)` → `supabase.rpc('preview_discount', { p_plan_code, p_code })`.
   - `submitManualPayment(planCode, code, file)`: گارد >۲MB، فشرده‌سازی <۵۰۰KB با حلقه روی `compressImage`، `dataURLtoBlob`، آپلود به `receipts/{uid}/{uuid}.jpg`، سپس `supabase.rpc('submit_manual_payment', {...})`.
   - `getManualPaymentState()`: آخرین ردیف `gateway='card_to_card'` کاربر را بخواند و `ManualPaymentState` برگرداند.

**محدودیت‌های اختصاصی تسک:**
- ✅ بازاستفاده از `utils/imageUtils.ts` (نساختن فشرده‌ساز جدید). ✅ همه‌ی نوشتن‌ها از RPC.
- ❌ نوشتن مستقیم در `payments`. ❌ تغییر/رزرو کوپن سمت کلاینت. ❌ تغییر UI در این تسک.

CONTEXT_FILES: ["types.ts", "services/billingService.ts", "services/supabaseClient.ts", "utils/imageUtils.ts", "supabase/functions/zibal-request/index.ts"]

---

### تسک C3 — انتقال ورود اشتراک به مودال پروفایل + نمای وضعیت

**راهنمای پیاده‌سازی فنی:**
1. `SubscriptionModal.tsx` جدید در `features/billing/components/`: نمای وضعیت فعلی (پلن/انقضا یا «در انتظار تایید» یا بنر «رد + علت» از `getManualPaymentState`)، سپس لیست پلن‌ها با دکمه‌ی «تمدید» (اشتراک active) یا «خرید». در وضعیت `pending` دکمه‌ها قفل.
2. `ProfileModal.tsx`: دکمه‌ی badge پلن، به‌جای trigger مستقیم Paywall، `SubscriptionModal` را باز کند.
3. هندل state machine نمایش طبق `ARCHITECTURE.md §۸.۵`.

**محدودیت‌های اختصاصی تسک:**
- ✅ رعایت الگوی مودال موبایل §۷.۳ و z-index §۷.۲. ✅ RTL با `dir="rtl"`.
- ❌ منطق پرداخت/کوپن اینجا پیاده نشود (مال C4/C2 است). ❌ کلاس Tailwind نامعتبر.

CONTEXT_FILES: ["components/ProfileModal.tsx", "features/billing/pages/SubscriptionPage.tsx", "services/billingService.ts", "types.ts"]

---

### تسک C4 — مودال انتخاب شیوه پرداخت + کد تخفیف + بای‌پَس ۱۰۰٪

**راهنمای پیاده‌سازی فنی:**
1. `PaymentMethodModal.tsx` جدید: فیلد کد تخفیف → `previewDiscount`. اگر `is_full_discount` → تنها دکمه‌ی «فعال‌سازی رایگان» (`startCheckout(plan, code)` → bypass). در غیر این صورت دو دکمه: «پرداخت آنلاین زیبال» (`startCheckout(plan, code)`) و «کارت به کارت».
2. اتصال از `SubscriptionModal` (انتخاب پلن → باز شدن این مودال).

**محدودیت‌های اختصاصی تسک:**
- ✅ نمایش مبلغ نهایی پس از تخفیف از خروجی `preview_discount`. ✅ پیام خطای فارسی برای کد نامعتبر.
- ❌ محاسبه‌ی نهایی تخفیف سمت کلاینت معتبر تلقی نشود (سرور مرجع است).

CONTEXT_FILES: ["features/billing/components/SubscriptionModal.tsx", "services/billingService.ts", "components/PaywallModal.tsx"]

---

### تسک C5 — مودال آپلود رسید + قفل «در انتظار تایید» + بنر رد

**راهنمای پیاده‌سازی فنی:**
1. `ReceiptUploadModal.tsx` جدید: اطلاعات کارت مقصد، فایل‌پیکر `accept="image/*"`، گارد ۲MB، پیش‌نمایش، دکمه‌ی ثبت → `submitManualPayment`. روی موفقیت → بستن و رفتن به وضعیت `pending`.
2. در `SubscriptionModal`: وضعیت `pending` → فقط پیام «در انتظار تایید» بدون هیچ دکمه (نه لغو، نه خرید). وضعیت `rejected` → بنر قرمز با علت + باز شدن مجدد خرید.

**محدودیت‌های اختصاصی تسک:**
- ✅ فشرده‌سازی پیش از آپلود (از سرویس C2). ✅ مدیریت خطای آپلود با پیام فارسی.
- ❌ دکمه‌ی لغو/انصراف در وضعیت `pending` ساخته نشود (طبق محصول). ❌ آپلود فایل غیرتصویری یا >۲MB.

CONTEXT_FILES: ["features/billing/components/PaymentMethodModal.tsx", "features/billing/components/SubscriptionModal.tsx", "services/billingService.ts", "utils/imageUtils.ts"]

---

## نقشه وابستگی (فاز E)
C1 (DB/Storage) → C2 (types+service) → C3 (relocation+status) → C4 (payment method+discount) → C5 (receipt+lock+banner)

> C1 پیش‌نیاز همه است (RPCها). C2 پیش‌نیاز C3/C4/C5 است (سرویس). C3→C4→C5 به‌خاطر اشتراک فایل `SubscriptionModal` متوالی‌اند.
