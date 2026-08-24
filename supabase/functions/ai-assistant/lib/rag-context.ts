import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';
import { generateEmbedding } from '../../_shared/gemini-client.ts';

export async function buildRagContext(
  supabaseClient: SupabaseClient,
  ai: GoogleGenAI,
  message: string,
  filters?: {
    types?: Array<'task' | 'note' | 'project'>;
    timeRange?: 'all' | 'today' | 'last_week';
  }
): Promise<{ contextString: string; citations: any[] }> {
  if (!message || !message.trim()) {
    return { contextString: '', citations: [] };
  }

  try {
    const embedding = await generateEmbedding(ai, message, 'query');

    const { data: documents, error: matchError } = await supabaseClient.rpc('hybrid_search', {
      p_query_embedding: embedding,
      p_query_text: message,
      p_match_count: 15
    });

    if (matchError) {
      console.error("hybrid_search RPC error:", matchError);
      return { contextString: '', citations: [] };
    }

    let contextString = "";
    let citations: any[] = [];
    const requestedTypes = filters?.types?.length ? new Set(filters.types) : null;
    const cutoff = filters?.timeRange === 'today'
      ? Date.now() - 24 * 60 * 60 * 1000
      : filters?.timeRange === 'last_week'
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : null;
    const filteredDocuments = (documents || []).filter((doc: any) => {
      if (requestedTypes && !requestedTypes.has(doc.type)) return false;
      if (cutoff) {
        const timestamp = Date.parse(doc.updated_at || doc.created_at || '');
        if (!Number.isFinite(timestamp) || timestamp < cutoff) return false;
      }
      return true;
    });

    if (filteredDocuments.length > 0) {
      citations = filteredDocuments.slice(0, 5).map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title || (doc.snippet ? (doc.snippet.split(' ').slice(0, 5).join(' ') + '...') : ''),
        snippet: doc.snippet || doc.content || '',
        similarity: doc.score
      }));

      contextString += "\n\nRelevant Context from User Memory (Hybrid Search):\n";
      filteredDocuments.slice(0, 5).forEach((doc: any) => {
        contextString += `- [${doc.type.toUpperCase()}] ${doc.title} (Excerpt: ${doc.snippet}) (ID: ${doc.id})\n`;
      });
    }

    return { contextString, citations };
  } catch (error) {
    console.error("Embedding / Hybrid RAG Error caught gracefully:", error);
    return { contextString: '', citations: [] };
  }
}
