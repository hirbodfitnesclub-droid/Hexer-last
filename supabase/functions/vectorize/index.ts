
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'https://esm.sh/@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, id, content } = payload;
    
    if (!content || !id || !type) {
         console.error("Missing payload fields:", payload);
         return new Response(JSON.stringify({ message: "Invalid payload: content, id, or type missing" }), { status: 400, headers: corsHeaders });
    }

    const API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!API_KEY) throw new Error("Missing GEMINI_API_KEY");
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const contentString = String(content);
    if (!contentString.trim()) {
        return new Response(JSON.stringify({ message: "Content is empty, skipping vectorization" }), { status: 200, headers: corsHeaders });
    }

    // Use explicit structure to avoid parsing issues
    const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: [
            {
                parts: [{ text: contentString }]
            }
        ],
    });
    
    // Robust Extraction Logic: Check for both plural (embeddings) and singular (embedding)
    let embeddingValues = null;

    if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
        embeddingValues = response.embeddings[0].values;
    } else if (response.embedding && response.embedding.values) {
        embeddingValues = response.embedding.values;
    }

    if (!embeddingValues) {
        console.error("Gemini Response Dump:", JSON.stringify(response));
        throw new Error("Failed to generate embedding: No embedding values returned from Gemini (checked both singular and plural paths).");
    }

    // UPDATED: Use SUPABASE_SERVICE_ROLE_KEY matching the dashboard default
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      SERVICE_ROLE_KEY
    );

    const table = type === 'task' ? 'tasks' : 'notes';
    
    const { error } = await supabaseClient
        .from(table)
        .update({ embedding: embeddingValues })
        .eq('id', id);

    if (error) {
        throw new Error(`Supabase DB Error: ${error.message} (Hint: Check SERVICE_ROLE_KEY permissions)`);
    }

    return new Response(JSON.stringify({ message: "Vectorized successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
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
