// CyberShield Scheduler
// This module will activate automated scanning in a future phase.
// Current implementation: placeholder only.

export interface SchedulerConfig {
  intervalHours: number;
  enabled: boolean;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  intervalHours: 6,
  enabled: false, // Will be enabled when Vercel Cron or similar is configured
};

export function startScheduler(config: SchedulerConfig = DEFAULT_CONFIG): void {
  if (!config.enabled) {
    console.log('[Scheduler] Automated scanning is not yet enabled.');
    return;
  }
  // TODO: integrate with Vercel Cron, node-cron, or Supabase Edge Functions
  console.log(`[Scheduler] Would scan every ${config.intervalHours} hours`);
}
