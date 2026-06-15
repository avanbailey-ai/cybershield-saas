/** Scan worker batch metrics — persisted to scan_worker_metrics + structured logs. */

import { createAdminClient } from '@/lib/supabase/admin';

export type ScanWorkerEventType = 'batch_complete' | 'batch_empty' | 'batch_error';

export interface ScanWorkerMetricsPayload {
  eventType: ScanWorkerEventType;
  queueDepth: number;
  processed: number;
  failed: number;
  skipped: number;
  reclaimed: number;
  durationMs: number;
}

export async function getScanQueueDepth(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('scan_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']);

    if (error) {
      console.error('[scanMetrics] queue depth query failed', error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error('[scanMetrics] queue depth query threw', err);
    return 0;
  }
}

export async function recordScanWorkerMetrics(payload: ScanWorkerMetricsPayload): Promise<void> {
  const row = {
    event_type: payload.eventType,
    queue_depth: payload.queueDepth,
    processed: payload.processed,
    failed: payload.failed,
    duration_ms: payload.durationMs,
  };

  console.log(
    JSON.stringify({
      type: 'scan_worker_batch',
      ...payload,
      ts: new Date().toISOString(),
    }),
  );

  try {
    const supabase = createAdminClient();
    await supabase.from('scan_worker_metrics').insert(row);
  } catch (err) {
    console.error('[scanMetrics] insert failed (non-fatal)', err);
  }
}
