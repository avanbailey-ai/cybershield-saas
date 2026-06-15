import type { Plan } from '@/lib/billing/plans';
import { PLAN_LIMITS } from '@/lib/billing/plans';

const MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
} as const;

/** Whether a website is due for an automated (cron) scan based on plan frequency. */
export function isDueForScheduledScan(
  plan: Plan,
  lastScannedAt: string | null,
): boolean {
  const frequency = PLAN_LIMITS[plan]?.scanFrequency ?? 'manual';
  if (frequency === 'manual') return false;
  if (!lastScannedAt) return true;

  const elapsed = Date.now() - new Date(lastScannedAt).getTime();
  return elapsed >= MS[frequency];
}
