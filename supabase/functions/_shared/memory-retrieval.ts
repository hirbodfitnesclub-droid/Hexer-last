import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEmbedding } from './gemini-client.ts';

export interface MemoryHit {
  id: string;
  type: string;
  title: string | null;
  snippet: string;
  score: number;
  updated_at?: string;
  created_at?: string;
}

export interface SearchFilters {
  types?: Array<'task' | 'note' | 'project'>;
  timeRange?: 'all' | 'today' | 'last_week';
}

export interface RetrievalOutcome {
  hits: MemoryHit[];
  engine: 'memory_v2' | 'legacy';
}

/**
 * Runs the legacy hybrid_search (per-entity embedding columns + tsvector) and
 * normalizes its rows into MemoryHit.
 */
async function runLegacySearch(
  userClient: SupabaseClient,
  ai: any,
  message: string,
  matchCount: number
): Promise<MemoryHit[]> {
  const embedding = await generateEmbedding(ai, message, 'query');
  const { data, error } = await userClient.rpc('hybrid_search', {
    p_query_embedding: embedding,
    p_query_text: message,
    p_match_count: matchCount,
  });
  if (error) throw new Error(`hybrid_search RPC error: ${error.message}`);
  return (data || []).map((doc: any) => ({
    id: doc.id,
    type: doc.type,
    title: doc.title ?? null,
    snippet: doc.snippet || doc.content || '',
    score: doc.score,
    updated_at: doc.updated_at,
    created_at: doc.created_at,
  }));
}

/**
 * Runs search_memory_v2 over the chunk store. Scoped strictly to the caller's
 * user id; the RPC is service_role only, so the user id comes from the
 * authenticated request, never from the payload.
 */
async function runMemoryV2Search(
  serviceClient: SupabaseClient,
  userId: string,
  ai: any,
  message: string,
  filters: SearchFilters | undefined,
  matchCount: number
): Promise<MemoryHit[]> {
  const embedding = await generateEmbedding(ai, message, 'query');
  const cutoff = filters?.timeRange === 'today'
    ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    : filters?.timeRange === 'last_week'
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { data, error } = await serviceClient.rpc('search_memory_v2', {
    p_user_id: userId,
    p_query_embedding: embedding,
    p_query_text: message,
    p_source_types: filters?.types?.length ? filters.types : null,
    p_updated_after: cutoff,
    p_match_count: matchCount,
  });
  if (error) throw new Error(`search_memory_v2 RPC error: ${error.message}`);
  return (data || []).map((row: any) => ({
    id: row.source_id,
    type: row.source_type,
    title: row.title ?? null,
    snippet: row.content || '',
    score: row.fusion_score,
    updated_at: row.updated_at,
  }));
}

export { runLegacySearch, runMemoryV2Search };

/**
 * Single entry point for memory retrieval. Chooses the engine from the
 * memory_v2 feature flag (per-user), falling back to legacy on any memory v2
 * failure so retrieval never hard-fails while the new pipeline is settling.
 */
export async function searchUserMemory(input: {
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
  userId: string;
  ai: any;
  message: string;
  filters?: SearchFilters;
  matchCount?: number;
}): Promise<RetrievalOutcome> {
  const matchCount = input.matchCount ?? 15;
  try {
    const { data: flagData } = await input.serviceClient
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'memory_v2')
      .maybeSingle();

    if (flagData?.enabled) {
      try {
        const hits = await runMemoryV2Search(
          input.serviceClient, input.userId, input.ai, input.message, input.filters, matchCount
        );
        if (hits.length > 0) return { hits, engine: 'memory_v2' };
      } catch (v2Error: any) {
        console.error('memory_v2 search failed, falling back to legacy:', v2Error?.message);
      }
    }
  } catch (flagError: any) {
    console.error('memory_v2 flag check failed, using legacy search:', flagError?.message);
  }

  const hits = await runLegacySearch(input.userClient, input.ai, input.message, matchCount);
  return { hits, engine: 'legacy' };
}
