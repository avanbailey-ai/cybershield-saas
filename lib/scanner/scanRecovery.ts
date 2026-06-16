/**
 * Scan timeout + stuck-job recovery — invoked before each worker batch.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { reclaimStaleScanJobs } from '@/lib/queue/claimJobs';
import { STALE_RECLAIM_MINUTES } from './scanStatus';

export interface ScanRecoveryResult {
  expired: number;
  reclaimed: number;
}

/** Fail processing jobs past lock expiry; reclaim jobs stuck >10 min. */
export async function recoverStuckScans(): Promise<ScanRecoveryResult> {
  const supabase = createAdminClient();

  const { data: expiredData, error: expiredErr } = await supabase.rpc('fail_expired_scan_jobs');

  if (expiredErr) {
    console.error('[scanRecovery] fail_expired_scan_jobs failed', expiredErr);
  }

  const expired = typeof expiredData === 'number' ? expiredData : 0;
  if (expired > 0) {
    console.log(`[scanRecovery] failed ${expired} expired scan job(s)`);
  }

  const reclaimed = await reclaimStaleScanJobs(STALE_RECLAIM_MINUTES);

  return { expired, reclaimed };
}
