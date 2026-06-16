/**
 * Scan queue worker — atomic claim, idempotent execution, controlled concurrency.
 *
 * Pairs with orchestrator.ts (enqueue gateway). Invoked by cron batch endpoints.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  claimScanJobs,
  claimScanJobById,
  reclaimStaleScanJobs,
} from '@/lib/queue/claimJobs';
import { runWithConcurrency, clampWorkerConcurrency } from '@/lib/queue/concurrency';
import {
  DEFAULT_MAX_ATTEMPTS,
  MAX_SCAN_BATCH,
  STALE_LOCK_MINUTES,
  getScanBatchLimit,
  getWorkerConcurrency,
} from '@/lib/queue/constants';
import type { QueueJob } from '@/lib/queue/scanJobTypes';
import { postProcessScan } from './postProcessScan';
import { runScanWithTimeout } from './runScanWithTimeout';
import { finalizeScanJob } from './finalizeScan';
import { logScanTiming } from '@/lib/observability/log';
import { trackServerEvent } from '@/lib/analytics/trackServerEvent';
import {
  addTraceStep,
  completeTrace,
  enrichError,
  logEvent,
  startTrace,
} from '@/lib/observability';
import { recordQueueDepth, recordScanDuration } from '@/lib/observability/metrics';
import { getScanQueueDepth } from '@/lib/observability/scanMetrics';

const RETRY_BASE_DELAY_MS = 30_000;

function retryDelayMs(attempts: number): number {
  return RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1));
}

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

async function markScanJobFailed(
  jobId: string,
  currentAttempts: number,
  maxAttempts: number,
  errorMessage: string,
  context?: { userId?: string; websiteId?: string; source?: string },
): Promise<'retry' | 'failed'> {
  const supabase = createAdminClient();
  const attempts = currentAttempts + 1;

  if (attempts < maxAttempts) {
    const scheduledFor = new Date(Date.now() + retryDelayMs(attempts)).toISOString();
    const { error: retryErr } = await supabase
      .from('scan_queue')
      .update({
        status: 'pending',
        attempts,
        error: errorMessage,
        result: { error: errorMessage },
        locked_at: null,
        started_at: null,
        scheduled_for: scheduledFor,
      })
      .eq('id', jobId);

    if (retryErr) {
      console.error(`[scanWorker] scan_queue retry update FAILED job=${jobId}:`, retryErr);
    } else {
      console.log(`[scanWorker] scan_queue retry scheduled job=${jobId} attempts=${attempts}`);
    }

    void logEvent({
      type: 'queue_retry_triggered',
      layer: 'queue',
      userId: context?.userId,
      metadata: {
        jobId,
        websiteId: context?.websiteId,
        attempts,
        maxAttempts,
        error: errorMessage,
        source: context?.source,
      },
    });

    return 'retry';
  } else {
    const { error: failErr } = await supabase
      .from('scan_queue')
      .update({
        status: 'failed',
        attempts,
        error: errorMessage,
        result: { error: errorMessage },
        completed_at: new Date().toISOString(),
        locked_at: null,
        scheduled_for: null,
      })
      .eq('id', jobId);

    if (failErr) {
      console.error(`[scanWorker] scan_queue failed update FAILED job=${jobId}:`, failErr);
    } else {
      console.log(`[scanWorker] scan_queue marked failed job=${jobId}`);
    }

    if (context?.userId) {
      void trackServerEvent(
        'scan_failed',
        {
          jobId,
          websiteId: context.websiteId,
          error: errorMessage,
          attempts,
          source: context.source,
          permanent: true,
        },
        context.userId,
      );
    }
    return 'failed';
  }
}

/** Confirm scan_queue left processing — force-fail if still stuck. */
async function ensureScanJobTerminal(jobId: string, reason: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from('scan_queue')
    .select('status, attempts, max_attempts')
    .eq('id', jobId)
    .maybeSingle();

  if (!row || row.status !== 'processing') return;

  console.warn(`[scanWorker] forcing terminal state job=${jobId} reason=${reason}`);
  await markScanJobFailed(
    jobId,
    row.attempts ?? 0,
    row.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
    reason,
  );
}

async function markScanJobCompleted(
  jobId: string,
  jobResult: { scanId: string; score: number; riskLevel: string },
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('scan_queue')
    .update({
      status: 'completed',
      result: jobResult,
      completed_at: new Date().toISOString(),
      locked_at: null,
      scheduled_for: null,
      error: null,
    })
    .eq('id', jobId);

  if (error) {
    console.error(`[scanWorker] scan_queue completed update FAILED job=${jobId}:`, error);
    return false;
  }

  console.log(`[scanWorker] scan_queue marked completed job=${jobId} scanId=${jobResult.scanId}`);
  return true;
}
/** Release a stuck processing lock if the job never reached a terminal state. */
async function releaseStuckProcessingLock(jobId: string, errorMessage: string): Promise<void> {
  await ensureScanJobTerminal(jobId, errorMessage);
}

