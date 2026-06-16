/**
 * Scan finalizer — guarantees scans + scan_queue reach terminal state.
 * Used by worker and post-process paths (try/catch/finally safety net).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/observability';

export type ScanTerminalStatus = 'completed' | 'failed';

export interface ScanQueueFinalizeResult {
  scanId?: string;
  score?: number;
  riskLevel?: string;
  error?: string;
}

function logDbWrite(
  outcome: 'success' | 'failure',
  entity: 'scans' | 'scan_queue',
  meta: Record<string, unknown>,
  error?: string,
): void {
  const payload = {
    type: `db_write_${outcome}`,
    entity,
    ...meta,
    ts: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
  if (outcome === 'failure') {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

/** Mark scans row terminal (completed or failed). */
export async function finalizeScanRecord(params: {
  scanId: string;
  websiteId: string;
  status: ScanTerminalStatus;
  errorMessage?: string | null;
  durationMs?: number;
  userId?: string;
}): Promise<boolean> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('scans')
    .update({
      status: params.status,
      completed_at: now,
      ...(params.errorMessage ? { error_message: params.errorMessage } : {}),
    })
    .eq('id', params.scanId);

  if (error) {
    logDbWrite('failure', 'scans', {
      scanId: params.scanId,
      websiteId: params.websiteId,
      status: params.status,
      durationMs: params.durationMs,
    }, error.message);
    return false;
  }

  logDbWrite('success', 'scans', {
    scanId: params.scanId,
    websiteId: params.websiteId,
    status: params.status,
    durationMs: params.durationMs,
  });

  const eventType = params.status === 'completed' ? 'scan_completed' : 'scan_failed';
  void logEvent({
    type: eventType,
    layer: 'worker',
    userId: params.userId,
    metadata: {
      scanId: params.scanId,
      websiteId: params.websiteId,
      durationMs: params.durationMs,
      error: params.errorMessage,
    },
  });

  return true;
}

/** Guarantee scan_queue reaches completed or failed. */
export async function finalizeScanQueueJob(
  jobId: string,
  status: ScanTerminalStatus,
  result: ScanQueueFinalizeResult,
  errorMessage?: string | null,
  meta?: { websiteId?: string; scanId?: string; durationMs?: number },
): Promise<boolean> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row } = await supabase
    .from('scan_queue')
    .select('status')
    .eq('id', jobId)
    .maybeSingle();

  if (row?.status === 'completed' || row?.status === 'failed') {
    return true;
  }

  const payload =
    status === 'completed'
      ? {
          status: 'completed' as const,
          result,
          completed_at: now,
          locked_at: null,
          locked_by: null,
          expires_at: null,
          scheduled_for: null,
          error: null,
        }
      : {
          status: 'failed' as const,
          result,
          error: errorMessage ?? result.error ?? 'scan_failed',
          completed_at: now,
          locked_at: null,
          locked_by: null,
          expires_at: null,
          scheduled_for: null,
        };

  const { error } = await supabase.from('scan_queue').update(payload).eq('id', jobId);

  if (error) {
    logDbWrite('failure', 'scan_queue', {
      jobId,
      websiteId: meta?.websiteId,
      scanId: meta?.scanId ?? result.scanId,
      status,
      durationMs: meta?.durationMs,
    }, error.message);
    return false;
  }

  logDbWrite('success', 'scan_queue', {
    jobId,
    websiteId: meta?.websiteId,
    scanId: meta?.scanId ?? result.scanId,
    status,
    durationMs: meta?.durationMs,
  });

  return true;
}

/** Finalize both scans + scan_queue in one call. */
export async function finalizeScanJob(params: {
  scanId: string;
  websiteId: string;
  jobId?: string;
  status: ScanTerminalStatus;
  queueResult: ScanQueueFinalizeResult;
  errorMessage?: string | null;
  durationMs?: number;
  userId?: string;
}): Promise<{ scanOk: boolean; queueOk: boolean }> {
  const scanOk = await finalizeScanRecord({
    scanId: params.scanId,
    websiteId: params.websiteId,
    status: params.status,
    errorMessage: params.errorMessage,
    durationMs: params.durationMs,
    userId: params.userId,
  });

  let queueOk = true;
  if (params.jobId) {
    queueOk = await finalizeScanQueueJob(
      params.jobId,
      params.status,
      params.queueResult,
      params.errorMessage,
      {
        websiteId: params.websiteId,
        scanId: params.scanId,
        durationMs: params.durationMs,
      },
    );
  }

  return { scanOk, queueOk };
}
