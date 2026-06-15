/**
 * POST/GET /api/scan/enqueue-or-process-batch
 *
 * Production cron endpoint — reclaims stale locks, claims pending scan jobs,
 * processes a bounded batch (default 10). Idempotent and multi-instance safe.
 *
 * Auth: Authorization: Bearer CRON_SECRET
 *
 * Recommended cron-job.org URL (every 5 min):
 *   GET https://your-app.vercel.app/api/scan/enqueue-or-process-batch
 *   Header: Authorization: Bearer YOUR_CRON_SECRET
 */

import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runScheduledScans } from '@/lib/jobs/scanWebsites';
import { handleScanBatch } from '@/lib/scanner/handleScanBatch';
import { logApiTiming } from '@/lib/observability/log';

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
