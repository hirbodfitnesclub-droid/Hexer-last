import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.28.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const systemPrompt = `تو یک کوچِ بهره‌وری صمیمی، پرانرژی و مشوق برای نسلِ زد هستی.
خلاصه بریفِ امروز کاربر را بر اساس فهرست کارهایی که برایش فرستاده می‌شود بنویس.
وظایف تو:
۱. احوالپرسی زمان‌محور صمیمی و انگیزشی (صبح/ظهر/عصر/شب).
۲. اشاره مختصر به تعداد کارهای امروز، اگر کار عقب‌افتاده دارد بگو، و مهم‌ترین کار امروز (با بالاترین اولویت یا اولین کار ساعت‌دار) را صمیمانه برجسته کن.
۳. بخش پایانی شامل یک پیشنهادِ عملی، خلاقانه و بسیار کوتاه برای شروع مقتدرانه روز باشد.
قوانین سخت‌گیرانه: لحن فوق‌العاده صمیمی و دوستانه، عاری از اصطلاحات سخت، بدون هیچ اموجی، و متنی کاملاً پیوسته و کمتر از ۸۰ کلمه فارسی باشد.`;

declare const Deno: any;

async function getAuthUser(authHeader: string | null) {
  if (!authHeader) throw new Error('Missing Authorization header');
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return { user, supabaseClient };
}

let openAIInstance: OpenAI | null = null;

function getGoogleGenAI(): OpenAI {
  if (!openAIInstance) {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY') ?? Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing both OPENROUTER_API_KEY and GEMINI_API_KEY environment variables");
    }
    openAIInstance = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });
  }
  return openAIInstance;
}

const getTehranDateString = (date?: Date): string => {
  const d = date || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d); // Returns YYYY-MM-DD
};

const getPersianDateAndDayName = (date?: Date) => {
  const d = date || new Date();
  const dayName = d.toLocaleDateString('fa-IR', { weekday: 'long', timeZone: 'Asia/Tehran' });
  const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
  return { dayName, persianDate };
};

const getTehranHourStrAndHourNum = () => {
  const d = new Date();
  const tehranHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: 'numeric',
      hour12: false
    }).format(d),
    10
  );
  const timeStr = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
  return { tehranHour, timeStr };
};

const hasSpecificTime = (dueDateStr: string): boolean => {
  if (!dueDateStr) return false;
  const dateObj = new Date(dueDateStr);
  const tehranTimeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(dateObj);
  return tehranTimeStr !== "12:00:00";
};

