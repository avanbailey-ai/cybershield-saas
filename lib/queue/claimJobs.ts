/**
 * Atomic job claiming via Postgres FOR UPDATE SKIP LOCKED (multi-instance safe).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { QueueJob } from '@/lib/queue/scanJobTypes';
import { STALE_LOCK_MINUTES } from './constants';

export interface EmailQueueJob {
  id: string;
  user_id: string | null;
  type: string | null;
  template: string;
  email: string;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  scheduled_for: string;
  locked_at: string | null;
  created_at: string;
}

export async function reclaimStaleScanJobs(
  staleMinutes = STALE_LOCK_MINUTES,
): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('reclaim_stale_scan_jobs', {
    p_stale_minutes: staleMinutes,
  });

  if (error) {
    console.error('[claimJobs] reclaimStaleScanJobs failed', error);
    return 0;
  }

  const reclaimed = typeof data === 'number' ? data : 0;
  if (reclaimed > 0) {
    console.log(`[claimJobs] reclaimed ${reclaimed} stale scan job(s)`);

    const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
    await supabase
      .from('scans')
      .update({ status: 'failed', error_message: 'worker_crashed' })
      .eq('status', 'running')
      .lt('started_at', staleThreshold);
  }

  return reclaimed;
}

function getWorkerId(): string {
  return process.env.SCAN_WORKER_ID ?? `worker-${process.pid}`;
}

export async function claimScanJobs(limit: number): Promise<QueueJob[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('claim_scan_jobs', {
    p_limit: limit,
    p_worker_id: getWorkerId(),
  });

  if (error) {
    console.error(
      '[claimJobs] claimScanJobs failed — worker will process 0 jobs',
      { limit, workerId: getWorkerId(), code: error.code, message: error.message, details: error.details },
    );
    return [];
  }

  return (data ?? []) as QueueJob[];
}

export async function reclaimStaleEmailJobs(
  staleMinutes = STALE_LOCK_MINUTES,
): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('reclaim_stale_email_jobs', {
    p_stale_minutes: staleMinutes,
  });

  if (error) {
    console.error('[claimJobs] reclaimStaleEmailJobs failed', error);
    return 0;
  }

  const reclaimed = typeof data === 'number' ? data : 0;
  if (reclaimed > 0) {
    console.log(`[claimJobs] reclaimed ${reclaimed} stale email job(s)`);
  }

  return reclaimed;
}

export async function claimEmailJobs(limit: number): Promise<EmailQueueJob[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('claim_email_jobs', { p_limit: limit });

  if (error) {
    console.error('[claimJobs] claimEmailJobs failed', error);
    return [];
  }

  return (data ?? []) as EmailQueueJob[];
}
