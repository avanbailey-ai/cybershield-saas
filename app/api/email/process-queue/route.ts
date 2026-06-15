/**
 * @deprecated Use /api/workers/process-emails instead.
 * Thin delegation shim — kept for backward-compatible cron URLs.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runEmailWorker } from '@/lib/email/processEmailWorker';
import { processAbandonedCheckouts } from '@/lib/email/abandonedCheckout';
import { processEnterpriseEmailSequences } from '@/lib/sales/sequences';

export async function POST(req: Request) {
  if (!isWorkerAuthorized(req)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [emailResult, checkoutResult, enterpriseSequences] = await Promise.all([
    runEmailWorker(),
    processAbandonedCheckouts(),
    processEnterpriseEmailSequences(),
  ]);

  return NextResponse.json({
    ok: true,
    emailQueue: emailResult,
    abandonedCheckouts: checkoutResult,
    enterpriseSequences,
    deprecated: true,
    migrateTo: '/api/workers/process-emails',
  });
}

export async function GET(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [emailResult, checkoutResult, enterpriseSequences] = await Promise.all([
    runEmailWorker(),
    processAbandonedCheckouts(),
    processEnterpriseEmailSequences(),
  ]);

  return NextResponse.json({
    ok: true,
    emailQueue: emailResult,
    abandonedCheckouts: checkoutResult,
    enterpriseSequences,
    source: 'cron',
    deprecated: true,
    migrateTo: '/api/workers/process-emails',
  });
}
