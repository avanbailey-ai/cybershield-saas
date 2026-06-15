/**
 * Scan job status lookup — used by async /api/scan GET handler.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type ScanJobStatusValue = 'pending' | 'processing' | 'completed' | 'failed';

export interface ScanJobStatus {
  jobId: string;
  status: ScanJobStatusValue;
  websiteId: string;
  error?: string | null;
  score?: number;
  riskLevel?: string;
  scanId?: string;
}

function normalizeStatus(status: string): ScanJobStatusValue {
  if (status === 'done') return 'completed';
  return status as ScanJobStatusValue;
}

export async function getScanJobStatus(
  jobId: string,
  userId: string,
): Promise<ScanJobStatus | null> {
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from('scan_queue')
    .select('id, status, website_id, error, result')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!job) return null;

  const status = normalizeStatus(job.status);
  const storedResult = job.result as { score?: number; riskLevel?: string; scanId?: string } | null;

  const result: ScanJobStatus = {
    jobId: job.id,
    status,
    websiteId: job.website_id,
    error: job.error,
  };

  if (status === 'completed') {
    if (storedResult?.score !== undefined) {
      result.score = storedResult.score;
      result.riskLevel = storedResult.riskLevel;
      result.scanId = storedResult.scanId;
    } else {
      const { data: scan } = await supabase
        .from('scans')
        .select('id, security_score, risk_level')
        .eq('website_id', job.website_id)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scan) {
        result.scanId = scan.id;
        result.score = scan.security_score ?? undefined;
        result.riskLevel = scan.risk_level ?? undefined;
      }
    }
  }

  return result;
}

export async function getRecentScanForWebsite(
  websiteId: string,
  userId: string,
): Promise<{ scanId: string; score: number; riskLevel: string | null } | null> {
  const supabase = createAdminClient();

  const { data: scan } = await supabase
    .from('scans')
    .select('id, security_score, risk_level')
    .eq('website_id', websiteId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scan || scan.security_score === null) return null;

  return {
    scanId: scan.id,
    score: scan.security_score,
    riskLevel: scan.risk_level,
  };
}
