/**
 * @deprecated Use /api/scan/enqueue-or-process-batch instead.
 * Thin delegation shim — kept for backward-compatible cron URLs.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { handleScanBatch } from '@/lib/scanner/handleScanBatch';
import { logApiTiming } from '@/lib/observability/log';

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

  const result = await handleScanBatch();
  logApiTiming('/api/scan/process-queue', result.durationMs, 200, { processed: result.processed, deprecated: true });

  return NextResponse.json({
    ...result,
    deprecated: true,
    migrateTo: '/api/scan/enqueue-or-process-batch',
  });
}

export async function GET(req: Request) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await handleScanBatch();
  logApiTiming('/api/scan/process-queue', result.durationMs, 200, { processed: result.processed, source: 'cron', deprecated: true });

  return NextResponse.json({
    ...result,
    deprecated: true,
    migrateTo: '/api/scan/enqueue-or-process-batch',
  });
}
