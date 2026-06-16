import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeDomain } from '@/lib/cache/scanCache';
import { buildIntelligenceReport } from '@/lib/report/intelligenceFromScan';
import type { HeaderChecks } from '@/types';

export interface LeadScanContext {
  scanId: string | null;
  reportId: string | null;
  domain: string;
  riskScore: number | null;
  securityScore: number | null;
  riskLevel: string | null;
  summary: string | null;
  remediationInsights: string[];
  reportUrl: string | null;
}

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://cybershield-saas.vercel.app';

function insightsFromIntelligence(
  intelligence: ReturnType<typeof buildIntelligenceReport>,
): string[] {
  const fromFindings = intelligence.findings
    .slice(0, 5)
    .map((f) => f.fix || f.title)
    .filter(Boolean);

  if (fromFindings.length >= 3) {
    return fromFindings.slice(0, 5);
  }

  const fromRecommendations = intelligence.recommendations
    .flatMap((r) => r.steps.slice(0, 1))
    .filter(Boolean);

  return [...fromFindings, ...fromRecommendations].slice(0, 5);
}

async function buildContextFromScan(
  domain: string,
  scanId: string,
  report?: {
    id: string;
    risk_score: number | null;
    summary: string | null;
    share_token: string | null;
  } | null,
): Promise<LeadScanContext> {
  const admin = createAdminClient();
  const { data: scan } = await admin
    .from('scans')
    .select(
      'id, security_score, risk_score, risk_level, ssl_valid, headers, issues, passed, explanation, scan_snapshot, websites(url)',
    )
    .eq('id', scanId)
    .single();

  if (!scan) {
    return {
      scanId,
      reportId: report?.id ?? null,
      domain,
      riskScore: report?.risk_score ?? null,
      securityScore: report?.risk_score != null ? Math.max(0, 100 - report.risk_score) : null,
      riskLevel: null,
      summary: report?.summary ?? null,
      remediationInsights: [],
      reportUrl: report?.share_token ? `${siteUrl()}/scan-result/${report.share_token}` : null,
    };
  }

  const siteRaw = scan.websites as unknown;
  const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as { url: string } | null;
  const url = site?.url ?? `https://${domain}`;

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

  const riskScore = scan.risk_score ?? (report?.risk_score ?? 100 - intelligence.securityScore);

  return {
    scanId,
    reportId: report?.id ?? null,
    domain,
    riskScore,
    securityScore: intelligence.securityScore,
    riskLevel: intelligence.riskLevel,
    summary: report?.summary ?? intelligence.summary.split('\n')[0] ?? null,
    remediationInsights: insightsFromIntelligence(intelligence),
    reportUrl: report?.share_token ? `${siteUrl()}/scan-result/${report.share_token}` : null,
  };
}

/** Resolve latest scan/report context for a user-provided or scan-linked domain. */
export async function fetchLeadScanContext(
  rawDomain: string | null | undefined,
): Promise<LeadScanContext | null> {
  if (!rawDomain?.trim()) return null;

  const domain = normalizeDomain(rawDomain.trim());
  if (!domain) return null;

  const admin = createAdminClient();

  const { data: report } = await admin
    .from('scan_reports')
    .select('id, scan_id, risk_score, summary, share_token, domain')
    .eq('domain', domain)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (report?.scan_id) {
    return buildContextFromScan(domain, report.scan_id, report);
  }

  const { data: websites } = await admin
    .from('websites')
    .select('id, url')
    .ilike('url', `%${domain}%`)
    .limit(10);

  const website = websites?.find((w) => normalizeDomain(w.url) === domain);
  if (!website) {
    if (report) {
      return {
        scanId: null,
        reportId: report.id,
        domain,
        riskScore: report.risk_score,
        securityScore: report.risk_score != null ? Math.max(0, 100 - report.risk_score) : null,
        riskLevel: null,
        summary: report.summary,
        remediationInsights: [],
        reportUrl: report.share_token ? `${siteUrl()}/scan-result/${report.share_token}` : null,
      };
    }
    return null;
  }

  const { data: scan } = await admin
    .from('scans')
    .select('id')
    .eq('website_id', website.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scan?.id) return null;

  return buildContextFromScan(domain, scan.id, report);
}
