import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from 'https://esm.sh/@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;

const API_KEY = Deno.env.get('GEMINI_API_KEY');
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper to sanitize paths and check security boundaries (userId prefix)
function getCleanAndValidatedPath(rawPath: string, userId: string): string | null {
  if (!rawPath) return null;
  let cleanPath = rawPath;
  if (cleanPath.startsWith('chat-media/')) {
    cleanPath = cleanPath.substring('chat-media/'.length);
  }
  // Remove any leading slashes
  cleanPath = cleanPath.replace(/^\/+/, '');
  
  // RLS Guard: Must start with user.id/
  if (!cleanPath.startsWith(userId + '/')) {
    throw new Error('Forbidden: Access denied to media path');
  }
  return cleanPath;
}

// Helper to determine mimeType based on extension and downloaded media info
function getMimeType(path: string, blobMimeType?: string): string {
  if (blobMimeType && blobMimeType !== 'application/octet-stream') {
    return blobMimeType;
  }
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'webm': return 'audio/webm';
    case 'mp3': return 'audio/mp3';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'm4a': return 'audio/m4a';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

// Convert downloading Blob to Base64 (internal helper)
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const { message, history, mode, audioPath, imagePath } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // --- Quota GATEWAY (consume_ai_quota RPC) ---
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
        status: 402 // HTTP 402 Payment Required
      });
    }

    // Determine target Model dynamically
    const modelName = quota.model || 'gemini-2.5-flash-lite';
    console.log(`Using model ${modelName} for user ${user.id}`);

    let context = "";
    let citations: any[] = [];
    const isProposalMode = !!(audioPath || imagePath);

    // --- MODE 1: MEMORY (HYBRID RAG SEARCH) ---
    // Only run hybrid RAG if message exists and we are not in media extraction proposal mode
    if ((mode === 'memory' || mode === 'auto') && !isProposalMode && message) {
      try {
        const embedRes = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: message,
        });

        let embeddingValues = null;
        if (embedRes.embeddings && embedRes.embeddings.length > 0 && embedRes.embeddings[0].values) {
          embeddingValues = embedRes.embeddings[0].values;
        } else if (embedRes.embedding && embedRes.embedding.values) {
          embeddingValues = embedRes.embedding.values;
        }

        if (embeddingValues) {
          // CALL NEW HYBRID SEARCH RPC (Phase A - R2)
          const { data: documents, error: matchError } = await supabaseClient.rpc('hybrid_search', {
            p_query_embedding: embeddingValues,
            p_query_text: message,
            p_match_count: 5
          });

          if (matchError) {
            console.error("hybrid_search RPC error:", matchError);
          } else if (documents && documents.length > 0) {
            citations = documents.map((doc: any) => ({
              id: doc.id,
              type: doc.type,
              title: doc.title || (doc.snippet ? (doc.snippet.split(' ').slice(0, 5).join(' ') + '...') : ''),
              similarity: doc.score // mapping score for frontend display compatibility
            }));

            context += "\n\nRelevant Context from User Memory (Hybrid Search):\n";
            documents.forEach((doc: any) => {
              context += `- [${doc.type.toUpperCase()}] ${doc.title} (Excerpt: ${doc.snippet}) (ID: ${doc.id})\n`;
            });
          } else if (mode === 'memory') {
            context += "\n\nNo relevant memory found in database.";
          }
        }
      } catch (embedError) {
        console.error("Embedding / Hybrid RAG Error:", embedError);
      }
    }

    // --- MODE 2: ACTION (Context Injection) ---
    if ((mode === 'action' || mode === 'auto') && !isProposalMode) {
      const { data: projects } = await supabaseClient.from('projects').select('id, title');
      if (projects && projects.length > 0) {
        context += `\n\nAvailable Projects (use these UUID values for 'projectId' params): ${JSON.stringify(projects)}`;
      }
    }

    // Calculate Dates for Persian Relative Date Logic
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const dayName = today.toLocaleDateString('fa-IR', { weekday: 'long' });
    const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(today);

    // SYSTEM INSTRUCTION CUSTOMIZED FOR R3 CORE REQUIREMENTS
    const systemPrompt = `
    You are an intelligent Persian AI productivity assistant named "Hexer".
    Today's Gregorian Date: ${todayStr} (${dayName})
    Today's Persian Date: ${persianDate}

    **OPERATIONAL SCHEMA DETERMINATOR:**
    Is Extraction/Proposal Mode Active? Answer: ${isProposalMode ? "YES" : "NO"}

    **INSTRUCTIONS FOR EXTRACTION/PROPOSAL MODE (When Media is present):**
    1. **Transcribe/OCR First (CRITICAL):**
       - Audio path is provided: Listen carefully and transcribe the farsi speech EXACTLY word-for-word in the 'transcription' field.
       - Image path is provided: Do strict Persian visual OCR. Capture all readable written text and place it in the 'transcription' field. DO NOT translate terms. Do not summarize.
    2. **Structure Draft Proposals:**
       - Propose both tasks and notes extracted from the transcription details.
       - Place them in the "proposals" array parameter.
       - Absolutely DO NOT generate any "actions" representing database writes. Keep the "actions" array EMPTY.
       - Each proposal object must follow this syntax:
         {
           "kind": "task" | "note",
           "draft": {
             "title": "Clean farsi title",
             "description": "Farsi details",
             "dueDate": "YYYY-MM-DD" (Optional task due date),
             "priority": "low" | "medium" | "high",
             "tags": ["tag1", "tag2"],
             "content": "Full text content for note"
           },
           "confidence": 0.8 to 1.0 (float)
         }

    **INSTRUCTIONS FOR CHAT & ACTION MODE (Text Only):**
    1. Resolve user request into a sequence of backend database actions if needed.
    2. Supported Action types:
       - CREATE_TASK: title, description, dueDate, priority, projectId, tags
       - CREATE_NOTE: title, content, projectId, tags
       - CREATE_PROJECT: title, description, priority, color
       - CREATE_HABIT: name, description, frequency, target_count
       - SUGGEST_LINK: Use this when users request to link, bind, join, or find connections between tasks and notes.
         * Format: { "action": "SUGGEST_LINK", "params": { "queryText": "specific search query text matching relevant tasks/notes" } }
    3. Place these actions inside the "actions" array parameter. Keep the "proposals" array EMPTY.
    4. Translate relative dates (e.g. "فردا", "هفته بعد") precisely to YYYY-MM-DD using relative date calculations.

    **JSON OUTPUT CONTRACT:**
    You must always reply in a valid, parsable, standard JSON block with zero markdown wrappers. Use this dictionary key schema:
    {
      "transcription": "The transcription/OCR result or empty string",
      "reply": "Warm Farsi conversational answer summarizing accomplishments",
      "actions": [],
      "proposals": []
    }
    
    **CONTEXT INFORMATION:**
    ${context}
    `;

    const userMessageParts: any[] = [];
    if (message) userMessageParts.push({ text: message });

    // Download resources from private storage using Service Role client
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (audioPath) {
      const cleanPath = getCleanAndValidatedPath(audioPath, user.id);
      if (cleanPath) {
        console.log(`Downloading audio resource: ${cleanPath}`);
        const { data: fileBlob, error: downloadError } = await supabaseService.storage
          .from('chat-media')
          .download(cleanPath);

        if (downloadError || !fileBlob) {
          throw new Error(`Audio download failed: ${downloadError?.message || 'unknown error'}`);
        }

        const mimeType = getMimeType(cleanPath, fileBlob.type);
        const base64Data = await blobToBase64(fileBlob);

        userMessageParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
    }

    if (imagePath) {
      const cleanPath = getCleanAndValidatedPath(imagePath, user.id);
      if (cleanPath) {
        console.log(`Downloading image resource: ${cleanPath}`);
        const { data: fileBlob, error: downloadError } = await supabaseService.storage
          .from('chat-media')
          .download(cleanPath);

        if (downloadError || !fileBlob) {
          throw new Error(`Image download failed: ${downloadError?.message || 'unknown error'}`);
        }

        const mimeType = getMimeType(cleanPath, fileBlob.type);
        const base64Data = await blobToBase64(fileBlob);

        userMessageParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
    }

    // Safety Settings
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const modelHistory = history ? history.slice(-5).map((h: any) => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })) : [];

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
        maxOutputTokens: 8192,
        safetySettings: safetySettings
      }
    });

    const rawText = response.text;
    console.log("Raw Gemini Output:", rawText); 

    let aiResult;
    try {
        const cleanText = rawText?.replace(/```json\n?|\n?```/g, '').trim() || "{}";
        aiResult = JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error. Raw Text:", rawText);
        throw new Error("Failed to parse AI response. Invalid JSON format returned from model.");
    }

    const { actions, transcription, reply, proposals } = aiResult;
    const actionResults: any[] = [];

    // ZERO WRITE DB enforcement in proposal mode
    if (isProposalMode) {
        console.log("Zero write constraint: Skipping inline database writes.");
    } else if (actions && Array.isArray(actions)) {
        // Chat mode actions processor
        for (const item of actions) {
            const currentAction = item.action;
            const params = item.params || {};

            if (currentAction === 'CHAT') continue;

            try {
                let result = null;

                if (currentAction === 'CREATE_TASK') {
                    const taskTitle = params.title || "تسک جدید";
                    const { data, error } = await supabaseClient.rpc('create_task_with_tags', {
                        p_title: taskTitle,
                        p_description: params.description || null,
                        p_project_id: params.projectId || null,
                        p_due_date: params.dueDate || null,
                        p_priority: params.priority || 'medium',
                        p_tags: params.tags || []
                    });
                    if (error) throw error;
                    if (data && data.length > 0) {
                        result = { type: 'task', operation: 'create', data: data[0] };
                    }
                } 
                else if (currentAction === 'CREATE_NOTE') {
                    const finalContent = params.content || params.description || "";
                    const finalTitle = params.title || (finalContent.length > 20 ? finalContent.substring(0, 20) + "..." : finalContent) || "یادداشت جدید";
                    const { data, error } = await supabaseClient.rpc('create_note_with_tags', {
                        p_title: finalTitle,
                        p_content: finalContent || null,
                        p_project_id: params.projectId || null,
                        p_tags: params.tags || []
                    });
                    if (error) throw error;
                    if (data && data.length > 0) {
                        result = { type: 'note', operation: 'create', data: data[0] };
                    }
                }
                else if (currentAction === 'CREATE_PROJECT') {
                    const projTitle = params.title || "پروژه جدید";
                    const { data, error } = await supabaseClient.from('projects').insert({
                        user_id: user.id,
                        title: projTitle,
                        description: params.description || null,
                        color: params.color || 'sky',
                        priority: params.priority || 'medium'
                    }).select().single();
                    if (error) throw error;
                    if (data) result = { type: 'project', operation: 'create', data: data };
                }
                else if (currentAction === 'CREATE_HABIT') {
                    const habitName = params.name || params.title || "عادت جدید";
                    const { data, error } = await supabaseClient.from('habits').insert({
                        user_id: user.id,
                        name: habitName,
                        description: params.description || null,
                        frequency: params.frequency || 'daily',
                        target_count: params.target_count || 1
                    }).select().single();
                    if (error) throw error;
                    if (data) result = { type: 'habit', operation: 'create', data: data };
                }
                else if (currentAction === 'SUGGEST_LINK') {
                    // SMART LINKING LOGIC: query database via hybrid_search to suggest links
                    const queryText = params.queryText || params.query || message || "";
                    if (queryText) {
                        const embedResult = await ai.models.embedContent({
                            model: 'text-embedding-004',
                            contents: queryText,
                        });

                        let embedVal = null;
                        if (embedResult.embeddings && embedResult.embeddings.length > 0 && embedResult.embeddings[0].values) {
                            embedVal = embedResult.embeddings[0].values;
                        } else if (embedResult.embedding && embedResult.embedding.values) {
                            embedVal = embedResult.embedding.values;
                        }

                        if (embedVal) {
                            const { data: suggestions, error: searchError } = await supabaseClient.rpc('hybrid_search', {
                                p_query_embedding: embedVal,
                                p_query_text: queryText,
                                p_match_count: 5
                            });

                            if (!searchError && suggestions) {
                                suggestions.forEach((doc: any) => {
                                    actionResults.push({
                                        type: doc.type,
                                        operation: 'suggest_link',
                                        data: {
                                            id: doc.id,
                                            title: doc.title,
                                            snippet: doc.snippet,
                                            score: doc.score
                                        }
                                    });
                                });
                                console.log(`Generated ${suggestions.length} link suggestions via hybrid search.`);
                            } else if (searchError) {
                                console.error("Link suggest hybrid_search error:", searchError);
                            }
                        }
                    }
                }

                if (result) actionResults.push(result);
            } catch (actionError) {
                console.error(`Failed to execute action ${currentAction}:`, actionError);
            }
        }
    }

    return new Response(JSON.stringify({
        reply: reply || "انجام شد.",
        citations: citations,
        actionResults: actionResults,
        proposals: proposals || [],
        transcription: transcription || ""
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error: any) {
    console.error("AI Assistant Logic Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
