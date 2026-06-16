import { createAdminClient } from '@/lib/supabase/admin';
import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';
import type { Plan } from '@/lib/billing/plans';
import { buildReport, type AiReportStatus } from './buildReport';
import { generateShareToken } from '@/lib/share/token';

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

export interface StoredReport {
  id: string;
  shareToken: string | null;
  aiStatus: AiReportStatus;
  aiSkipReason?: string;
}

export async function generateAndStoreReport(params: {
  scanId: string | null;
  domain: string;
  userId: string | null;
  scanResult: ScanResult;
  autoShare?: boolean;
  websiteId?: string | null;
  plan?: Plan;
  previousScan?: {
    securityScore: number | null;
    issues: string[] | null;
    snapshot: ScanSnapshot | null;
  } | null;
}): Promise<StoredReport | null> {
  const {
    scanId,
    domain,
    userId,
    scanResult,
    autoShare = userId === null,
    websiteId = null,
    plan = 'free',
    previousScan = null,
  } = params;

  const built = await buildReport({
    scanResult,
    websiteId,
    userId,
    plan,
    previousScan,
  });

  const report = built.report;
  const riskScore = 100 - scanResult.score;
  const shareToken = autoShare ? generateShareToken() : null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('scan_reports')
    .insert({
      scan_id: scanId,
      user_id: userId,
      domain,
      risk_score: riskScore,
      summary: report.summary,
      vulnerabilities: report.vulnerabilities,
      recommendations: report.recommendations,
      business_impact: report.businessImpact,
      urgency_statement: report.urgencyStatement ?? null,
      share_token: shareToken,
      is_public: autoShare,
      share_approved_at: autoShare ? new Date().toISOString() : null,
    })
    .select('id, share_token')
    .single();

  if (error) {
    console.error('[storeReport] Failed to insert scan_report:', error);
    throw error;
  }

  console.log(
    `[storeReport] Report stored id=${data.id} domain=${domain} scanId=${scanId ?? 'none'} aiStatus=${built.aiStatus}`,
  );
  return {
    id: data.id,
    shareToken: data.share_token,
    aiStatus: built.aiStatus,
    aiSkipReason: built.aiSkipReason,
  };
}
