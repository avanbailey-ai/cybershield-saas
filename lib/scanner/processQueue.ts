/**
 * processQueue.ts — Queue worker (execution only).
 *
 * Responsibilities (and ONLY these):
 *   1. Recover stale "processing" jobs (> 15 min) → reset to pending
 *   2. Atomically claim pending jobs (no double-processing)
 *   3. Call runScan() to execute the scan
 *   4. Call postProcessScan() for all side effects (DB, alerts, email)
 *   5. Mark job done or failed
 *
 * NOT responsible for: cooldown logic, dedup logic, rate limits,
 * alert creation, email sending. Those live in orchestrator.ts and postProcessScan.ts.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPendingJobs } from './queue';
import { runScan } from './runScan';
import { postProcessScan } from './postProcessScan';

// Jobs stuck in "processing" beyond this threshold are considered stale and recovered
const STALE_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

export interface ProcessResult {
  jobId: string;
  websiteId: string;
  url: string;
  success: boolean;
  score?: number;
  riskLevel?: string;
  error?: string;
}

export async function processQueue(
  maxJobs = 5,
): Promise<{ processed: number; succeeded: number; failed: number; results: ProcessResult[] }> {
  const supabase = createAdminClient();

  // Recover stale "processing" jobs that have been stuck for > 15 minutes
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_TIMEOUT_MS).toISOString();
  const { data: recoveredJobs } = await supabase
    .from('scan_queue')
    .update({ status: 'pending', started_at: null })
    .eq('status', 'processing')
    .lt('started_at', staleThreshold)
    .select('id');

  if (recoveredJobs && recoveredJobs.length > 0) {
    console.log(
      `[QUEUE PROCESSOR] ${new Date().toISOString()} — recovered ${recoveredJobs.length} stale processing job(s) → pending`,
    );

    // Also mark any associated 'running' scan records as 'failed' (they are orphaned)
    const { error: scanResetError } = await supabase
      .from('scans')
      .update({ status: 'failed', error_message: 'worker_crashed' })
      .eq('status', 'running')
      .lt('started_at', staleThreshold);

    if (scanResetError) {
      console.error('[QUEUE PROCESSOR] Failed to reset orphaned scan records', scanResetError);
    } else {
      console.log(`[QUEUE PROCESSOR] Reset ${recoveredJobs.length} stale jobs + orphaned scan records`);
    }
  }

  const jobs = await fetchPendingJobs(maxJobs);

  console.log(
    `[QUEUE PROCESSOR] ${new Date().toISOString()} — found ${jobs.length} pending job(s) (cap=${maxJobs})`,
  );

  if (jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  const results: ProcessResult[] = [];
  let succeeded = 0;

  for (const job of jobs) {
    const log = (msg: string, data?: unknown) =>
      console.log(`[Worker] job=${job.id} website=${job.website_id}`, msg, data ?? '');
    const logError = (msg: string, err: unknown) =>
      console.error('[Worker] ERROR', { jobId: job.id, websiteId: job.website_id, msg, error: err });

    // Atomically claim the job — only proceeds if it is still "pending"
    // Prevents two concurrent workers from processing the same job
    const { data: claimedRows } = await supabase
      .from('scan_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id');

    if (!claimedRows || claimedRows.length === 0) {
      log('job already claimed by another worker, skipping');
      continue;
    }

    // Guard: reject jobs that have no source — indicates they bypassed the orchestrator
    if (!job.source || job.source === 'unknown') {
      console.error(
        '[WORKER] Job has no source — possible orchestrator bypass. Marking failed.',
        { jobId: job.id, websiteId: job.website_id },
      );
      await supabase
        .from('scan_queue')
        .update({ status: 'failed', error: 'missing_source: bypassed orchestrator', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      results.push({ jobId: job.id, websiteId: job.website_id, url: '', success: false, error: 'missing_source' });
      continue;
    }

    // Get website URL and owner
    const { data: website, error: wErr } = await supabase
      .from('websites')
      .select('id, url, user_id')
      .eq('id', job.website_id)
      .single();

    if (wErr || !website) {
      logError('website not found', wErr);
      await supabase
        .from('scan_queue')
        .update({ status: 'failed', error: 'Website not found', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      results.push({ jobId: job.id, websiteId: job.website_id, url: '', success: false, error: 'Website not found' });
      continue;
    }

    // Create a scan record to track this execution
    let scanRecordId!: string;
    try {
      const { data: scan, error: scanErr } = await supabase
        .from('scans')
        .insert({
          website_id: website.id,
          user_id: website.user_id,
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
      await supabase
        .from('scan_queue')
        .update({ status: 'failed', error: String(err), completed_at: new Date().toISOString() })
        .eq('id', job.id);
      results.push({ jobId: job.id, websiteId: job.website_id, url: website.url, success: false, error: String(err) });
      continue;
    }

    // Execute the scan
    let scanResult: Awaited<ReturnType<typeof runScan>> | null = null;
    try {
      log('running scan');
      scanResult = await runScan(website.url);

      if (typeof scanResult.score !== 'number') throw new Error('Invalid scan result: score missing');
      if (!Array.isArray(scanResult.issues)) throw new Error('Invalid scan result: issues not array');

      log('scan complete', { score: scanResult.score, riskLevel: scanResult.riskLevel });
    } catch (err) {
      logError('scan failed', err);
      await supabase
        .from('scans')
        .update({ status: 'failed', error_message: String(err), completed_at: new Date().toISOString() })
        .eq('id', scanRecordId);
      await supabase
        .from('scan_queue')
        .update({ status: 'failed', error: String(err), completed_at: new Date().toISOString() })
        .eq('id', job.id);
      results.push({ jobId: job.id, websiteId: job.website_id, url: website.url, success: false, error: String(err) });
      continue;
    }

    // Hand off ALL post-scan side effects to the centralized post-processor
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
        .update({ status: 'failed', error: String(err), completed_at: new Date().toISOString() })
        .eq('id', job.id);
      results.push({ jobId: job.id, websiteId: job.website_id, url: website.url, success: false, error: String(err) });
      continue;
    }

    // Mark job done — only reachable on full success
    await supabase
      .from('scan_queue')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    succeeded++;
    results.push({
      jobId: job.id,
      websiteId: job.website_id,
      url: website.url,
      success: true,
      score: scanResult.score,
      riskLevel: scanResult.riskLevel,
    });
  }

  return { processed: jobs.length, succeeded, failed: jobs.length - succeeded, results };
}
