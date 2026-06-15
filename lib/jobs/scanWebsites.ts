import { createAdminClient } from '@/lib/supabase/admin';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import { enqueueScan } from '@/lib/scanner/orchestrator';
import { isDueForScheduledScan } from './scanFrequency';

export interface ScheduledScanResult {
  examined: number;
  queued: number;
  skipped: number;
  errors: number;
}

/**
 * Enqueues active websites whose plan scan frequency is due.
 * Called by /api/scan/enqueue-or-process-batch before the worker batch runs.
 */
export async function runScheduledScans(): Promise<ScheduledScanResult> {
  const supabase = createAdminClient();

  const { data: websites, error } = await supabase
    .from('websites')
    .select('id, url, user_id, org_id, last_scanned_at')
    .eq('is_active', true);

  if (error || !websites) {
    console.error('[cron] Failed to fetch websites:', error);
    return { examined: 0, queued: 0, skipped: 0, errors: 0 };
  }

  console.log(`[cron] ${new Date().toISOString()} — evaluating ${websites.length} websites`);

  const planCache = new Map<string, ReturnType<typeof getEffectivePlan>>();
  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const website of websites) {
    const cacheKey = `${website.user_id}:${website.org_id ?? ''}`;
    let plan = planCache.get(cacheKey);
    if (!plan) {
      const userWithPlan = await getUserWithPlan(website.user_id, website.org_id);
      plan = getEffectivePlan(userWithPlan);
      planCache.set(cacheKey, plan);
    }

    if (!isDueForScheduledScan(plan, website.last_scanned_at)) {
      skipped++;
      continue;
    }

    const result = await enqueueScan({
      userId: website.user_id,
      websiteId: website.id,
      source: 'cron',
      orgId: website.org_id,
    });

    if (result.queued) {
      queued++;
      console.log(`[cron] Queued ${website.url}`);
    } else if (result.reason === 'error') {
      errors++;
      console.error(`[cron] Failed to enqueue ${website.url}:`, result.error);
    } else {
      skipped++;
    }
  }

  console.log(
    `[cron] Done — queued=${queued} skipped=${skipped} errors=${errors} (examined=${websites.length})`,
  );

  return { examined: websites.length, queued, skipped, errors };
}
