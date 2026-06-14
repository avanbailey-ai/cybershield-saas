// DEPRECATED: Use orchestrator.enqueueScan() directly.
// This file is kept to avoid breaking any remaining import references,
// but it is now a thin passthrough that enqueues via the orchestrator
// rather than running scans directly.

import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueScan } from '@/lib/scanner/orchestrator';

export interface ScanSummary {
  queued: number;
  skipped: number;
  failed: number;
  /** @deprecated Previously "scanned" — now reflects jobs enqueued, not completed */
  scanned: number;
  alertsCreated: number;
}

/** @deprecated Call orchestrator.enqueueScan() directly for each website instead. */
export async function scanAllWebsites(userId: string): Promise<ScanSummary> {
  console.warn(
    '[scanAllWebsites] DEPRECATED — this function now enqueues via orchestrator. Call orchestrator.enqueueScan() directly.',
  );

  const supabase = createAdminClient();
  const { data: websites, error } = await supabase
    .from('websites')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !websites) {
    return { queued: 0, skipped: 0, failed: 0, scanned: 0, alertsCreated: 0 };
  }

  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const website of websites) {
    const result = await enqueueScan({ userId, websiteId: website.id, source: 'manual' });
    if (result.queued) {
      queued++;
    } else if (result.reason === 'error') {
      failed++;
    } else {
      skipped++;
    }
  }

  return { queued, skipped, failed, scanned: queued, alertsCreated: 0 };
}
