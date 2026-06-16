/**
 * Atomic job claiming via Postgres FOR UPDATE SKIP LOCKED (multi-instance safe).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { QueueJob } from '@/lib/queue/scanJobTypes';
import { logEvent } from '@/lib/observability';
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

export async function claimScanJobById(jobId: string): Promise<QueueJob | null> {
  const supabase = createAdminClient();
  const workerId = getWorkerId();
  const { data, error } = await supabase.rpc('claim_scan_job_by_id', {
    p_job_id: jobId,
    p_worker_id: workerId,
  });

  if (error) {
    console.error('[claimJobs] claimScanJobById failed', {
      jobId,
      workerId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(`claim_scan_job_by_id failed: ${error.message}`);
  }

  const rows = (data ?? []) as QueueJob[];
  const job = rows[0] ?? null;
  if (job) {
    console.log(`[claimJobs] job_claimed targeted jobId=${job.id} workerId=${workerId}`);
    void logEvent({
      type: 'job_claimed',
      layer: 'queue',
      userId: job.user_id,
      metadata: { jobId: job.id, websiteId: job.website_id, workerId, targeted: true },
    });
  }
  return job;
}

export async function claimScanJobs(limit: number): Promise<QueueJob[]> {
  const supabase = createAdminClient();
  const workerId = getWorkerId();
  const { data, error } = await supabase.rpc('claim_scan_jobs', {
    p_limit: limit,
    p_worker_id: workerId,
  });

  if (error) {
    console.error('[claimJobs] claimScanJobs failed', {
      limit,
      workerId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(`claim_scan_jobs failed: ${error.message}`);
  }

  const jobs = (data ?? []) as QueueJob[];
  for (const job of jobs) {
    console.log(`[claimJobs] job_claimed jobId=${job.id} workerId=${workerId}`);
    void logEvent({
      type: 'job_claimed',
      layer: 'queue',
      userId: job.user_id,
      metadata: { jobId: job.id, websiteId: job.website_id, workerId, targeted: false },
    });
  }
  return jobs;
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
