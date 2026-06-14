/**
 * queue.ts — Low-level queue primitives.
 *
 * Public API:
 *   - fetchPendingJobs()  — used by the queue worker (processQueue.ts)
 *   - QueueJob            — shared type
 *
 * NOTE: enqueueScan / enqueueAllWebsites have been superseded by
 * orchestrator.enqueueScan(). They are kept here as legacy shims that
 * delegate to the orchestrator so any remaining call-sites keep working,
 * but they should not be used in new code.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueScan as orchestratorEnqueue } from './orchestrator';

export interface QueueJob {
  id: string;
  user_id: string;
  website_id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  source: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

/**
 * Fetch the next N pending jobs — used only by the queue worker.
 * Jobs are returned in FIFO order (oldest first).
 */
export async function fetchPendingJobs(limit = 5): Promise<QueueJob[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('scan_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[Queue] fetchPendingJobs failed:', error);
    return [];
  }
  return (data ?? []) as QueueJob[];
}

// ---------------------------------------------------------------------------
// Legacy shims — delegate to orchestrator.enqueueScan()
// Do NOT use these in new code. Call orchestrator.enqueueScan() directly.
// ---------------------------------------------------------------------------

/** @deprecated Use orchestrator.enqueueScan() directly. */
export async function enqueueScan(
  websiteId: string,
  userId: string,
): Promise<{ success: boolean; jobId?: string; skipped?: boolean; skipReason?: string; error?: string }> {
  console.warn('[queue.enqueueScan] DEPRECATED — use orchestrator.enqueueScan() directly');
  const result = await orchestratorEnqueue({ userId, websiteId, source: 'manual' });
  if (result.queued) return { success: true, jobId: result.jobId };
  if (result.reason === 'too_recent' || result.reason === 'already_queued') {
    return { success: true, skipped: true, skipReason: result.reason };
  }
  return { success: false, error: result.error ?? result.reason };
}

/** @deprecated Use orchestrator.enqueueScan() directly for each website. */
export async function enqueueAllWebsites(
  userId: string,
): Promise<{ success: boolean; queued: number; skipped: number; error?: string }> {
  console.warn('[queue.enqueueAllWebsites] DEPRECATED — use orchestrator.enqueueScan() directly');
  const supabase = createAdminClient();
  const { data: websites, error: fetchErr } = await supabase
    .from('websites')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (fetchErr) return { success: false, queued: 0, skipped: 0, error: fetchErr.message };
  if (!websites || websites.length === 0) return { success: true, queued: 0, skipped: 0 };

  let queued = 0;
  let skipped = 0;
  for (const w of websites) {
    const r = await orchestratorEnqueue({ userId, websiteId: w.id, source: 'manual' });
    if (r.queued) queued++;
    else skipped++;
  }
  return { success: true, queued, skipped };
}
