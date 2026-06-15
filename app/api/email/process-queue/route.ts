/**
 * POST /api/email/process-queue
 *
 * Processes due emails from email_queue and abandoned checkout recovery.
 * Auth: CRON_SECRET bearer token OR authenticated user.
 *
 * Manual trigger (Vercel free plan — no built-in cron):
 *   curl -X POST https://your-app.vercel.app/api/email/process-queue \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * Or use an external cron service (cron-job.org, GitHub Actions, etc.)
 * to hit this endpoint every 15–60 minutes.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processEmailQueue } from '@/lib/email/funnel';
import { processAbandonedCheckouts } from '@/lib/email/abandonedCheckout';
import { processEnterpriseEmailSequences } from '@/lib/sales/sequences';

function isAuthorizedByCron(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  return authHeader.slice(7) === cronSecret;
}

export async function POST(req: Request) {
  if (!isAuthorizedByCron(req)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [emailResult, checkoutResult, enterpriseSequences] = await Promise.all([
    processEmailQueue(),
    processAbandonedCheckouts(),
    processEnterpriseEmailSequences(),
  ]);

  return NextResponse.json({
    ok: true,
    emailQueue: emailResult,
    abandonedCheckouts: checkoutResult,
    enterpriseSequences,
  });
}

/** Vercel Cron invokes GET — same worker, CRON_SECRET only */
export async function GET(req: Request) {
  if (!isAuthorizedByCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [emailResult, checkoutResult, enterpriseSequences] = await Promise.all([
    processEmailQueue(),
    processAbandonedCheckouts(),
    processEnterpriseEmailSequences(),
  ]);

  return NextResponse.json({
    ok: true,
    emailQueue: emailResult,
    abandonedCheckouts: checkoutResult,
    enterpriseSequences,
    source: 'cron',
  });
}