async function processScanJob(job: QueueJob): Promise<ProcessResult> {
  const supabase = createAdminClient();
  const base = { jobId: job.id, websiteId: job.website_id, url: '' };
  const traceId = job.trace_id ?? undefined;
  let terminalUpdated = false;
  let result: ProcessResult = { ...base, success: false, error: 'unknown' };
  const workerStart = Date.now();

  const log = (msg: string, data?: unknown) =>
    console.log(`[scanWorker] job=${job.id} website=${job.website_id}`, msg, data ?? '');
  const logError = (msg: string, err: unknown) => {
    const enriched = enrichError(err, {
      layer: 'worker',
      traceId,
      jobId: job.id,
      metadata: { websiteId: job.website_id, msg },
    });
    console.error('[scanWorker] ERROR', {
      jobId: job.id,
      websiteId: job.website_id,
      msg,
      error: enriched.message,
      traceId,
    });
  };

  try {
    await addTraceStep(traceId ?? 'unknown', 'queue_pick', 'queue', {
      jobId: job.id,
      websiteId: job.website_id,
      priority: job.priority,
    });

    if (traceId) {
      await startTrace({
        traceId,
        name: 'scan_worker',
        userId: job.user_id,
        websiteId: job.website_id,
        jobId: job.id,
        metadata: { source: job.source },
      });
    }

    await logEvent({
      type: 'scan_started',
      layer: 'worker',
      userId: job.user_id,
      orgId: job.org_id,
      traceId,
      metadata: {
        jobId: job.id,
        websiteId: job.website_id,
        scanId: job.scan_id,
        source: job.source,
      },
    });
    const { data: fresh } = await supabase
      .from('scan_queue')
      .select('id, status, result, attempts, max_attempts, scan_id')
      .eq('id', job.id)
      .maybeSingle();

    if (!fresh) {
      terminalUpdated = true;
      result = { ...base, success: false, error: 'job_not_found' };
      return result;
    }

    if (fresh.status === 'completed') {
      const stored = fresh.result as { score?: number; riskLevel?: string } | null;
      log('already completed — skipping (idempotent)');
      terminalUpdated = true;
      result = {
        ...base,
        success: true,
        skipped: true,
        score: stored?.score,
        riskLevel: stored?.riskLevel,
      };
      return result;
    }

    if (fresh.result && typeof fresh.result === 'object' && 'scanId' in (fresh.result as object)) {
      log('has stored result — skipping re-run');
      const stored = fresh.result as { score?: number; riskLevel?: string; scanId?: string };
      await markScanJobCompleted(job.id, {
        scanId: stored.scanId ?? '',
        score: stored.score ?? 0,
        riskLevel: stored.riskLevel ?? 'low',
      });
      terminalUpdated = true;
      result = { ...base, success: true, skipped: true, score: stored.score, riskLevel: stored.riskLevel };
      return result;
    }

    if (fresh.status !== 'processing') {
      log(`unexpected status=${fresh.status} — skipping`);
      terminalUpdated = true;
      result = { ...base, success: false, skipped: true, error: `unexpected_status:${fresh.status}` };
      return result;
    }

    if (!job.source || job.source === 'unknown') {
      const errMsg = 'missing_source: bypassed orchestrator';
      await logEvent({
        type: 'scan_failed',
        layer: 'worker',
        userId: job.user_id,
        traceId,
        metadata: { jobId: job.id, error: errMsg },
      });
      if (traceId) await completeTrace(traceId, 'failed', { error: errMsg });
      await supabase
        .from('scan_queue')
        .update({
          status: 'failed',
          error: errMsg,
          result: { error: errMsg },
          completed_at: new Date().toISOString(),
          locked_at: null,
        })
        .eq('id', job.id);
      terminalUpdated = true;
      result = { ...base, success: false, error: 'missing_source' };
      return result;
    }

    const { data: website, error: wErr } = await supabase
      .from('websites')
      .select('id, url, user_id')
      .eq('id', job.website_id)
      .single();

    if (wErr || !website) {
      logError('website not found', wErr);
      await logEvent({
        type: 'scan_failed',
        layer: 'worker',
        userId: job.user_id,
        traceId,
        metadata: { jobId: job.id, error: 'Website not found' },
      });
      if (traceId) await completeTrace(traceId, 'failed', { error: 'Website not found' });
      await supabase
        .from('scan_queue')
        .update({
          status: 'failed',
          error: 'Website not found',
          result: { error: 'Website not found' },
          completed_at: new Date().toISOString(),
          locked_at: null,
        })
        .eq('id', job.id);
      terminalUpdated = true;
      result = { ...base, success: false, error: 'Website not found' };
      return result;
    }

    base.url = website.url;
    const orgId = job.org_id ?? null;
    const maxAttempts = fresh.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
    const currentAttempts = fresh.attempts ?? 0;

    const storedResult = fresh.result as { scanId?: string; score?: number; riskLevel?: string } | null;
    if (storedResult?.scanId) {
      log('reusing existing scan record from job result', { scanId: storedResult.scanId });
      terminalUpdated = true;
      result = {
        ...base,
        success: true,
        skipped: true,
        score: storedResult.score,
        riskLevel: storedResult.riskLevel,
      };
      if (fresh.status !== 'completed') {
        await markScanJobCompleted(job.id, {
          scanId: storedResult.scanId,
          score: storedResult.score ?? 0,
          riskLevel: storedResult.riskLevel ?? 'low',
        });
      }
      return result;
    }

    let scanRecordId!: string;
    const linkedScanId = job.scan_id ?? fresh.scan_id ?? null;

    if (linkedScanId) {
      scanRecordId = linkedScanId;
      const { error: runErr } = await supabase
        .from('scans')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
        })
        .eq('id', scanRecordId);
      if (runErr) {
        logError('failed to mark scan running', runErr);
      } else {
        log('scan record linked — marked running', { scanId: scanRecordId });
      }
    } else {
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
        await supabase.from('scan_queue').update({ scan_id: scanRecordId }).eq('id', job.id);
        log('scan record created', { scanId: scanRecordId });
      } catch (err) {
        logError('failed to create scan record', err);
        await logEvent({
          type: 'scan_failed',
          layer: 'worker',
          userId: website.user_id,
          traceId,
          metadata: { jobId: job.id, error: String(err) },
        });
        if (traceId) await completeTrace(traceId, 'failed', { error: String(err) });
        await markScanJobFailed(job.id, currentAttempts, maxAttempts, String(err), {
          userId: website.user_id,
          websiteId: job.website_id,
          source: job.source,
        });
        terminalUpdated = true;
        result = { ...base, success: false, error: String(err) };
        return result;
      }
    }

    let scanResult: Awaited<ReturnType<typeof runScanWithTimeout>> | null = null;
    const scanStart = Date.now();

    try {
      const workerRunStart = Date.now();
      log('running scan');
      scanResult = await runScanWithTimeout(website.url);
      await addTraceStep(traceId ?? 'unknown', 'worker_run', 'worker', {
        url: website.url,
        score: scanResult.score,
      }, Date.now() - workerRunStart);

      if (typeof scanResult.score !== 'number') throw new Error('Invalid scan result: score missing');
      if (!Array.isArray(scanResult.issues)) throw new Error('Invalid scan result: issues not array');

      logScanTiming(scanRecordId, Date.now() - scanStart);
      log('scan complete', { score: scanResult.score, riskLevel: scanResult.riskLevel });
    } catch (err) {
      const errMsg = String(err);
      const durationMs = Date.now() - scanStart;
      logError('scan failed', err);
      await logEvent({
        type: 'scan_failed',
        layer: 'worker',
        userId: website.user_id,
        traceId,
        metadata: { jobId: job.id, scanId: scanRecordId, error: errMsg, durationMs },
      });
      if (traceId) await completeTrace(traceId, 'failed', { scanId: scanRecordId, error: errMsg });

      await finalizeScanJob({
        scanId: scanRecordId,
        websiteId: website.id,
        jobId: job.id,
        status: 'failed',
        queueResult: { scanId: scanRecordId, error: errMsg },
        errorMessage: errMsg,
        durationMs,
        userId: website.user_id,
      });

      terminalUpdated = true;
      result = { ...base, success: false, error: errMsg };
      return result;
    }

    try {
      const postResult = await postProcessScan({
        scanId: scanRecordId,
        websiteId: website.id,
        userId: website.user_id,
        url: website.url,
        scanResult,
        jobId: job.id,
      });
      await addTraceStep(traceId ?? 'unknown', 'db_save', 'worker', { scanId: scanRecordId });

      if (!postResult.success) {
        logError('postProcessScan failed', postResult.error);
        await logEvent({
          type: 'scan_failed',
          layer: 'worker',
          userId: website.user_id,
          traceId,
          metadata: { jobId: job.id, scanId: scanRecordId, error: postResult.error },
        });
        if (traceId) {
          await completeTrace(traceId, 'failed', { scanId: scanRecordId, error: postResult.error });
        }
        terminalUpdated = true;
        result = { ...base, success: false, error: postResult.error };
        return result;
      }
    } catch (err) {
      logError('postProcessScan unexpected error', err);
      await ensureScanJobTerminal(job.id, String(err));
      terminalUpdated = true;
      result = { ...base, success: false, error: String(err) };
      return result;
    }

    const jobResult = {
      scanId: scanRecordId,
      score: scanResult.score,
      riskLevel: scanResult.riskLevel,
    };

    void trackServerEvent(
      'scan_completed',
      {
        jobId: job.id,
        websiteId: job.website_id,
        scanId: scanRecordId,
        score: scanResult.score,
        riskLevel: scanResult.riskLevel,
        source: job.source,
      },
      website.user_id,
    );

    await logEvent({
      type: 'scan_completed',
      layer: 'worker',
      userId: website.user_id,
      orgId: orgId,
      traceId,
      metadata: {
        jobId: job.id,
        scanId: scanRecordId,
        score: scanResult.score,
        riskLevel: scanResult.riskLevel,
      },
    });
    if (traceId) {
      await completeTrace(traceId, 'completed', {
        scanId: scanRecordId,
        score: scanResult.score,
        riskLevel: scanResult.riskLevel,
      });
    }

    void recordScanDuration(Date.now() - workerStart, {
      priority: job.priority,
      success: true,
    });

    terminalUpdated = true;
    result = {
      jobId: job.id,
      websiteId: job.website_id,
      url: website.url,
      success: true,
      score: scanResult.score,
      riskLevel: scanResult.riskLevel,
    };
    return result;
  } catch (err) {
    logError('unexpected worker error', err);
    await logEvent({
      type: 'scan_failed',
      layer: 'worker',
      userId: job.user_id,
      traceId,
      metadata: { jobId: job.id, error: String(err) },
    });
    if (traceId) await completeTrace(traceId, 'failed', { error: String(err) });
    void recordScanDuration(Date.now() - workerStart, {
      priority: job.priority,
      success: false,
    });
    if (!terminalUpdated) {
      await releaseStuckProcessingLock(job.id, String(err));
      terminalUpdated = true;
    }
    result = { ...base, success: false, error: String(err) };
    return result;
  } finally {
    if (!terminalUpdated) {
      await releaseStuckProcessingLock(job.id, 'worker_exit_without_terminal_state');
    }
  }
}

