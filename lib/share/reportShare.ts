import { createAdminClient } from '@/lib/supabase/admin';
import { generateShareToken } from '@/lib/share/token';
import { buildIntelligenceReport } from '@/lib/report/intelligenceFromScan';
import type { SecurityIntelligenceCard } from '@/lib/securityIntelligence/types';
import type { HeaderChecks } from '@/types';

export interface SharedReportPreview {
  domain: string;
  securityScore: number;
  summary: string;
  findingPreviews: SecurityIntelligenceCard[];
  riskLevel: string;
  attackSurfaceScore: number;
  attackSurfaceLevel: string;
  executiveSummary: string | null;
  shareToken: string;
}

export async function enableReportSharing(reportId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const shareToken = generateShareToken();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('scan_reports')
    .update({
      share_token: shareToken,
      is_public: true,
      share_approved_at: now,
    })
    .eq('id', reportId)
    .select('share_token')
    .single();

  if (error) {
    console.error('[reportShare] enable failed:', error);
    return null;
  }

  return data.share_token;
}

export async function getPublicReportByToken(
  token: string,
): Promise<SharedReportPreview | null> {
  const supabase = createAdminClient();

  const { data: report } = await supabase
    .from('scan_reports')
    .select('domain, risk_score, summary, scan_id, is_public, share_token')
    .eq('share_token', token)
    .eq('is_public', true)
    .single();

  if (!report) return null;

  let findingPreviews: SecurityIntelligenceCard[] = [];
  let securityScore = Math.max(0, Math.min(100, 100 - (report.risk_score ?? 0)));
  let riskLevel = 'medium';
  let attackSurfaceScore = 0;
  let attackSurfaceLevel = 'Medium';

  if (report.scan_id) {
    const { data: scan } = await supabase
      .from('scans')
      .select(
        'security_score, risk_level, ssl_valid, headers, issues, passed, explanation, scan_snapshot, websites(url)',
      )
      .eq('id', report.scan_id)
      .single();

    if (scan) {
      const siteRaw = scan.websites as unknown;
      const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as { url: string } | null;
      const url = site?.url ?? `https://${report.domain}`;

      const intelligence = buildIntelligenceReport(url, {
        security_score: scan.security_score,
        risk_level: scan.risk_level,
        ssl_valid: scan.ssl_valid,
        headers: scan.headers as HeaderChecks | null,
        issues: scan.issues as string[] | null,
        passed: scan.passed as string[] | null,
        explanation: scan.explanation,
        scan_snapshot: scan.scan_snapshot,
      });

      securityScore = intelligence.securityScore;
      riskLevel = intelligence.riskLevel;
      attackSurfaceScore = intelligence.attackSurfaceScore;
      attackSurfaceLevel = intelligence.attackSurfaceLevel;
      findingPreviews = intelligence.findings.slice(0, 3);
    }
  }

  const executiveSummary =
    typeof report.summary === 'string'
      ? report.summary.split('\n')[0].slice(0, 280)
      : null;

  return {
    domain: report.domain,
    securityScore,
    summary: report.summary ?? '',
    findingPreviews,
    riskLevel,
    attackSurfaceScore,
    attackSurfaceLevel,
    executiveSummary,
    shareToken: report.share_token,
  };
}
