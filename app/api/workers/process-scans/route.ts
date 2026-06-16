/**
 * POST/GET /api/workers/process-scans
 *
 * Legacy alias — delegates to the shared scan batch handler.
 * Production scheduling uses /api/scan/enqueue-or-process-batch (Vercel Cron).
 *
 * Auth: CRON_SECRET bearer or x-cron-secret header.
 */

import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { handleScanBatch } from '@/lib/scanner/handleScanBatch';
import { logApiTiming } from '@/lib/observability/log';

/** Allow scan worker to finish (must match lib/queue/routeConfig.ts). */
export const maxDuration = 180;

async function handleWorker(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await handleScanBatch();

  logApiTiming('/api/workers/process-scans', result.durationMs, 200, {
    processed: result.processed,
    failed: result.failed,
    reclaimed: result.reclaimed,
  });

  return NextResponse.json({
    ok: result.ok,
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
    durationMs: result.durationMs,
    migrateTo: '/api/scan/enqueue-or-process-batch',
  });
}

export async function POST(req: Request) {
  return handleWorker(req);
}

export async function GET(req: Request) {
  return handleWorker(req);
}
