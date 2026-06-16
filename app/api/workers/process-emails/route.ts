/**
 * POST/GET /api/workers/process-emails
 *
 * Vercel Cron email worker — atomic claim, retry, idempotent send.
 * Scheduled via vercel.json (daily). Auth: CRON_SECRET bearer or x-cron-secret.
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
