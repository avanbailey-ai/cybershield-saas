/**
 * Shared scan batch handler for cron workers.
 * Reclaims stale locks, atomically claims pending jobs, runs bounded batch.
 */

import { getScanBatchLimit } from '@/lib/queue/constants';
import { runScanWorker } from './processQueue';

export interface ScanBatchResponse {
  processed: number;
  failed: number;
  skipped: number;
  reclaimed: number;
  durationMs: number;
  /** Legacy field — jobs that completed successfully (excludes skipped). */
  succeeded?: number;
  ok?: boolean;
}

export async function handleScanBatch(): Promise<ScanBatchResponse> {
  const started = Date.now();
  const batchLimit = getScanBatchLimit();
  const result = await runScanWorker(batchLimit);

  return {
    processed: result.processed,
    failed: result.failed,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
    durationMs: Date.now() - started,
    succeeded: result.succeeded,
    ok: true,
  };
}
