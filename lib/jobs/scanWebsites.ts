import { createAdminClient } from '@/lib/supabase/admin';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import {
  canUsePriorityMonitoring,
  countPriorityMonitoringUsed,
  getPriorityMonitoringSlots,
} from '@/lib/billing/priorityMonitoring';
import { enqueueScan } from '@/lib/scanner/orchestrator';
import { enforceScanLimit } from '@/lib/billing/enforceScan';
import {
  getEligibleFrequencyMinutes,
  isDueForScheduledScan,
  resolveScanModeForWebsite,
} from './scanFrequency';

export interface ScheduledScanResult {
  examined: number;
  queued: number;
  skipped: number;
  blocked: number;
  errors: number;
}

export interface SchedulerDecisionLog {
  orgId: string | null;
  websiteId: string;
  effectivePlan: string;
  priorityMonitoring: boolean;
  prioritySlotsUsed: number | null;
  prioritySlotsLimit: number | null;
  lastScanAt: string | null;
  scanAgeMinutes: number | null;
  eligibleFrequencyMinutes: number;
  nextScanAt: string | null;
  action: 'enqueued' | 'skipped' | 'blocked' | 'error';
  reason: string;
}

function scanAgeMinutes(lastScannedAt: string | null): number | null {
  if (!lastScannedAt) return null;
  return Math.round((Date.now() - new Date(lastScannedAt).getTime()) / 60_000);
}

function logSchedulerDecision(entry: SchedulerDecisionLog): void {
  console.log('[scheduler]', JSON.stringify(entry));
}

/**
 * Enqueues monitored websites (is_active) whose next_scan_at is due.
 * Called by /api/scan/enqueue-or-process-batch before the worker batch runs.
 */
export async function runScheduledScans(): Promise<ScheduledScanResult> {
  const supabase = createAdminClient();

  const now = new Date().toISOString();

  const { data: websites, error } = await supabase
    .from('websites')
    .select(
      'id, url, user_id, org_id, last_scanned_at, next_scan_at, scan_frequency, is_active, priority_monitoring',
    )
    .eq('is_active', true)
    .or(`next_scan_at.is.null,next_scan_at.lte.${now}`);

  if (error || !websites) {
    console.error('[cron] Failed to fetch websites:', error);
    return { examined: 0, queued: 0, skipped: 0, blocked: 0, errors: 0 };
  }

  console.log(`[cron] ${new Date().toISOString()} — evaluating ${websites.length} websites`);

  const planCache = new Map<string, ReturnType<typeof getEffectivePlan>>();
  const userWithPlanCache = new Map<string, Awaited<ReturnType<typeof getUserWithPlan>>>();
  const prioritySlotsUsedCache = new Map<string, number>();
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

    const priorityMonitoring = website.priority_monitoring === true;
    const mode = resolveScanModeForWebsite(plan, website.scan_frequency, priorityMonitoring);
    const eligibleFrequencyMinutes = mode
      ? getEligibleFrequencyMinutes(plan, mode, priorityMonitoring)
      : 0;
    const lastScanAt = website.last_scanned_at;
    const ageMinutes = scanAgeMinutes(lastScanAt);

    let prioritySlotsUsed: number | null = null;
    let prioritySlotsLimit: number | null = null;
    if (canUsePriorityMonitoring(userWithPlan)) {
      prioritySlotsLimit = getPriorityMonitoringSlots(plan);
      const slotKey = website.org_id ?? `user:${website.user_id}`;
      if (!prioritySlotsUsedCache.has(slotKey)) {
        prioritySlotsUsedCache.set(
          slotKey,
          await countPriorityMonitoringUsed(supabase, website.org_id, website.user_id),
        );
      }
      prioritySlotsUsed = prioritySlotsUsedCache.get(slotKey) ?? 0;
    }

    const baseLog = {
      orgId: website.org_id,
      websiteId: website.id,
      effectivePlan: plan,
      priorityMonitoring,
      prioritySlotsUsed,
      prioritySlotsLimit,
      lastScanAt,
      scanAgeMinutes: ageMinutes,
      eligibleFrequencyMinutes,
      nextScanAt: website.next_scan_at,
    };

    if (
      !isDueForScheduledScan(plan, {
        nextScanAt: website.next_scan_at,
        lastScannedAt: website.last_scanned_at,
        scanFrequency: website.scan_frequency,
        monitoringEnabled: website.is_active,
        priorityMonitoring,
      })
    ) {
      skipped++;
      logSchedulerDecision({
        ...baseLog,
        action: 'skipped',
        reason: mode
          ? `not_due (next_scan_at=${website.next_scan_at ?? 'legacy'})`
          : 'no_eligible_scan_mode',
      });
      continue;
    }

    const enforceResult = await enforceScanLimit(website.user_id, website.org_id, {
      skipDailyLimit: true,
    });
    if (!enforceResult.allowed) {
      blocked++;
      logSchedulerDecision({
        ...baseLog,
        action: 'blocked',
        reason: enforceResult.reason ?? 'scan_limit',
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
      logSchedulerDecision({
        ...baseLog,
        action: 'enqueued',
        reason: 'due_for_scan',
      });
    } else if (result.reason === 'error') {
      errors++;
      logSchedulerDecision({
        ...baseLog,
        action: 'error',
        reason: result.error ?? 'enqueue_failed',
      });
    } else {
      skipped++;
      logSchedulerDecision({
        ...baseLog,
        action: 'skipped',
        reason: result.reason ?? 'not_queued',
      });
    }
  }

  console.log(
    `[cron] Done — queued=${queued} blocked=${blocked} skipped=${skipped} errors=${errors} (examined=${websites.length})`,
  );

  return { examined: websites.length, queued, skipped, blocked, errors };
}
