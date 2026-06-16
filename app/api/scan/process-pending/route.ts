/**
 * POST /api/scan/process-pending
 *
 * Authenticated users can kick the scan worker for their pending jobs.
 * Does NOT replace cron — processes up to one batch server-side after enqueue/retry.
 */

import '@/services/bootstrap';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getUser } from '@/services/supabaseService';
import { processQueuedScansForUser } from '@/lib/scanner/processUserScanQueue';
import { requirePermission } from '@/lib/auth/rbac';
import { getActiveOrgId } from '@/lib/org/context';

export async function POST() {
  const supabase = await createClient();
  const { user } = await getUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const orgId = await getActiveOrgId(user.id);

  try {
    await requirePermission(user.id, orgId, 'run_scans');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await processQueuedScansForUser({ batchLimit: 1 });
    return NextResponse.json({
      ok: true,
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
      queueDepth: result.queueDepth,
    });
  } catch (err) {
    console.error('[process-pending] failed', err);
    return NextResponse.json({ error: 'Failed to process scan queue' }, { status: 500 });
  }
}
