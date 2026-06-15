/** Persist operational metrics to system_health for dashboards and alerting. */

import { createAdminClient } from '@/lib/supabase/admin';

export type SystemHealthMetricType =
  | 'queue_depth'
  | 'processed'
  | 'failed'
  | 'avg_duration'
  | 'cron_run';

export interface CronRunMetrics {
  queueDepth: number;
  processed: number;
  failed: number;
  durationMs: number;
  reclaimed?: number;
  skipped?: number;
}

export async function recordSystemHealth(
  metricType: SystemHealthMetricType,
  value: number,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('system_health').insert({
      metric_type: metricType,
      value,
      metadata,
    });
  } catch (err) {
    console.error('[systemHealth] insert failed (non-fatal)', { metricType, err });
  }
}

/** Log batch metrics after each cron worker run. */
export async function recordCronRunMetrics(payload: CronRunMetrics): Promise<void> {
  const avgDuration =
    payload.processed > 0 ? Math.round(payload.durationMs / payload.processed) : 0;

  const baseMeta = {
    reclaimed: payload.reclaimed ?? 0,
    skipped: payload.skipped ?? 0,
    durationMs: payload.durationMs,
  };

  await Promise.all([
    recordSystemHealth('queue_depth', payload.queueDepth, baseMeta),
    recordSystemHealth('processed', payload.processed, baseMeta),
    recordSystemHealth('failed', payload.failed, baseMeta),
    recordSystemHealth('avg_duration', avgDuration, baseMeta),
    recordSystemHealth('cron_run', 1, {
      ...baseMeta,
      queueDepth: payload.queueDepth,
      processed: payload.processed,
      failed: payload.failed,
    }),
  ]);
}
