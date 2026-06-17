/**
 * POST/GET /api/scan/enqueue-or-process-batch
 *
 * Primary Vercel Cron endpoint — reclaims stale locks, enqueues due scheduled
 * scans, claims pending jobs, and processes a bounded batch (default 10).
 * Idempotent and multi-instance safe.
 */

import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runScheduledScans } from '@/lib/jobs/scanWebsites';
import { handleScanBatch } from '@/lib/scanner/handleScanBatch';
import { logApiTiming } from '@/lib/observability/log';
import {
  completeCronMonitoringRun,
  createCronMonitoringRun,
} from '@/lib/alerts/emailAlertLog';
import { flushGroupedMonitoringAlerts } from '@/lib/alerts/emailPipeline';

export const maxDuration = 180;

async function handleRequest(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cronRunId = await createCronMonitoringRun();
  const enqueueResult = await runScheduledScans();
  const result = await handleScanBatch();

  let emailFlush = { attempted: 0, sent: 0, skipped: 0 };
  try {
    emailFlush = await flushGroupedMonitoringAlerts({ cronRunId });
  } catch (err) {
    console.error('[cron] grouped email flush failed:', err);
  }

  await completeCronMonitoringRun(cronRunId, {
    websitesConsidered: enqueueResult.examined,
    websitesDue: enqueueResult.due,
    websitesEnqueued: enqueueResult.queued,
    websitesSkipped: enqueueResult.skipped,
    websitesBlocked: enqueueResult.blocked,
    websitesErrors: enqueueResult.errors,
    batchProcessed: result.processed,
    batchFailed: result.failed,
    emailsAttempted: emailFlush.attempted,
    emailsSent: emailFlush.sent,
    emailsSkipped: emailFlush.skipped,
  });

  logApiTiming('/api/scan/enqueue-or-process-batch', result.durationMs, 200, {
    enqueued: enqueueResult.queued,
    enqueueBlocked: enqueueResult.blocked,
    processed: result.processed,
    failed: result.failed,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
    emailsSent: emailFlush.sent,
  });

  return NextResponse.json({
    cronRunId,
    enqueued: enqueueResult.queued,
    enqueueDue: enqueueResult.due,
    enqueueBlocked: enqueueResult.blocked,
    enqueueSkipped: enqueueResult.skipped,
    processed: result.processed,
    failed: result.failed,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
    emailsAttempted: emailFlush.attempted,
    emailsSent: emailFlush.sent,
    emailsSkipped: emailFlush.skipped,
    durationMs: result.durationMs,
  });
}

export async function POST(req: Request) {
  return handleRequest(req);
}

export async function GET(req: Request) {
  return handleRequest(req);
}
