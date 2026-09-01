import OpenAI from "npm:openai";
import { MODEL_KEYS, resolveModel } from './model-registry.ts';

declare const Deno: any;

export const EMBEDDING_MODEL = resolveModel(MODEL_KEYS.EMBEDDING).providerSlug;
export const EMBEDDING_DIMENSIONS = 768;

let openAIInstance: OpenAI | null = null;

export function getGoogleGenAI(): any {
  if (!openAIInstance) {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY') ?? Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Missing both OPENROUTER_API_KEY and GEMINI_API_KEY environment variables');
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
    // Keep the legacy Gemini task prefixes: every legacy vector in
    // tasks/notes/projects.embedding was built with them, and the memory_chunks
    // backfill re-embeds with the same format. Never change one side alone.
    processedText = "task: search_query | query: " + text;
  } else if (prefixType === 'document') {
    processedText = "task: search_document | document: " + text;
  }

  const client = (ai && typeof ai.embeddings?.create === 'function') ? ai : getGoogleGenAI();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: processedText,
    encoding_format: "float",
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const embedding = response?.data?.[0]?.embedding;
  if (Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS && embedding.every(Number.isFinite)) {
    return embedding;
  }

  // لاگ کردن کل رسپانس برای دیباگ ساختار اپنروتر
  console.error("OpenRouter Embedding Raw Response:", JSON.stringify(response));
  throw new Error("Failed to extract embedding values from OpenRouter response.");
}
