import type { SupabaseClient } from '@supabase/supabase-js';
import { emit } from '@/core/events/emit';
import { validateScanResult } from '@/core/scans/validateScanResult';
import { runScan, type ScanResult } from '@/lib/scanner/runScan';
import { postProcessScan } from '@/lib/scanner/postProcessScan';
import { runScanWorker, processQueue } from '@/lib/scanner/processQueue';
import { handleScanBatch } from '@/lib/scanner/handleScanBatch';
import { enqueueScan } from '@/lib/scanner/orchestrator';
import { updateScan } from './supabaseService';

export async function executeScan(url: string): Promise<ScanResult> {
  return runScan(url);
}

export async function saveScanResults(
  supabase: SupabaseClient,
  scanId: string,
  websiteId: string,
  userId: string,
  url: string,
  result: ScanResult,
): Promise<{ success: boolean; errors?: string[] }> {
  const validation = validateScanResult({
    score: result.score,
    issues: result.issues,
    url: result.url,
    expectedUrl: url,
  });

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  await postProcessScan({
    scanId,
    websiteId,
    userId,
    url,
    scanResult: result,
  });

  await emit({
    type: 'scanCompleted',
    payload: {
      scanId,
      websiteId,
      userId,
      score: result.score,
      riskLevel: result.riskLevel,
    },
  });

  return { success: true };
}

export async function processScanQueue(maxJobs?: number) {
  return processQueue(maxJobs);
}

export async function processScanBatch() {
  return handleScanBatch();
}

export async function runScanWorkerBatch(
  batchSize?: number,
  concurrency?: number,
) {
  return runScanWorker(batchSize, concurrency);
}

export { enqueueScan };

export async function markScanFailed(
  supabase: SupabaseClient,
  scanId: string,
  errorMessage: string,
): Promise<void> {
  await updateScan(supabase, scanId, {
    status: 'failed',
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  });
}
