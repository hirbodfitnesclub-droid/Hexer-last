import OpenAI from "npm:openai";

declare const Deno: any;

export const EMBEDDING_MODEL = 'google/gemini-embedding-2';

let openAIInstance: OpenAI | null = null;

export function getGoogleGenAI(): any {
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

export async function generateEmbedding(ai: any, text: string, prefixType?: 'query' | 'document'): Promise<number[]> {
  let processedText = text;
  if (prefixType === 'query') {
    processedText = "task: search_query | query: " + text;
  } else if (prefixType === 'document') {
    processedText = "task: search_document | document: " + text;
  }

  const client = (ai && typeof ai.embeddings?.create === 'function') ? ai : getGoogleGenAI();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: processedText,
    encoding_format: "float",
  });

  if (response?.data?.[0]?.embedding) {
    return response.data[0].embedding;
  }

  // لاگ کردن کل رسپانس برای دیباگ ساختار اپنروتر
  console.error("OpenRouter Embedding Raw Response:", JSON.stringify(response));
  throw new Error("Failed to extract embedding values from OpenRouter response.");
}
