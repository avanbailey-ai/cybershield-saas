// CyberShield Scheduler
// Placeholder for a future event-driven scheduling layer.
// Vercel Cron has been removed. Scheduled scans are now triggered manually
// via POST /api/scan/trigger-scheduled or a future queue-based mechanism.

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
    console.log('[Scheduler] Automated scanning is not yet enabled.');
    return;
  }
  // TODO: integrate with a queue-based trigger or Supabase Edge Functions
  console.log(`[Scheduler] Would scan every ${config.intervalHours} hours`);
}
