import type { Plan } from '@/lib/billing/plans';

import { PLAN_LIMITS } from '@/lib/billing/plans';



/**

 * Per-website scan scheduling modes.

 *

 * Plan → allowed modes & intervals:

 * | Plan   | Modes                              | Default cadence | Priority cadence |

 * |--------|------------------------------------|-----------------|------------------|

 * | Free   | daily_scan (usage-capped)          | manual/none     | —                |

 * | Pro    | daily_scan, weekly_deep_scan       | 24h             | —                |

 * | Growth | daily_scan, weekly_deep_scan       | 1h              | —                |

 * | Agency | daily_scan, weekly_deep_scan, hourly_monitor | 1h (non-priority) | 5m (priority) |

 *

 * Production cron: /api/scan/enqueue-or-process-batch (vercel.json every 5 minutes).

 */



export type ScanScheduleMode = 'daily_scan' | 'weekly_deep_scan' | 'hourly_monitor';



const MS = {

  minute: 60 * 1000,

  hour: 60 * 60 * 1000,

  day: 24 * 60 * 60 * 1000,

  week: 7 * 24 * 60 * 60 * 1000,

} as const;



const BASE_INTERVAL_MS: Record<ScanScheduleMode, number> = {

  daily_scan: MS.day,

  weekly_deep_scan: MS.week,

  hourly_monitor: MS.hour,

};



/** Plan-specific interval overrides (Growth = faster daily; Agency non-priority = hourly daily_scan). */

const PLAN_INTERVAL_MS: Partial<

  Record<Plan, Partial<Record<ScanScheduleMode, number>>>

> = {

  growth: { daily_scan: MS.hour },

  agency: { daily_scan: MS.hour },

  owner: { daily_scan: MS.hour },

};



const AGENCY_PRIORITY_INTERVAL_MS = 5 * MS.minute;



function isAgencyTier(plan: Plan): boolean {

  return plan === 'agency' || plan === 'owner';

}



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



export function resolveScanModeForWebsite(

  plan: Plan,

  scanFrequency: string | null | undefined,

  priorityMonitoring = false,

): ScanScheduleMode | null {

  if (isAgencyTier(plan)) {

    if (scanFrequency === 'weekly_deep_scan') {

      return 'weekly_deep_scan';

    }

    if (priorityMonitoring) {

      return 'hourly_monitor';

    }

    return 'daily_scan';

  }



  if (

    scanFrequency &&

    isScanModeAllowed(plan, scanFrequency as ScanScheduleMode)

  ) {

    return scanFrequency as ScanScheduleMode;

  }

  return getDefaultScanMode(plan);

}



export function getScanIntervalMs(

  plan: Plan,

  mode: ScanScheduleMode,

  priorityMonitoring = false,

): number {

  if (isAgencyTier(plan) && priorityMonitoring && mode === 'hourly_monitor') {

    return AGENCY_PRIORITY_INTERVAL_MS;

  }

  return PLAN_INTERVAL_MS[plan]?.[mode] ?? BASE_INTERVAL_MS[mode];

}



export function getEligibleFrequencyMinutes(

  plan: Plan,

  mode: ScanScheduleMode,

  priorityMonitoring = false,

): number {

  return Math.round(getScanIntervalMs(plan, mode, priorityMonitoring) / MS.minute);

}



/** Compute nextScanAt from plan + mode after a successful scan. */

export function computeNextScanAt(

  plan: Plan,

  mode: ScanScheduleMode,

  fromDate: Date = new Date(),

  priorityMonitoring = false,

): string {

  const intervalMs = getScanIntervalMs(plan, mode, priorityMonitoring);

  return new Date(fromDate.getTime() + intervalMs).toISOString();

}



export interface ScheduledScanWebsite {

  nextScanAt: string | null;

  lastScannedAt: string | null;

  scanFrequency: string | null;

  /** Maps to websites.is_active — monitoring toggle. */

  monitoringEnabled: boolean;

  priorityMonitoring?: boolean;

}



/** Whether a website is due for an automated (cron) scan. */

export function isDueForScheduledScan(

  plan: Plan,

  website: ScheduledScanWebsite,

): boolean {

  if (plan === 'free') return false;

  if (!website.monitoringEnabled) return false;



  const priorityMonitoring = website.priorityMonitoring ?? false;

  const mode = resolveScanModeForWebsite(plan, website.scanFrequency, priorityMonitoring);

  if (!mode) return false;



  if (website.nextScanAt) {

    return new Date(website.nextScanAt).getTime() <= Date.now();

  }



  if (!website.lastScannedAt) return true;



  const elapsed = Date.now() - new Date(website.lastScannedAt).getTime();

  return elapsed >= getScanIntervalMs(plan, mode, priorityMonitoring);

}



/** Scan frequency + next_scan_at when toggling agency priority monitoring. */

export function priorityMonitoringSchedulePatch(enabled: boolean): {

  scan_frequency: ScanScheduleMode;

  next_scan_at: string;

} {

  return {

    scan_frequency: enabled ? 'hourly_monitor' : 'daily_scan',

    next_scan_at: new Date().toISOString(),

  };

}


