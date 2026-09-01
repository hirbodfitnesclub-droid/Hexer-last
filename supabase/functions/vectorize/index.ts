import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGoogleGenAI, generateEmbedding } from '../_shared/gemini-client.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, requireWorkerSecret, safeErrorResponse } from '../_shared/security.ts';

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    await requireWorkerSecret(req, 'VECTORIZE_WORKER_SECRET');
    const payload = await req.json();
    const { type, id } = payload;
    const validTypes = new Set(['task', 'note', 'project']);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!validTypes.has(type) || typeof id !== 'string' || !uuidPattern.test(id)) {
      return jsonResponse({ error: 'Invalid vectorization payload' }, 400, corsHeaders);
    }

    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SERVICE_ROLE_KEY) throw new Error("Missing privileged Supabase key");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      SERVICE_ROLE_KEY
    );

    const table = type === 'task' ? 'tasks' : type === 'note' ? 'notes' : 'projects';

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
    } else if (type === 'note') {
      const title = record.title || '';
      const content = record.content || '';
      const tags = Array.isArray(record.tags) ? record.tags.join(' ') : '';
      combinedText = `${title} ${content} ${tags}`.trim();
    } else if (type === 'project') {
      const title = record.title || '';
      const description = record.description || '';
      const tags = Array.isArray(record.tags) ? record.tags.join(' ') : '';
      combinedText = `${title} ${description} ${tags}`.trim();
    }

    if (!combinedText) {
      return new Response(JSON.stringify({ message: "Constructed content is empty, skipping vectorization" }), { status: 200, headers: corsHeaders });
    }

    // اجرای امبدینگ هوشمند با متد مشترک و هماهنگِ کل سیستم
    const ai = getGoogleGenAI();
    console.log(`Generating embedding for ${type} ID: ${id} with consistent model...`);
    
    const embeddingValues = await generateEmbedding(ai, combinedText, 'document');
    if (embeddingValues.length !== 768 || embeddingValues.some((value) => !Number.isFinite(value))) {
      throw new Error('Embedding contract violation');
    }

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

  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders);
  }
});
