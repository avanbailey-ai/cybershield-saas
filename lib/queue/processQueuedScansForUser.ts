/**
 * Process pending scan jobs from authenticated user flows (not cron).
 * Must be awaited — fire-and-forget is killed on serverless.
 */

import { handleScanBatch, type ScanBatchResponse } from '@/lib/scanner/handleScanBatch';
import { getScanBatchLimit } from '@/lib/queue/constants';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/observability';

export type ProcessUserScanQueueOptions = {
  /** Max jobs to claim in this invocation (default 1 for single-site actions). */
  batchLimit?: number;
  /** Prefer claiming this job first (post-enqueue kick). */
  jobId?: string;
  /** Structured log context */
  source?: string;
  userId?: string;
  traceId?: string;
};

function clampBatchLimit(limit?: number): number {
  return Math.min(Math.max(1, limit ?? 1), getScanBatchLimit());
}

/** Normalize handleScanBatch output for logging and callers. */
function normalizeBatchResult(result: ScanBatchResponse): ScanBatchResponse {
  return {
    processed: result.processed ?? 0,
    failed: result.failed ?? 0,
    skipped: result.skipped ?? 0,
    reclaimed: result.reclaimed ?? 0,
    durationMs: result.durationMs ?? 0,
    queueDepth: result.queueDepth ?? 0,
    succeeded: result.succeeded,
    ok: result.ok ?? true,
  };
}

/**
 * Claim and run pending scan jobs. Safe to call from POST /api/websites, /api/scan, etc.
 */
export async function processQueuedScansForUser(
  options?: ProcessUserScanQueueOptions,
): Promise<ScanBatchResponse> {
  const batchLimit = clampBatchLimit(options?.batchLimit);
  const raw = await handleScanBatch(batchLimit, options?.jobId);
  return normalizeBatchResult(raw);
}

/**
 * Kick the scan worker after enqueue with structured observability.
 * Always attempts targeted claim for jobId when provided.
 */
export async function kickScanWorker(
  options?: ProcessUserScanQueueOptions,
): Promise<ScanBatchResponse> {
  const batchLimit = clampBatchLimit(options?.batchLimit);

  await logEvent({
    type: 'worker_kicked',
    layer: 'queue',
    userId: options?.userId ?? null,
    traceId: options?.traceId ?? null,
    metadata: {
      batchLimit,
      jobId: options?.jobId ?? null,
      source: options?.source ?? 'api',
    },
  });

  try {
    const result = await processQueuedScansForUser({
      batchLimit,
      jobId: options?.jobId,
    });

    if (options?.jobId) {
      const supabase = createAdminClient();
      const { data: row } = await supabase
        .from('scan_queue')
        .select('status')
        .eq('id', options.jobId)
        .maybeSingle();

      if (row?.status === 'pending') {
        console.warn(
          `[kickScanWorker] job still pending after kick jobId=${options.jobId} processed=${result.processed}`,
        );
      }
    }

    console.log(
      JSON.stringify({
        type: 'worker_kicked_complete',
        jobId: options?.jobId ?? null,
        processed: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        queueDepth: result.queueDepth,
        durationMs: result.durationMs,
        ts: new Date().toISOString(),
      }),
    );

    return result;
  } catch (err) {
    console.error('[kickScanWorker] failed', {
      jobId: options?.jobId,
      source: options?.source,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** @deprecated alias — prefer processQueuedScansForUser */
export const processQueuedScansForOrg = processQueuedScansForUser;
