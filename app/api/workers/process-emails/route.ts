/**
 * POST/GET /api/workers/process-emails
 *
 * Production email queue worker — atomic claim, retry, idempotent send.
 * Auth: CRON_SECRET bearer (Vercel cron / cron-job.org / GitHub Actions).
 *
 * Also runs abandoned checkout recovery and enterprise sequences (non-queued side effects).
 */

import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runEmailWorker } from '@/lib/email/processEmailWorker';
import { processAbandonedCheckouts } from '@/lib/email/abandonedCheckout';
import { processEnterpriseEmailSequences } from '@/lib/sales/sequences';
import { logApiTiming } from '@/lib/observability/log';

async function handleWorker(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();

  const [emailResult, checkoutResult, enterpriseSequences] = await Promise.all([
    runEmailWorker(),
    processAbandonedCheckouts(),
    processEnterpriseEmailSequences(),
  ]);

  logApiTiming('/api/workers/process-emails', Date.now() - started, 200, {
    processed: emailResult.processed,
    failed: emailResult.failed,
    reclaimed: emailResult.reclaimed,
  });

  return NextResponse.json({
    ok: true,
    processed: emailResult.processed,
    sent: emailResult.sent,
    failed: emailResult.failed,
    reclaimed: emailResult.reclaimed,
    abandonedCheckouts: checkoutResult,
    enterpriseSequences,
    source: req.method === 'GET' ? 'cron' : undefined,
  });
}

export async function POST(req: Request) {
  return handleWorker(req);
}

export async function GET(req: Request) {
  return handleWorker(req);
}
