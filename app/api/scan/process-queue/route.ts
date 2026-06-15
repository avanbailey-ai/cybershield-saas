/**
 * @deprecated Use /api/workers/process-scans instead.
 * Thin delegation shim — kept for backward-compatible cron URLs.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runScanWorker } from '@/lib/scanner/processQueue';
import { logApiTiming } from '@/lib/observability/log';

export async function POST(req: Request) {
  const started = Date.now();

  if (!isWorkerAuthorized(req)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await runScanWorker();
  logApiTiming('/api/scan/process-queue', Date.now() - started, 200, { processed: result.processed, deprecated: true });

  return NextResponse.json({
    ...result,
    deprecated: true,
    migrateTo: '/api/workers/process-scans',
  });
}

export async function GET(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const result = await runScanWorker();
  logApiTiming('/api/scan/process-queue', Date.now() - started, 200, { processed: result.processed, source: 'cron', deprecated: true });

  return NextResponse.json({
    ...result,
    deprecated: true,
    migrateTo: '/api/workers/process-scans',
  });
}
