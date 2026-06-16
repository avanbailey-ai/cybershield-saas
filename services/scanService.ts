import type { SupabaseClient } from '@supabase/supabase-js';
import { emit } from '@/core/events/emit';
import { validateScanResult } from '@/core/scans/validateScanResult';
import { runScan, type ScanResult } from '@/lib/scanner/runScan';
import { postProcessScan } from '@/lib/scanner/postProcessScan';
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

  const postResult = await postProcessScan({
    scanId,
    websiteId,
    userId,
    url,
    scanResult: result,
  });

  if (!postResult.success) {
    return { success: false, errors: [postResult.error ?? 'post_process_failed'] };
  }

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
