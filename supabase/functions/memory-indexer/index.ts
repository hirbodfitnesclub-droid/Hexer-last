import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, requireWorkerSecret, safeErrorResponse } from '../_shared/security.ts';
import { generateEmbedding, getGoogleGenAI, EMBEDDING_MODEL } from '../_shared/gemini-client.ts';
import {
  CHUNKER_VERSION,
  chunkText,
  contentHash,
  normalizePersian,
} from '../_shared/persian-text.ts';

declare const Deno: any;

/** md5 hex of the raw "title body" join, matching the enqueue trigger's hash. */
async function md5Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('MD5', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'null',
  'Access-Control-Allow-Headers': 'content-type, x-worker-secret',
};

const SOURCE_TABLES: Record<string, { table: string; titleField: string; bodyField: string; hasProject: boolean }> = {
  task: { table: 'tasks', titleField: 'title', bodyField: 'description', hasProject: true },
  note: { table: 'notes', titleField: 'title', bodyField: 'content', hasProject: true },
  // A project has no parent project, so selecting project_id would be a column error.
  project: { table: 'projects', titleField: 'title', bodyField: 'description', hasProject: false },
};

/**
 * Memory V2 indexing worker. Claims jobs, re-reads the source row, and writes a
 * document with its chunk embeddings only when the revision it embedded is still
 * current. It is inert until something enqueues jobs, which happens when memory_v2
 * is enabled.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    await requireWorkerSecret(req, 'VECTORIZE_WORKER_SECRET');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const leaseOwner = `memory-${crypto.randomUUID()}`;
    const { data: claimed, error: claimError } = await supabase.rpc('claim_memory_jobs', {
      p_lease_owner: leaseOwner,
      p_batch_size: 5,
      p_lease_seconds: 120,
    });
    if (claimError) throw new Error(`Claim failed: ${claimError.message}`);

    const jobs = Array.isArray(claimed) ? claimed : [];
    if (jobs.length === 0) return jsonResponse({ claimed: 0 }, 200, corsHeaders);

    const ai = getGoogleGenAI();
    let indexed = 0;
    let stale = 0;
    let deleted = 0;
    let failed = 0;
    let unchanged = 0;

    for (const job of jobs) {
      try {
        if (job.job_type === 'delete') {
          await supabase.rpc('delete_memory_document', {
            p_user_id: job.user_id,
            p_source_type: job.source_type,
            p_source_id: job.source_id,
          });
          await supabase.rpc('finalize_memory_job', { p_job_id: job.id, p_status: 'succeeded' });
          deleted += 1;
          continue;
        }

        const mapping = SOURCE_TABLES[job.source_type];
        if (!mapping) throw new Error(`Unsupported source type: ${job.source_type}`);

        const columns = [
          'id', 'user_id', 'version',
          ...(mapping.hasProject ? ['project_id'] : []),
          mapping.titleField, mapping.bodyField,
        ].join(',');

        // Re-read rather than trusting the payload: the row may have changed since
        // the trigger fired.
        const { data: row, error: rowError } = await supabase
          .from(mapping.table)
          .select(columns)
          .eq('id', job.source_id)
          .eq('user_id', job.user_id)
          .maybeSingle();
        if (rowError) throw new Error(`Source lookup failed: ${rowError.message}`);

        if (!row) {
          await supabase.rpc('delete_memory_document', {
            p_user_id: job.user_id,
            p_source_type: job.source_type,
            p_source_id: job.source_id,
          });
          await supabase.rpc('finalize_memory_job', { p_job_id: job.id, p_status: 'succeeded' });
          deleted += 1;
          continue;
        }

        const source = row as Record<string, unknown>;
        const currentVersion = typeof source.version === 'number' ? source.version : 1;

        // Stale detection is content-based: the enqueue trigger bumps only on
        // title/body changes but the row version moves on every edit, so a
        // version comparison would wrongly discard valid text edits. When the
        // hash matches, the text is unchanged and re-embedding is a no-op.
        const rawJoined = `${source[mapping.titleField] ?? ''} ${source[mapping.bodyField] ?? ''}`;
        if (job.content_hash !== null && job.content_hash !== undefined) {
          if ((await md5Hex(rawJoined)) === job.content_hash) {
            await supabase.rpc('finalize_memory_job', { p_job_id: job.id, p_status: 'succeeded' });
            unchanged += 1;
            continue;
          }
        } else if (job.source_version !== null && currentVersion > job.source_version) {
          // Legacy job without a content hash; keep the conservative version check.
          await supabase.rpc('finalize_memory_job', { p_job_id: job.id, p_status: 'stale' });
          stale += 1;
          continue;
        }

        const title = normalizePersian(source[mapping.titleField]);
        const combined = `${source[mapping.titleField] ?? ''}\n${source[mapping.bodyField] ?? ''}`;
        const normalizedText = normalizePersian(combined);
        if (!normalizedText) {
          await supabase.rpc('delete_memory_document', {
            p_user_id: job.user_id,
            p_source_type: job.source_type,
            p_source_id: job.source_id,
          });
          await supabase.rpc('finalize_memory_job', { p_job_id: job.id, p_status: 'succeeded' });
          deleted += 1;
          continue;
        }

        const hash = await contentHash(combined);
        const chunks = chunkText(combined);
        const embedded = [];
        for (const chunk of chunks) {
          const embedding = await generateEmbedding(ai, chunk.content, 'document');
          embedded.push({
            ordinal: chunk.ordinal,
            content: chunk.content,
            contentHash: await contentHash(chunk.content),
            spanStart: chunk.spanStart,
            spanEnd: chunk.spanEnd,
            tokenEstimate: chunk.tokenEstimate,
            embedding: `[${embedding.join(',')}]`,
          });
        }

        const { data: result, error: upsertError } = await supabase.rpc('upsert_memory_document', {
          p_user_id: job.user_id,
          p_source_type: job.source_type,
          p_source_id: job.source_id,
          p_source_version: currentVersion,
          p_content_hash: hash,
          p_title: title,
          p_normalized_text: normalizedText,
          p_metadata: { project_id: mapping.hasProject ? source.project_id ?? null : null },
          p_embedding_model: EMBEDDING_MODEL,
          p_chunker_version: CHUNKER_VERSION,
          p_chunks: embedded,
        });
        if (upsertError) throw new Error(`Document upsert failed: ${upsertError.message}`);

        const status = (result as any)?.status === 'stale' ? 'stale' : 'succeeded';
        await supabase.rpc('finalize_memory_job', { p_job_id: job.id, p_status: status });
        if (status === 'stale') stale += 1; else indexed += 1;
      } catch (jobError: any) {
        console.error('Memory job failed:', job.id, jobError?.message);
        await supabase.rpc('finalize_memory_job', {
          p_job_id: job.id,
          p_status: 'failed',
          p_error_code: String(jobError?.message ?? 'unknown').slice(0, 200),
        });
        failed += 1;
      }
    }

    return jsonResponse({ claimed: jobs.length, indexed, stale, deleted, failed, unchanged }, 200, corsHeaders);
  } catch (error: any) {
    console.error('Memory indexer error:', error);
    return safeErrorResponse(error, corsHeaders);
  }
});
