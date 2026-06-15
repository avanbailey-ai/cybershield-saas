import { createAdminClient } from '@/lib/supabase/admin';
import type { ScanResult } from '@/lib/scanner/runScan';
import { generateSecurityReport } from './generateSecurityReport';
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
}

export async function generateAndStoreReport(params: {
  scanId: string | null;
  domain: string;
  userId: string | null;
  scanResult: ScanResult;
  autoShare?: boolean;
}): Promise<StoredReport | null> {
  const { scanId, domain, userId, scanResult, autoShare = userId === null } = params;

  const report = await generateSecurityReport(scanResult);
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

  console.log(`[storeReport] Report stored id=${data.id} domain=${domain} scanId=${scanId ?? 'none'}`);
  return { id: data.id, shareToken: data.share_token };
}
