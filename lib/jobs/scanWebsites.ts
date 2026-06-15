// @deprecated The Vercel Cron that called this has been removed.
// This file is retained for manual triggers via POST /api/scan/trigger-scheduled.
// Do not delete — it remains useful as an on-demand admin tool.

import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueScan } from '@/lib/scanner/orchestrator';

/**
 * Enqueues all active websites across all users for scanning via the orchestrator.
 * The actual scan execution happens when /api/scan/enqueue-or-process-batch is invoked (cron-job.org).
 *
 * Previously called by the Vercel Cron job at /api/cron/scan (now removed).
 * Now called manually via POST /api/scan/trigger-scheduled (authenticated).
 */
export async function runScheduledScans(): Promise<void> {
  const supabase = createAdminClient();

  const { data: websites, error } = await supabase
    .from('websites')
    .select('id, url, user_id')
    .eq('is_active', true);

  if (error || !websites) {
    console.error('[cron] Failed to fetch websites:', error);
    return;
  }

  console.log(`[cron] ${new Date().toISOString()} — enqueueing ${websites.length} websites`);

  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const website of websites) {
    const result = await enqueueScan({
      userId: website.user_id,
      websiteId: website.id,
      source: 'cron',
    });

    if (result.queued) {
      queued++;
      console.log(`[cron] Queued ${website.url}`);
    } else if (result.reason === 'error') {
      errors++;
      console.error(`[cron] Failed to enqueue ${website.url}:`, result.error);
    } else {
      skipped++;
      console.log(`[cron] Skipped ${website.url} — reason=${result.reason}`);
    }
  }

  console.log(
    `[cron] Done — queued=${queued} skipped=${skipped} errors=${errors} (total=${websites.length})`,
  );
}