export async function runScanWorker(
  batchSize = getScanBatchLimit(),
  concurrency = getWorkerConcurrency(),
  preferJobId?: string,
): Promise<ScanWorkerResult> {
  const cappedBatch = Math.min(Math.max(1, batchSize), MAX_SCAN_BATCH);
  const cappedConcurrency = clampWorkerConcurrency(concurrency);

  const reclaimed = await reclaimStaleScanJobs(STALE_LOCK_MINUTES);

  const jobs: QueueJob[] = [];
  if (preferJobId) {
    try {
      const targeted = await claimScanJobById(preferJobId);
      if (targeted) jobs.push(targeted);
    } catch (err) {
      console.error(`[scanWorker] targeted claim failed jobId=${preferJobId}`, err);
    }
  }

  const remaining = Math.max(0, cappedBatch - jobs.length);
  if (remaining > 0) {
    const batchJobs = await claimScanJobs(remaining);
    for (const job of batchJobs) {
      if (!jobs.some((j) => j.id === job.id)) jobs.push(job);
    }
  }

  console.log(
    `[scanWorker] ${new Date().toISOString()} — claimed ${jobs.length} job(s) (cap=${cappedBatch}, concurrency=${cappedConcurrency}, reclaimed=${reclaimed})`,
  );

  if (jobs.length === 0) {
    return { reclaimed, processed: 0, succeeded: 0, failed: 0, skipped: 0, results: [] };
  }

  const results: ProcessResult[] = [];

  await runWithConcurrency(jobs, cappedConcurrency, async (job) => {
    results.push(await processScanJob(job));
  });

  const succeeded = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  const queueDepth = await getScanQueueDepth();
  void recordQueueDepth(queueDepth);

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
  maxJobs = getScanBatchLimit(),
): Promise<{ processed: number; succeeded: number; failed: number; results: ProcessResult[] }> {
  const result = await runScanWorker(maxJobs);
  return {
    processed: result.processed,
    succeeded: result.succeeded + result.skipped,
    failed: result.failed,
    results: result.results,
  };
}
