/**
 * Scan job status lookup — used by async /api/scan GET handler.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface ScanJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  websiteId: string;
  error?: string | null;
  score?: number;
  riskLevel?: string;
  scanId?: string;
}

export async function getScanJobStatus(
  jobId: string,
  userId: string,
): Promise<ScanJobStatus | null> {
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from('scan_queue')
    .select('id, status, website_id, error')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!job) return null;

  const result: ScanJobStatus = {
    jobId: job.id,
    status: job.status as ScanJobStatus['status'],
    websiteId: job.website_id,
    error: job.error,
  };

  if (job.status === 'done') {
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
