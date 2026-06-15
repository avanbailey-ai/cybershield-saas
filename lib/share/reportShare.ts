import { createAdminClient } from '@/lib/supabase/admin';
import { generateShareToken } from '@/lib/share/token';

export interface SharedReportPreview {
  domain: string;
  securityScore: number;
  summary: string;
  vulnerabilityPreviews: Array<{ title: string; severity: string }>;
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
    .select('domain, risk_score, summary, vulnerabilities, is_public, share_token')
    .eq('share_token', token)
    .eq('is_public', true)
    .single();

  if (!report) return null;

  const securityScore = Math.max(0, Math.min(100, 100 - (report.risk_score ?? 0)));
  const vulnerabilities = Array.isArray(report.vulnerabilities)
    ? (report.vulnerabilities as Array<{ title?: string; severity?: string; description?: string }>)
    : [];

  const vulnerabilityPreviews = vulnerabilities.slice(0, 3).map((v) => ({
    title: v.title ?? 'Security issue',
    severity: v.severity ?? 'medium',
  }));

  const executiveSummary =
    typeof report.summary === 'string'
      ? report.summary.split('\n')[0].slice(0, 280)
      : null;

  return {
    domain: report.domain,
    securityScore,
    summary: report.summary ?? '',
    vulnerabilityPreviews,
    executiveSummary,
    shareToken: report.share_token,
  };
}