const getPriorityScore = (prio?: string): number => {
  const p = prio?.toLowerCase() || 'medium';
  if (p === 'high') return 3;
  if (p === 'medium') return 2;
  if (p === 'low') return 1;
  return 0;
};

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { user, supabaseClient } = await getAuthUser(authHeader);

    const body = await req.json().catch(() => ({}));
    const force = !!body.force;

    // ۱. زمان تهران و مقادیر شمسی
    const todayStr = getTehranDateString();
    const { dayName, persianDate } = getPersianDateAndDayName();
    const { tehranHour, timeStr } = getTehranHourStrAndHourNum();

    // ۲. واکشی تسک‌های فعال کاربر
    // واکشی تسک‌های امروز (شناسه‌ها، نام‌ها، اهمیت، محدوده سررسید و وضعیت - بدون امبدینگ‌ها جهت سبک‌سازی)
    const { data: allUnfinishedTasks, error: fetchError } = await supabaseClient
      .from('tasks')
      .select('id, title, priority, due_date, status')
      .neq('status', 'done');

    if (fetchError) {
      console.error("Fetch unfinished tasks failed:", fetchError);
      throw new Error(`Failed to fetch tasks: ${fetchError.message}`);
    }

    const unfinishedList = allUnfinishedTasks || [];

    // فیلتر کردن کارهای امروز و عقب‌افتاده
    const todayTasks: any[] = [];
    const overdueTasks: any[] = [];

    unfinishedList.forEach((t: any) => {
      if (t.due_date) {
        const taskDateStr = getTehranDateString(new Date(t.due_date));
        if (taskDateStr === todayStr) {
          todayTasks.push(t);
        } else if (taskDateStr < todayStr) {
          overdueTasks.push(t);
        }
      }
    });

    const overdueCount = overdueTasks.length;

    // مرتب‌سازی تسک‌های امروز: کارهای ساعت‌دار ابتدا، سپس اولویت بیشتر به کمتر
    const sortedTodayTasks = todayTasks.sort((a, b) => {
      const aTimed = hasSpecificTime(a.due_date);
      const bTimed = hasSpecificTime(b.due_date);

      if (aTimed && !bTimed) return -1;
      if (!aTimed && bTimed) return 1;

      if (aTimed && bTimed) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }

      return getPriorityScore(b.priority) - getPriorityScore(a.priority);
    });

    // سقف ۱۰ کارهای امروز
    const topTasks = sortedTodayTasks.slice(0, 10);

    // ۳. امضا تسک‌ها
    const todaySigLines = topTasks.map((t: any) => `${t.id}:${t.title}:${t.status}:${t.due_date}`);
    const signatureRaw = `${overdueCount}|` + todaySigLines.join('|');
    const tasksSignature = await sha256(signatureRaw);

    // ۴. ساخت کلاینت مدیریتی service_role جهت مدیریت کش‌ها بدون مانع RLS
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // بررسی وجود بریف از قبل برای امروز
    const { data: existingBrief, error: briefError } = await supabaseService
      .from('daily_briefs')
      .select('content, tasks_signature')
      .eq('user_id', user.id)
      .eq('brief_date', todayStr)
      .maybeSingle();

    if (briefError) {
      console.error("Error checking existing brief from DB:", briefError);
    }

    if (existingBrief) {
      if (!force) {
        if (existingBrief.tasks_signature === tasksSignature) {
          // امضا یکسان است، کش کامل برمی‌گردد
          return new Response(JSON.stringify({
            content: existingBrief.content,
            stale: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        } else {
          // امضا تفاوت دارد، اطلاع از کهنگی کارهای تولید شده
          return new Response(JSON.stringify({
            content: existingBrief.content,
            stale: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }
      }
    }

    // ۵. کسر اعتبار و سهمیه AI با RPC
    const { data: quotaResult, error: quotaError } = await supabaseClient.rpc('consume_ai_quota');
    if (quotaError) {
      console.error("Quota Check Error from RPC in daily-brief:", quotaError);
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

    // ۶. آماده‌سازی بدنه کوئری برای DeepSeek
    const modelName = 'deepseek/deepseek-v4-flash';
    const ai = getGoogleGenAI();

    let userMessage = `تاریخ امروز: ${persianDate} (${dayName})\n`;
    userMessage += `ساعت محلی فعلی کاربر: ${timeStr}\n`;
    userMessage += `تعداد کارهای عقب‌افتاده از دیروز و گذشته: ${overdueCount}\n`;
    userMessage += `کارهای امروز کاربر به ترتیب اهمیت:\n`;

    if (topTasks.length > 0) {
      topTasks.forEach((t: any, index: number) => {
        const hasTime = hasSpecificTime(t.due_date);
        const taskTime = hasTime
          ? new Date(t.due_date).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false })
          : 'بدون ساعت';
        const priorityStr = t.priority === 'high' ? 'ضروری' : t.priority === 'medium' ? 'متوسط' : 'عادی';
        userMessage += `${index + 1}. عنوان: "${t.title}" | اولویت: ${priorityStr} | زمان: ${taskTime}\n`;
      });
    } else {
      userMessage += `- هیچ کاری برای امروز زمان‌بندی نشده است.\n`;
    }

    // ۷. درخواست به OpenRouter / DeepSeek
    const response = await ai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 256
    });

    const generatedBrief = response.choices[0].message.content?.trim() || "";

    // ۸. ذخیره و بروزرسانی رکورد
    const { error: upsertError } = await supabaseService
      .from('daily_briefs')
      .upsert({
        user_id: user.id,
        brief_date: todayStr,
        content: generatedBrief,
        tasks_signature: tasksSignature,
        model: modelName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,brief_date'
      });

    if (upsertError) {
      console.error("Upsert daily brief in DB failed:", upsertError);
      throw upsertError;
    }

    return new Response(JSON.stringify({
      content: generatedBrief,
      stale: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Daily Brief Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.status || 500
    });
  }
});
