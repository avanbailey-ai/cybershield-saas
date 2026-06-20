import type { EnterpriseWebsiteRow } from '@/lib/enterprise/enterpriseCommandCenter';

export interface AgencyInsightItem {
  id: string;
  message: string;
  tone: 'good' | 'warn' | 'neutral';
  detail?: string;
}

const CSP_PATTERN = /content-security-policy|csp/i;
const SSL_PATTERN = /ssl|certificate/i;
const DNS_PATTERN = /dns|domain/i;

function countSitesWithIssue(
  websites: EnterpriseWebsiteRow[],
  matcher: (site: EnterpriseWebsiteRow) => boolean,
): number {
  return websites.filter(matcher).length;
}

/** Cross-client insights from real scan data — no fabricated trends. */
export function buildAgencyInsights(input: {
  websites: EnterpriseWebsiteRow[];
  reportsReadyCount: number;
  monthlyTrend: number | null;
  topIssueCategories: string[];
}): AgencyInsightItem[] {
  const items: AgencyInsightItem[] = [];
  const { websites } = input;

  if (websites.length === 0) {
    return [
      {
        id: 'empty',
        message: 'Add your first client website to start monitoring and generate client-ready reports.',
        tone: 'neutral',
      },
    ];
  }

  const missingCsp = countSitesWithIssue(websites, (w) =>
    (w.topIssue ?? '').match(CSP_PATTERN) !== null,
  );
  if (missingCsp > 0) {
    items.push({
      id: 'csp',
      message: `${missingCsp} client site${missingCsp === 1 ? '' : 's'} ${missingCsp === 1 ? 'is' : 'are'} missing Content-Security-Policy.`,
      tone: 'warn',
    });
  }

  const sslIssues = countSitesWithIssue(
    websites,
    (w) => w.sslStatus === 'critical' || w.sslStatus === 'warning',
  );
  if (sslIssues > 0) {
    items.push({
      id: 'ssl',
      message: `${sslIssues} client site${sslIssues === 1 ? '' : 's'} need SSL review.`,
      tone: 'warn',
    });
  }

  const dnsChanges = countSitesWithIssue(
    websites,
    (w) => w.recentChangesCount > 0 && (w.topIssue ?? '').match(DNS_PATTERN) !== null,
  );
  if (dnsChanges > 0) {
    items.push({
      id: 'dns',
      message: `${dnsChanges} client site${dnsChanges === 1 ? '' : 's'} had DNS or domain-related changes this week.`,
      tone: 'warn',
    });
  }

  const needsAttention = websites.filter(
    (w) => w.healthCategory === 'critical' || w.healthCategory === 'needs_attention',
  );
  for (const site of needsAttention.slice(0, 3)) {
    items.push({
      id: `attention-${site.id}`,
      message: `${site.displayName} has unresolved ${site.healthCategory === 'critical' ? 'critical' : 'medium'} findings.`,
      tone: 'warn',
      detail: site.topIssue ?? undefined,
    });
  }

  if (input.reportsReadyCount > 0) {
    items.push({
      id: 'reports-ready',
      message: `${input.reportsReadyCount} client report${input.reportsReadyCount === 1 ? '' : 's'} ready to export.`,
      tone: 'good',
    });
  }

  if (input.monthlyTrend !== null && input.monthlyTrend > 0) {
    const improved = websites.filter((w) => w.score !== null && w.score >= 70).length;
    if (improved > 0) {
      items.push({
        id: 'improved',
        message: `Portfolio average improved (+${input.monthlyTrend} pts this month).`,
        tone: 'good',
      });
    }
  } else if (input.monthlyTrend === null && websites.length > 0) {
    items.push({
      id: 'trends-pending',
      message: 'Trends will appear after more scans.',
      tone: 'neutral',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'healthy',
      message: 'All monitored client sites are healthy. Monitoring continues.',
      tone: 'good',
    });
  }

  return items.slice(0, 8);
}

export interface PortfolioHealthSummary {
  totalWebsites: number;
  healthy: number;
  needsAttention: number;
  critical: number;
  averageScore: number | null;
}

export function buildPortfolioHealthSummary(websites: EnterpriseWebsiteRow[]): PortfolioHealthSummary {
  const scores = websites.map((w) => w.score).filter((s): s is number => s !== null);
  return {
    totalWebsites: websites.length,
    healthy: websites.filter((w) => w.healthCategory === 'healthy').length,
    needsAttention: websites.filter((w) => w.healthCategory === 'needs_attention').length,
    critical: websites.filter((w) => w.healthCategory === 'critical').length,
    averageScore:
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}
