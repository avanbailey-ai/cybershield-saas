/**
 * Scan queue worker — atomic claim, idempotent execution, controlled concurrency.
 *
 * Pairs with orchestrator.ts (enqueue gateway). Invoked only by /api/workers/process-scans.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  claimScanJobs,
  reclaimStaleScanJobs,
} from '@/lib/queue/claimJobs';
import { runWithConcurrency } from '@/lib/queue/concurrency';
import {
  DEFAULT_MAX_ATTEMPTS,
  SCAN_BATCH_SIZE,
  STALE_LOCK_MINUTES,
  WORKER_CONCURRENCY,
} from '@/lib/queue/constants';
import type { QueueJob } from './queue';
import { runScan } from './runScan';
import { postProcessScan } from './postProcessScan';
import { logScanTiming } from '@/lib/observability/log';

export interface ProcessResult {
  jobId: string;
  websiteId: string;
  url: string;
  success: boolean;
  score?: number;
  riskLevel?: string;
  error?: string;
  skipped?: boolean;
}

export interface ScanWorkerResult {
  reclaimed: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: ProcessResult[];
}

async function processScanJob(job: QueueJob): Promise<ProcessResult> {
  const supabase = createAdminClient();
  const base = { jobId: job.id, websiteId: job.website_id, url: '' };

  const { data: fresh } = await supabase
    .from('scan_queue')
    .select('id, status, result, attempts, max_attempts')
    .eq('id', job.id)
    .maybeSingle();

  if (!fresh) {
    return { ...base, success: false, error: 'job_not_found' };
  }

  if (fresh.status === 'completed') {
    const stored = fresh.result as { score?: number; riskLevel?: string } | null;
    console.log(`[scanWorker] job=${job.id} already completed — skipping (idempotent)`);
    return {
      ...base,
      success: true,
      skipped: true,
      score: stored?.score,
      riskLevel: stored?.riskLevel,
    };
  }

  if (fresh.result && typeof fresh.result === 'object' && 'scanId' in (fresh.result as object)) {
    console.log(`[scanWorker] job=${job.id} has stored result — skipping re-run`);
    await supabase
      .from('scan_queue')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);
    const stored = fresh.result as { score?: number; riskLevel?: string };
    return { ...base, success: true, skipped: true, score: stored.score, riskLevel: stored.riskLevel };
  }

  const log = (msg: string, data?: unknown) =>
    console.log(`[scanWorker] job=${job.id} website=${job.website_id}`, msg, data ?? '');
  const logError = (msg: string, err: unknown) =>
    console.error('[scanWorker] ERROR', { jobId: job.id, websiteId: job.website_id, msg, error: err });

  if (!job.source || job.source === 'unknown') {
    await supabase
      .from('scan_queue')
      .update({
        status: 'failed',
        error: 'missing_source: bypassed orchestrator',
        completed_at: new Date().toISOString(),
        locked_at: null,
      })
      .eq('id', job.id);
    return { ...base, success: false, error: 'missing_source' };
  }

  const { data: website, error: wErr } = await supabase
    .from('websites')
    .select('id, url, user_id')
    .eq('id', job.website_id)
    .single();

  if (wErr || !website) {
    logError('website not found', wErr);
    await supabase
      .from('scan_queue')
      .update({
        status: 'failed',
        error: 'Website not found',
        completed_at: new Date().toISOString(),
        locked_at: null,
      })
      .eq('id', job.id);
    return { ...base, success: false, error: 'Website not found' };
  }

  let scanRecordId!: string;
  const orgId = job.org_id ?? null;

  try {
    const { data: scan, error: scanErr } = await supabase
      .from('scans')
      .insert({
        website_id: website.id,
        user_id: website.user_id,
        org_id: orgId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (scanErr) throw scanErr;
    scanRecordId = scan.id;
    log('scan record created', { scanId: scanRecordId });
  } catch (err) {
    logError('failed to create scan record', err);
    await markScanJobFailed(job.id, fresh.attempts ?? 0, fresh.max_attempts ?? DEFAULT_MAX_ATTEMPTS, String(err));
    return { ...base, url: website.url, success: false, error: String(err) };
  }

  let scanResult: Awaited<ReturnType<typeof runScan>> | null = null;
  const scanStart = Date.now();

  try {
    log('running scan');
    scanResult = await runScan(website.url);

    if (typeof scanResult.score !== 'number') throw new Error('Invalid scan result: score missing');
    if (!Array.isArray(scanResult.issues)) throw new Error('Invalid scan result: issues not array');

    logScanTiming(scanRecordId, Date.now() - scanStart);
    log('scan complete', { score: scanResult.score, riskLevel: scanResult.riskLevel });
  } catch (err) {
    logError('scan failed', err);
    await supabase
      .from('scans')
      .update({ status: 'failed', error_message: String(err), completed_at: new Date().toISOString() })
      .eq('id', scanRecordId);

    await markScanJobFailed(job.id, fresh.attempts ?? 0, fresh.max_attempts ?? DEFAULT_MAX_ATTEMPTS, String(err));
    return { ...base, url: website.url, success: false, error: String(err) };
  }

  try {
    await postProcessScan({
      scanId: scanRecordId,
      websiteId: website.id,
      userId: website.user_id,
      url: website.url,
      scanResult,
    });
  } catch (err) {
    logError('postProcessScan failed', err);
    await supabase
      .from('scans')
      .update({ status: 'failed', error_message: String(err), completed_at: new Date().toISOString() })
      .eq('id', scanRecordId);
    await supabase
      .from('scan_queue')
      .update({
        status: 'failed',
        error: String(err),
        completed_at: new Date().toISOString(),
        locked_at: null,
      })
      .eq('id', job.id);
    return { ...base, url: website.url, success: false, error: String(err) };
  }

  const jobResult = {
    scanId: scanRecordId,
    score: scanResult.score,
    riskLevel: scanResult.riskLevel,
  };

  await supabase
    .from('scan_queue')
    .update({
      status: 'completed',
      result: jobResult,
      completed_at: new Date().toISOString(),
      locked_at: null,
      error: null,
    })
    .eq('id', job.id);

  return {
    jobId: job.id,
    websiteId: job.website_id,
    url: website.url,
    success: true,
    score: scanResult.score,
    riskLevel: scanResult.riskLevel,
  };
}

async function markScanJobFailed(
  jobId: string,
  currentAttempts: number,
  maxAttempts: number,
  errorMessage: string,
): Promise<void> {
  const supabase = createAdminClient();
  const attempts = currentAttempts + 1;

  if (attempts < maxAttempts) {
    await supabase
      .from('scan_queue')
      .update({
        status: 'pending',
        attempts,
        error: errorMessage,
        locked_at: null,
        started_at: null,
      })
      .eq('id', jobId);
  } else {
    await supabase
      .from('scan_queue')
      .update({
        status: 'failed',
        attempts,
        error: errorMessage,
        completed_at: new Date().toISOString(),
        locked_at: null,
      })
      .eq('id', jobId);
  }
}

export async function runScanWorker(
  batchSize = SCAN_BATCH_SIZE,
  concurrency = WORKER_CONCURRENCY,
): Promise<ScanWorkerResult> {
  const reclaimed = await reclaimStaleScanJobs(STALE_LOCK_MINUTES);
  const jobs = await claimScanJobs(batchSize);

  console.log(
    `[scanWorker] ${new Date().toISOString()} — claimed ${jobs.length} job(s) (cap=${batchSize}, reclaimed=${reclaimed})`,
  );

  if (jobs.length === 0) {
    return { reclaimed, processed: 0, succeeded: 0, failed: 0, skipped: 0, results: [] };
  }

  const results: ProcessResult[] = [];

  await runWithConcurrency(jobs, concurrency, async (job) => {
    results.push(await processScanJob(job));
  });

  const succeeded = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    reclaimed,
    processed: jobs.length,
    succeeded,
    failed,
    skipped,
    results,
  };
}

/** @deprecated Use runScanWorker — kept for legacy route delegation. */
export async function processQueue(
  maxJobs = SCAN_BATCH_SIZE,
): Promise<{ processed: number; succeeded: number; failed: number; results: ProcessResult[] }> {
  const result = await runScanWorker(maxJobs);
  return {
    processed: result.processed,
    succeeded: result.succeeded + result.skipped,
    failed: result.failed,
    results: result.results,
  };
}
