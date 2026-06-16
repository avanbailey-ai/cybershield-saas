/**
 * POST /api/scan/trigger-scheduled
 * Manually enqueues due scheduled scans (enqueue-only; does not process the queue).
 *
 * Production scheduling runs via Vercel Cron at /api/scan/enqueue-or-process-batch.
 * Requires an authenticated user session.
 */

import { createClient } from '@/lib/supabase/server';
import { runScheduledScans } from '@/lib/jobs/scanWebsites';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await runScheduledScans();

  return Response.json({ ok: true });
}
