import { createAdminClient } from '@/lib/supabase/admin';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import { isPaidPlan, isSubscriptionActive } from '@/lib/billing/subscriptionService';
import { enqueueScan } from '@/lib/scanner/orchestrator';
import { checkAndIncrementScanUsage } from '@/lib/usage/checkScanLimit';
import { isDueForScheduledScan } from './scanFrequency';

export interface ScheduledScanResult {
  examined: number;
  queued: number;
  skipped: number;
  blocked: number;
  errors: number;
}

/**
 * Enqueues monitored websites (is_active) whose next_scan_at is due.
 * Called by /api/scan/enqueue-or-process-batch before the worker batch runs.
 *
 * Note: Vercel Hobby cron runs once/day; hourly_monitor schedules hourly
 * next_scan_at but enqueue cadence follows the cron interval.
 */
export async function runScheduledScans(): Promise<ScheduledScanResult> {
  const supabase = createAdminClient();

  const now = new Date().toISOString();

  // Primary path: next_scan_at due; legacy rows without next_scan_at still evaluated in-loop.
  const { data: websites, error } = await supabase
    .from('websites')
    .select('id, url, user_id, org_id, last_scanned_at, next_scan_at, scan_frequency, is_active')
    .eq('is_active', true)
    .or(`next_scan_at.is.null,next_scan_at.lte.${now}`);

  if (error || !websites) {
    console.error('[cron] Failed to fetch websites:', error);
    return { examined: 0, queued: 0, skipped: 0, blocked: 0, errors: 0 };
  }

  console.log(`[cron] ${new Date().toISOString()} — evaluating ${websites.length} websites`);

  const planCache = new Map<string, ReturnType<typeof getEffectivePlan>>();
  const userWithPlanCache = new Map<string, Awaited<ReturnType<typeof getUserWithPlan>>>();
  let queued = 0;
  let skipped = 0;
  let blocked = 0;
  let errors = 0;

  for (const website of websites) {
    const cacheKey = `${website.user_id}:${website.org_id ?? ''}`;
    let plan = planCache.get(cacheKey);
    let userWithPlan = userWithPlanCache.get(cacheKey);
    if (!plan || !userWithPlan) {
      userWithPlan = await getUserWithPlan(website.user_id, website.org_id);
      plan = getEffectivePlan(userWithPlan);
      planCache.set(cacheKey, plan);
      userWithPlanCache.set(cacheKey, userWithPlan);
    }

    if (
      !isDueForScheduledScan(plan, {
        nextScanAt: website.next_scan_at,
        lastScannedAt: website.last_scanned_at,
        scanFrequency: website.scan_frequency,
        monitoringEnabled: website.is_active,
      })
    ) {
      skipped++;
      continue;
    }

    if (isPaidPlan(plan) && !isSubscriptionActive(userWithPlan.subscription_status)) {
      console.log('[scan-limit] scan_blocked', {
        userId: website.user_id,
        orgId: website.org_id,
        websiteId: website.id,
        plan,
        reason: 'subscription_inactive',
        source: 'cron',
      });
      skipped++;
      continue;
    }

    const usageCheck = await checkAndIncrementScanUsage(
      website.user_id,
      plan,
      website.org_id,
    );

    if (!usageCheck.allowed) {
      blocked++;
      console.log('[scan-limit] scan_blocked', {
        userId: website.user_id,
        orgId: website.org_id,
        websiteId: website.id,
        plan,
        reason: usageCheck.reason ?? 'daily_limit_reached',
        scansUsed: usageCheck.scansUsed,
        scansLimit: usageCheck.scansLimit,
        source: 'cron',
      });
      continue;
    }

    const result = await enqueueScan({
      userId: website.user_id,
      websiteId: website.id,
      source: 'cron',
      orgId: website.org_id,
      usagePreChecked: true,
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
    `[cron] Done — queued=${queued} blocked=${blocked} skipped=${skipped} errors=${errors} (examined=${websites.length})`,
  );

  return { examined: websites.length, queued, skipped, blocked, errors };
}
