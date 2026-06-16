/**
 * @deprecated Use /api/scan/enqueue-or-process-batch instead (Vercel Cron).
 * Legacy shim — not scheduled externally.
 */

import '@/services/bootstrap';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { logApiTiming } from '@/lib/observability/log';
import { getUser } from '@/services/supabaseService';
import { processScanBatch } from '@/services/scanQueueService';

export async function POST(req: Request) {
  if (!isWorkerAuthorized(req)) {
    const supabase = await createClient();
    const { user } = await getUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await processScanBatch();
  logApiTiming('/api/scan/process-queue', result.durationMs, 200, {
    processed: result.processed,
    deprecated: true,
  });

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

  const result = await processScanBatch();
  logApiTiming('/api/scan/process-queue', result.durationMs, 200, {
    processed: result.processed,
    source: 'cron',
    deprecated: true,
  });

  return NextResponse.json({
    ...result,
    deprecated: true,
    migrateTo: '/api/scan/enqueue-or-process-batch',
  });
}
