import type { Plan } from '@/lib/billing/plans';
import { PLAN_LIMITS } from '@/lib/billing/plans';

/**
 * Per-website scan scheduling modes.
 *
 * Plan → allowed modes & intervals:
 * | Plan   | Modes                              | Daily window | Weekly window | Hourly |
 * |--------|------------------------------------|--------------|---------------|--------|
 * | Free   | daily_scan (usage-capped)          | 24h          | —             | —      |
 * | Pro    | daily_scan, weekly_deep_scan       | 24h          | 7d            | —      |
 * | Growth | daily_scan, weekly_deep_scan       | 12h          | 7d            | —      |
 * | Agency | daily_scan, weekly_deep_scan, hourly_monitor | 24h | 7d     | 1h     |
 *
 * Production cron: `/api/scan/enqueue-or-process-batch` runs every 6 hours (cron schedule: every 6 hours at minute 0). Agency `hourly_monitor` schedules hourly `next_scan_at`; actual enqueue cadence follows the cron interval.
 */

export type ScanScheduleMode = 'daily_scan' | 'weekly_deep_scan' | 'hourly_monitor';

const MS = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
} as const;

const BASE_INTERVAL_MS: Record<ScanScheduleMode, number> = {
  daily_scan: MS.day,
  weekly_deep_scan: MS.week,
  hourly_monitor: MS.hour,
};

/** Plan-specific interval overrides (Growth = faster daily detection). */
const PLAN_INTERVAL_MS: Partial<
  Record<Plan, Partial<Record<ScanScheduleMode, number>>>
> = {
  growth: { daily_scan: 12 * MS.hour },
};

export function getAllowedScanModes(plan: Plan): ScanScheduleMode[] {
  switch (plan) {
    case 'free':
      return ['daily_scan'];
    case 'pro':
    case 'growth':
      return ['daily_scan', 'weekly_deep_scan'];
    case 'agency':
    case 'owner':
      return ['daily_scan', 'weekly_deep_scan', 'hourly_monitor'];
    default:
      return [];
  }
}

export function getDefaultScanMode(plan: Plan): ScanScheduleMode | null {
  if (plan === 'free' && PLAN_LIMITS.free.scanFrequency === 'manual') {
    return null;
  }
  return 'daily_scan';
}

export function isScanModeAllowed(plan: Plan, mode: ScanScheduleMode): boolean {
  return getAllowedScanModes(plan).includes(mode);
}

export function getScanIntervalMs(plan: Plan, mode: ScanScheduleMode): number {
  return PLAN_INTERVAL_MS[plan]?.[mode] ?? BASE_INTERVAL_MS[mode];
}

export function resolveScanModeForWebsite(
  plan: Plan,
  scanFrequency: string | null | undefined,
): ScanScheduleMode | null {
  if (
    scanFrequency &&
    isScanModeAllowed(plan, scanFrequency as ScanScheduleMode)
  ) {
    return scanFrequency as ScanScheduleMode;
  }
  return getDefaultScanMode(plan);
}

/** Compute nextScanAt from plan + mode after a successful scan. */
export function computeNextScanAt(
  plan: Plan,
  mode: ScanScheduleMode,
  fromDate: Date = new Date(),
): string {
  const intervalMs = getScanIntervalMs(plan, mode);
  return new Date(fromDate.getTime() + intervalMs).toISOString();
}

export interface ScheduledScanWebsite {
  nextScanAt: string | null;
  lastScannedAt: string | null;
  scanFrequency: string | null;
  /** Maps to websites.is_active — monitoring toggle. */
  monitoringEnabled: boolean;
}

/** Whether a website is due for an automated (cron) scan. */
export function isDueForScheduledScan(
  plan: Plan,
  website: ScheduledScanWebsite,
): boolean {
  if (!website.monitoringEnabled) return false;

  const mode = resolveScanModeForWebsite(plan, website.scanFrequency);
  if (!mode) return false;

  if (website.nextScanAt) {
    return new Date(website.nextScanAt).getTime() <= Date.now();
  }

  // Legacy rows without next_scan_at: fall back to last_scanned_at + interval.
  if (!website.lastScannedAt) return true;

  const elapsed = Date.now() - new Date(website.lastScannedAt).getTime();
  return elapsed >= getScanIntervalMs(plan, mode);
}
