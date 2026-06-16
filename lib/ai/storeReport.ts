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
}

export interface StoreReportParams {
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
}

/** Persist deterministic report — Security Intelligence Engine only, no OpenAI. */
export async function storeReport(params: StoreReportParams): Promise<StoredReport | null> {
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
  const riskScore = 100 - built.intelligence.securityScore;
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
    `[storeReport] Deterministic report stored id=${data.id} domain=${domain} scanId=${scanId ?? 'none'} score=${built.intelligence.securityScore}`,
  );

  return {
    id: data.id,
    shareToken: data.share_token,
    aiStatus: 'deterministic',
  };
}

/** @deprecated Use storeReport — async AI enhancement removed. */
export async function storeTemplateReport(params: StoreReportParams): Promise<StoredReport | null> {
  return storeReport(params);
}

/** @deprecated AI enhancement removed — no-op. */
export async function enhanceStoredReportAsync(
  _reportId: string,
  _params: StoreReportParams,
): Promise<void> {
  // Deterministic engine only — no async OpenAI enhancement.
}

/** Store deterministic report synchronously. */
export async function generateAndStoreReport(params: StoreReportParams): Promise<StoredReport | null> {
  return storeReport(params);
}
