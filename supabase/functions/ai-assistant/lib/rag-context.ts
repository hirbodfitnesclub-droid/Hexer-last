import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { searchUserMemory, type SearchFilters } from '../../_shared/memory-retrieval.ts';

export async function buildRagContext(
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
  userId: string,
  ai: any,
  message: string,
  filters?: SearchFilters
): Promise<{ contextString: string; citations: any[] }> {
  if (!message || !message.trim()) {
    return { contextString: '', citations: [] };
  }

  try {
    const { hits, engine } = await searchUserMemory({
      userClient,
      serviceClient,
      userId,
      ai,
      message,
      filters,
      matchCount: 15,
    });
    console.log(`RAG engine used: ${engine}, hits: ${hits.length}`);

    const requestedTypes = filters?.types?.length ? new Set(filters.types) : null;
    const cutoff = filters?.timeRange === 'today'
      ? Date.now() - 24 * 60 * 60 * 1000
      : filters?.timeRange === 'last_week'
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : null;
    // Server-side filters already applied for memory_v2; the client-side pass
    // keeps legacy results equally scoped.
    const filteredHits = hits.filter((hit) => {
      if (requestedTypes && !requestedTypes.has(hit.type as any)) return false;
      if (cutoff) {
        const timestamp = Date.parse(hit.updated_at || hit.created_at || '');
        if (Number.isFinite(timestamp) && timestamp < cutoff) return false;
      }
      return true;
    });

    if (filteredHits.length > 0) {
      const citations = filteredHits.slice(0, 5).map((hit) => ({
        id: hit.id,
        type: hit.type,
        title: hit.title || (hit.snippet ? (hit.snippet.split(' ').slice(0, 5).join(' ') + '...') : ''),
        snippet: hit.snippet,
        similarity: hit.score,
      }));

      let contextString = `\n\nRelevant Context from User Memory (${engine === 'memory_v2' ? 'Memory V2' : 'Hybrid Search'}):\n`;
      filteredHits.slice(0, 5).forEach((hit) => {
        contextString += `- [${hit.type.toUpperCase()}] ${hit.title} (Excerpt: ${hit.snippet}) (ID: ${hit.id})\n`;
      });

      return { contextString, citations };
    }

    return { contextString: '', citations: [] };
  } catch (error) {
    console.error('Embedding / RAG Error caught gracefully:', error);
    return { contextString: '', citations: [] };
  }
}
