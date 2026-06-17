import type { ScanScheduleMode } from '@/lib/jobs/scanFrequency';

const MS = {
  week: 7 * 24 * 60 * 60 * 1000,
} as const;

export type MonitoringScanKind = 'monitoring_check' | 'deep_scan';

export interface WebsiteScheduleInput {
  scanFrequency: string | null;
  priorityMonitoring: boolean;
  lastDeepScanAt: string | null;
}

/** Pick quick monitoring vs weekly deep scan for this cron tick. */
export function resolveMonitoringScanKind(
  mode: ScanScheduleMode,
  website: WebsiteScheduleInput,
): MonitoringScanKind {
  if (mode === 'weekly_deep_scan') {
    return 'deep_scan';
  }

  const lastDeep = website.lastDeepScanAt
    ? new Date(website.lastDeepScanAt).getTime()
    : 0;
  const deepDue = !lastDeep || Date.now() - lastDeep >= MS.week;

  if (deepDue && mode === 'daily_scan') {
    return 'deep_scan';
  }

  return 'monitoring_check';
}

/** Whether this cron tick should run a weekly deep scan instead of a quick check. */
export function shouldRunDeepScanThisTick(
  mode: ScanScheduleMode,
  lastDeepScanAt: string | null,
): boolean {
  if (mode === 'weekly_deep_scan') return true;
  const lastDeep = lastDeepScanAt ? new Date(lastDeepScanAt).getTime() : 0;
  return !lastDeep || Date.now() - lastDeep >= MS.week;
}
