import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueScan } from '@/lib/scanner/orchestrator';

/**
 * Designed to be called by a Vercel Cron job or any scheduler.
 * Enqueues all active websites for scanning via the orchestrator.
 * The actual scan execution happens when /api/scan/process-queue is called
 * (either by a separate cron step or by the process-queue endpoint).
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
