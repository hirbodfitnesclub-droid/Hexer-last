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

function mergeConsecutiveRoles(messages: any[]) {
  if (!messages || messages.length === 0) return [];
  const merged: any[] = [];
  for (const item of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
      const prev = merged[merged.length - 1];
      if (typeof prev.content === 'string' && typeof item.content === 'string') {
        prev.content += "\n" + item.content;
      } else if (Array.isArray(prev.content) && Array.isArray(item.content)) {
        prev.content.push(...item.content);
      } else {
        prev.content = String(prev.content) + "\n" + String(item.content);
      }
    } else {
      merged.push({ role: item.role, content: item.content });
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

    // مپ کردن نام مدل به شناسه استاندارد OpenRouter
    // طبق دستورالعمل جدید، در حال حاضر تمام پلن‌ها از مدل اقتصادی و بهینه استفاده می‌کنند
    const modelName = "google/gemini-2.5-flash-lite";
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
    if (message) userMessageParts.push({ type: 'text', text: message });
 
    if (audioPath || imagePath) {
      const mediaParts = await downloadMediaParts(supabaseService, { audioPath, imagePath }, user.id);
      userMessageParts.push(...mediaParts);
    }
 
    const userContent = (audioPath || imagePath) ? userMessageParts : (message || '');
 
    // ۵. فرمت‌بندی تاریخچه تعاملی کاربر
    const modelHistoryRaw = history ? history.slice(-5).map((h: any) => ({
      role: h.sender === 'user' ? 'user' : 'assistant',
      content: h.text || ''
    })) : [];
 
    const modelHistory = mergeConsecutiveRoles(modelHistoryRaw);
 
    const messages = [
      { role: 'system', content: systemPrompt },
      ...modelHistory,
      { role: 'user', content: userContent }
    ];
 
    // ۶. استعلام پاسخ از مدل هوشمند با استاندارد OpenAI / OpenRouter
    const response = await ai.chat.completions.create({
      model: modelName,
      messages: messages,
      response_format: { type: "json_object" },
      temperature: 0.0,
    });
 
    const rawText = response.choices[0].message.content;
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
