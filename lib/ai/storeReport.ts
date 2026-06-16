import { createAdminClient } from '@/lib/supabase/admin';
import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';
import type { Plan } from '@/lib/billing/plans';
import { buildReport, type AiReportStatus } from './buildReport';
import { buildTemplateReport } from './generateSecurityReport';
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

/** Persist template report immediately — no AI, no cache lookups. */
export async function storeTemplateReport(params: StoreReportParams): Promise<StoredReport | null> {
  const {
    scanId,
    domain,
    userId,
    scanResult,
    autoShare = userId === null,
  } = params;

  const report = buildTemplateReport(scanResult);
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
    console.error('[storeReport] Failed to insert template scan_report:', error);
    throw error;
  }

  console.log(
    `[storeReport] Template report stored id=${data.id} domain=${domain} scanId=${scanId ?? 'none'}`,
  );

  return {
    id: data.id,
    shareToken: data.share_token,
    aiStatus: 'skipped',
    aiSkipReason: 'template_fallback',
  };
}

/** AI enhancement — async only; updates existing report row when gate allows. */
export async function enhanceStoredReportAsync(
  reportId: string,
  params: StoreReportParams,
): Promise<void> {
  const {
    scanId,
    domain,
    userId,
    scanResult,
    websiteId = null,
    plan = 'free',
    previousScan = null,
  } = params;

  try {
    const built = await buildReport({
      scanResult,
      websiteId,
      userId,
      plan,
      previousScan,
    });

    if (built.aiStatus === 'skipped') {
      console.log(
        `[storeReport] AI skipped for report=${reportId} scanId=${scanId ?? 'none'} reason=${built.aiSkipReason}`,
      );
      return;
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('scan_reports')
      .update({
        summary: built.report.summary,
        vulnerabilities: built.report.vulnerabilities,
        recommendations: built.report.recommendations,
        business_impact: built.report.businessImpact,
        urgency_statement: built.report.urgencyStatement ?? null,
      })
      .eq('id', reportId);

    if (error) {
      console.error('[storeReport] Failed to update report with AI content:', error);
      return;
    }

    console.log(
      `[storeReport] Report enhanced id=${reportId} domain=${domain} scanId=${scanId ?? 'none'} aiStatus=${built.aiStatus}`,
    );
  } catch (err) {
    console.error('[storeReport] AI enhancement failed (non-fatal):', err);
  }
}

/**
 * Store template report synchronously, then enhance with gated AI async.
 * Callers on the scan hot path get an immediate fallback report.
 */
export async function generateAndStoreReport(params: StoreReportParams): Promise<StoredReport | null> {
  const stored = await storeTemplateReport(params);
  if (stored) {
    void enhanceStoredReportAsync(stored.id, params).catch((err) =>
      console.error('[storeReport] Async AI enhancement failed:', err),
    );
  }
  return stored;
}
