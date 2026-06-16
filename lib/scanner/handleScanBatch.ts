/**

 * Shared scan batch handler for cron workers.

 * Reclaims stale locks, atomically claims pending jobs, runs bounded batch.

 */



import { getScanBatchLimit } from '@/lib/queue/constants';

import {
  getScanQueueDepth,
  recordScanWorkerMetrics,
} from '@/lib/observability/scanMetrics';
import { recordCronRunMetrics } from '@/lib/observability/systemHealth';
import { runScanWorker } from './processQueue';
import { recoverStuckScans } from './scanRecovery';



export interface ScanBatchResponse {

  processed: number;

  failed: number;

  skipped: number;

  reclaimed: number;

  durationMs: number;

  queueDepth: number;

  /** Legacy field — jobs that completed successfully (excludes skipped). */

  succeeded?: number;

  ok?: boolean;

}



export async function handleScanBatch(batchLimitOverride?: number): Promise<ScanBatchResponse> {

  const started = Date.now();

  const batchLimit =
    batchLimitOverride !== undefined
      ? Math.min(Math.max(1, batchLimitOverride), getScanBatchLimit())
      : getScanBatchLimit();



  let result;

  let queueDepth = 0;



  try {

    queueDepth = await getScanQueueDepth();

    const recovery = await recoverStuckScans();
    if (recovery.expired > 0 || recovery.reclaimed > 0) {
      console.log(
        `[handleScanBatch] recovery expired=${recovery.expired} reclaimed=${recovery.reclaimed}`,
      );
    }

    result = await runScanWorker(batchLimit);

  } catch (err) {

    const durationMs = Date.now() - started;

    queueDepth = await getScanQueueDepth();

    console.error('[handleScanBatch] batch failed', err);

    await recordScanWorkerMetrics({

      eventType: 'batch_error',

      queueDepth,

      processed: 0,

      failed: 0,

      skipped: 0,

      reclaimed: 0,

      durationMs,

    });

    throw err;

  }



  const durationMs = Date.now() - started;

  queueDepth = await getScanQueueDepth();



  console.log(

    `[handleScanBatch] depth=${queueDepth} processed=${result.processed} failed=${result.failed} skipped=${result.skipped} reclaimed=${result.reclaimed} durationMs=${durationMs}`,

  );



  await recordScanWorkerMetrics({

    eventType: result.processed === 0 ? 'batch_empty' : 'batch_complete',

    queueDepth,

    processed: result.processed,

    failed: result.failed,

    skipped: result.skipped,

    reclaimed: result.reclaimed,

    durationMs,

  });



  await recordCronRunMetrics({

    queueDepth,

    processed: result.processed,

    failed: result.failed,

    durationMs,

    reclaimed: result.reclaimed,

    skipped: result.skipped,

  });



  return {

    processed: result.processed,

    failed: result.failed,

    skipped: result.skipped,

    reclaimed: result.reclaimed,

    durationMs,

    queueDepth,

    succeeded: result.succeeded,

    ok: true,

  };

}


