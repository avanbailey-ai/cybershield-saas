// CyberShield Scheduler
// Production scheduling runs exclusively via Vercel Cron (see vercel.json).
// Manual enqueue-only pass: POST /api/scan/trigger-scheduled (authenticated).

export interface SchedulerConfig {
  intervalHours: number;
  enabled: boolean;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  intervalHours: 6,
  enabled: false,
};

export function startScheduler(config: SchedulerConfig = DEFAULT_CONFIG): void {
  if (!config.enabled) {
    console.log('[Scheduler] Automated scanning is handled by Vercel Cron.');
    return;
  }
  console.log(`[Scheduler] Would scan every ${config.intervalHours} hours`);
}
