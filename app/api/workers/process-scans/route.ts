/**
 * POST/GET /api/workers/process-scans
 *
 * Production queue worker — atomic claim, idempotent processing, fast return.
 * Auth: CRON_SECRET bearer (Vercel cron / cron-job.org / GitHub Actions).
 *
 * External cron (recommended for frequent polling):
 *   curl -X POST https://your-app.vercel.app/api/workers/process-scans \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runScanWorker } from '@/lib/scanner/processQueue';
import { logApiTiming } from '@/lib/observability/log';

async function handleWorker(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const result = await runScanWorker();

  logApiTiming('/api/workers/process-scans', Date.now() - started, 200, {
    processed: result.processed,
    failed: result.failed,
    reclaimed: result.reclaimed,
  });

  return NextResponse.json({
    ok: true,
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
  });
}

export async function POST(req: Request) {
  return handleWorker(req);
}

export async function GET(req: Request) {
  return handleWorker(req);
}
