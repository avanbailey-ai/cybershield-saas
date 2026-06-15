/**
 * POST /api/scan/trigger-scheduled
 * Manually triggers a full-site scan pass across ALL active websites for ALL users.
 * This replaces the former Vercel Cron job at /api/cron/scan (removed).
 *
 * Requires an authenticated user session. Intended for admin use.
 * Scan execution is handled by /api/scan/enqueue-or-process-batch (cron-job.org every 5 min).
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
