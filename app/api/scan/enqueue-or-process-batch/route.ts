/**
 * POST/GET /api/scan/enqueue-or-process-batch
 *
 * Primary Vercel Cron endpoint — reclaims stale locks, enqueues due scheduled
 * scans, claims pending jobs, and processes a bounded batch (default 10).
 * Idempotent and multi-instance safe.
 *
 * Scheduled via vercel.json (daily). Auth: CRON_SECRET bearer or x-cron-secret.
 */

import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runScheduledScans } from '@/lib/jobs/scanWebsites';
import { handleScanBatch } from '@/lib/scanner/handleScanBatch';
import { logApiTiming } from '@/lib/observability/log';

/** Allow scan worker to finish (must match lib/queue/routeConfig.ts). */
export const maxDuration = 180;

async function handleRequest(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const enqueueResult = await runScheduledScans();
  const result = await handleScanBatch();

  logApiTiming('/api/scan/enqueue-or-process-batch', result.durationMs, 200, {
    enqueued: enqueueResult.queued,
    enqueueBlocked: enqueueResult.blocked,
    processed: result.processed,
    failed: result.failed,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
  });

  return NextResponse.json({
    enqueued: enqueueResult.queued,
    enqueueBlocked: enqueueResult.blocked,
    enqueueSkipped: enqueueResult.skipped,
    processed: result.processed,
    failed: result.failed,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
    durationMs: result.durationMs,
  });
}

export async function POST(req: Request) {
  return handleRequest(req);
}

export async function GET(req: Request) {
  return handleRequest(req);
}
