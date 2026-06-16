import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runScheduledScans } from '@/lib/jobs/scanWebsites';

/**
 * POST /api/scan/trigger-scheduled
 * Enqueues due scheduled scans (enqueue-only). CRON_SECRET or platform owner only.
 */
export async function POST(req: Request) {
  if (!isWorkerAuthorized(req)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isOwner(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const result = await runScheduledScans();

  return NextResponse.json({ ok: true, ...result });
}
