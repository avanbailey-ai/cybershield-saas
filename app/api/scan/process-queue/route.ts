/**
 * POST /api/scan/process-queue
 *
 * Processes pending jobs from the scan queue (async worker).
 * Auth: CRON_SECRET bearer token OR authenticated user.
 *
 * Cron / manual trigger:
 *   curl -X POST https://your-app.vercel.app/api/scan/process-queue \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processQueue } from '@/lib/scanner/processQueue';
import { logApiTiming } from '@/lib/observability/log';

function isAuthorizedByCron(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  return authHeader.slice(7) === cronSecret;
}

export async function POST(req: Request) {
  const started = Date.now();

  if (!isAuthorizedByCron(req)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await processQueue(5);
  logApiTiming('/api/scan/process-queue', Date.now() - started, 200, { processed: result.processed });
  return NextResponse.json(result);
}

/** Vercel Cron invokes GET — same worker, CRON_SECRET only */
export async function GET(req: Request) {
  if (!isAuthorizedByCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const result = await processQueue(5);
  logApiTiming('/api/scan/process-queue', Date.now() - started, 200, { processed: result.processed, source: 'cron' });
  return NextResponse.json(result);
}
