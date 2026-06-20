import {
  getScoreBand,
  getWebsiteDisplayName,
  scoreToHealthCategory,
  type ActivityFeedItem,
  type ScoreBandDefinition,
} from '@/lib/dashboard/dashboardCommandCenter';
import { formatRelativeScanTime } from '@/lib/websiteHealth/healthCenterCopy';
import type { SslDashboardSummary } from '@/lib/ssl/fetchSslDashboardSummary';
import type { DomainDashboardSummary } from '@/lib/domain/fetchDomainDashboardSummary';
import { scoreToRiskBucket } from './enterpriseTypes';
import type { PostureState } from './postureState';

/** Section markers — used by verify-enterprise-dashboard-v3.ts */
export const ENTERPRISE_COMMAND_CENTER_COPY = {
  title: 'Agency Command Center',
  valueDeliveredTitle: 'What CyberShield Did For Your Clients',
  needsAttentionTitle: 'Clients Requiring Review',
  protectedWebsitesTitle: 'Protected Clients',
  recentActivityTitle: 'Recent Client Intelligence',
  advancedDiagnosticsTitle: 'Advanced Monitoring Diagnostics',
  orgInsightsTitle: 'Organization Insights',
  reportsTitle: 'Reports & Reviews',
  monitoringActive: 'Monitoring Active',
  reviewRecommended: 'Review Recommended',
  protected: 'Protected',
  healthy: 'Healthy',
} as const;

export type EnterpriseOrgStatus = 'Protected' | 'Review Recommended' | 'Setup required';

export interface EnterpriseWeekStats {
  checksCompleted: number;
  issuesDetected: number;
  outages: number;
  sslIssues: number;
}

export interface EnterpriseValueMetrics {
  checksCompleted: number;
  changesDetected: number;
  sslDomainIssues: number;
  sslCertificatesProtected: number;
  domainRisksFlagged: number;
  downtimeEvents: number;
  sitesAllOnline: number;
  websitesMonitored: number;
}

export interface EnterpriseOrgSummary {
  overallScore: number | null;
  overallBand: ScoreBandDefinition;
  orgStatus: EnterpriseOrgStatus;
  orgStatusLabel: string;
  websitesProtected: number;
  needsAttentionCount: number;
  criticalCount: number;
  weekStats: EnterpriseWeekStats;
  summaryLine: string;
}

export interface EnterpriseWebsiteRow {
  id: string;
  displayName: string;
  url: string;
  clientGroup: string;
  score: number | null;
  scoreBand: ScoreBandDefinition;
  healthCategory: ReturnType<typeof scoreToHealthCategory>;
  issueCount: number;
  topIssue: string | null;
  scanId: string | null;
  sslStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  monitoringLabel: string;
  recentChangesCount: number;
  stabilityLabel: string;
  lastScanLabel: string;
}

export interface NeedsAttentionClient {
  id: string;
  clientName: string;
  displayName: string;
  score: number | null;
  scoreBand: ScoreBandDefinition;
  issueCount: number;
  topIssue: string;
  whyItMatters: string;
  nextStep: string;
  reportHref: string;
}

export interface OrgInsight {
  label: string;
  value: string;
  detail: string;
  tone: 'good' | 'warn' | 'neutral';
}

export interface AdvancedMonitoringDiagnostics {
  lastCronAt: string | null;
  scansLast24h: number;
  failedLast24h: number;
  queuedScans: number;
  intelligenceSignalCount: number;
  prioritySlotsUsed: number | null;
  prioritySlotsLimit: number | null;
}

export interface EnterpriseCommandCenterData {
  userEmail: string;
  orgName: string | null;
  orgId: string | null;
  planLabel: string;
  isAdmin: boolean;
  isEmpty: boolean;
  orgSummary: EnterpriseOrgSummary;
  valueMetrics: EnterpriseValueMetrics;
  needsAttention: NeedsAttentionClient[];
  protectedWebsites: EnterpriseWebsiteRow[];
  activityFeed: ActivityFeedItem[];
  insights: OrgInsight[];
  advancedDiagnostics: AdvancedMonitoringDiagnostics;
}

export function resolveEnterpriseOrgStatus(input: {
  websiteCount: number;
  criticalCount: number;
  needsAttentionCount: number;
}): EnterpriseOrgStatus {
  if (input.websiteCount === 0) return 'Setup required';
  if (input.criticalCount > 0 || input.needsAttentionCount > 0) return 'Review Recommended';
  return 'Protected';
}

export function enterpriseStatusLabel(status: EnterpriseOrgStatus): string {
  if (status === 'Protected') return ENTERPRISE_COMMAND_CENTER_COPY.protected;
  if (status === 'Review Recommended') return ENTERPRISE_COMMAND_CENTER_COPY.reviewRecommended;
  return 'Setup required';
}

export function buildEnterpriseOrgSummary(input: {
  websites: EnterpriseWebsiteRow[];
  rollingScore: number | null;
  criticalCount: number;
  needsAttentionCount: number;
  weekStats: EnterpriseWeekStats;
  orgName: string | null;
}): EnterpriseOrgSummary {
  const scores = input.websites.map((w) => w.score).filter((s): s is number => s !== null);
  const overallScore =
    input.rollingScore ??
    (scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null);

  const orgStatus = resolveEnterpriseOrgStatus({
    websiteCount: input.websites.length,
    criticalCount: input.criticalCount,
    needsAttentionCount: input.needsAttentionCount,
  });

  let summaryLine: string;
  if (input.websites.length === 0) {
    summaryLine = 'Add client websites to start continuous protection and reporting.';
  } else if (orgStatus === 'Review Recommended') {
    summaryLine = `${input.needsAttentionCount + input.criticalCount} propert${input.needsAttentionCount + input.criticalCount === 1 ? 'y' : 'ies'} need your review this week.`;
  } else {
    summaryLine = `All ${input.websites.length} monitored website${input.websites.length === 1 ? '' : 's'} are healthy with active monitoring.`;
  }

  return {
    overallScore,
    overallBand: getScoreBand(overallScore),
    orgStatus,
    orgStatusLabel: enterpriseStatusLabel(orgStatus),
    websitesProtected: input.websites.filter((w) => w.healthCategory === 'healthy').length,
    needsAttentionCount: input.needsAttentionCount,
    criticalCount: input.criticalCount,
    weekStats: input.weekStats,
    summaryLine,
  };
}

export function buildEnterpriseWebsiteRows(input: {
  scans: Array<{
    websiteId: string;
    url: string;
    label: string | null;
    clientGroup: string;
    score: number | null;
    scanId: string | null;
    completedAt: string | null;
    issues: string[];
  }>;
  sslSummary: SslDashboardSummary;
  domainSummary: DomainDashboardSummary;
  changesByWebsite: Map<string, number>;
  monitoringLabel: string;
}): EnterpriseWebsiteRow[] {
  const sslBySite = new Map(input.sslSummary.sites.map((s) => [s.websiteId, s.status]));
  const domainBySite = new Map(input.domainSummary.sites.map((d) => [d.websiteId, d.status]));

  return input.scans.map((scan) => {
    const sslStatus = (sslBySite.get(scan.websiteId) ?? 'unknown') as EnterpriseWebsiteRow['sslStatus'];
    const domainStatus = domainBySite.get(scan.websiteId);
    const changes = input.changesByWebsite.get(scan.websiteId) ?? 0;
    const healthCategory = scoreToHealthCategory(scan.score);

    let stabilityLabel = 'Stable this week';
    if (changes >= 5) stabilityLabel = 'Active changes detected';
    else if (changes > 0) stabilityLabel = `${changes} change${changes === 1 ? '' : 's'} this week`;
    if (sslStatus === 'critical' || sslStatus === 'warning') stabilityLabel = 'SSL review recommended';
    else if (domainStatus === 'critical' || domainStatus === 'warning') stabilityLabel = 'Domain review recommended';

    const topIssue = scan.issues[0]?.replace(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*/i, '').trim() ?? null;

    return {
      id: scan.websiteId,
      displayName: getWebsiteDisplayName(scan.label, scan.url),
      url: scan.url,
      clientGroup: scan.clientGroup,
      score: scan.score,
      scoreBand: getScoreBand(scan.score),
      healthCategory,
      issueCount: scan.issues.length,
      topIssue,
      scanId: scan.scanId,
      sslStatus,
      monitoringLabel: input.monitoringLabel,
      recentChangesCount: changes,
      stabilityLabel,
      lastScanLabel: scan.completedAt ? formatRelativeScanTime(scan.completedAt) : 'Not scanned yet',
    };
  });
}

export function buildNeedsAttentionClients(websites: EnterpriseWebsiteRow[]): NeedsAttentionClient[] {
  const atRisk = websites.filter(
    (w) => w.healthCategory === 'critical' || w.healthCategory === 'needs_attention' || w.sslStatus !== 'healthy',
  );

  return atRisk
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 8)
    .map((site) => {
      const topIssue =
        site.topIssue ??
        (site.sslStatus !== 'healthy' ? 'SSL certificate needs review' : 'Security score below target');

      return {
        id: site.id,
        clientName: site.clientGroup,
        displayName: site.displayName,
        score: site.score,
        scoreBand: site.scoreBand,
        issueCount: site.issueCount,
        topIssue,
        whyItMatters:
          site.healthCategory === 'critical'
            ? 'Visitors may be exposed to preventable security risks until this is addressed.'
            : 'Fixing this now prevents small issues from becoming client-facing outages.',
        nextStep: site.scanId ? 'Review the latest security report with your client.' : 'Run a scan and review findings.',
        reportHref: site.scanId ? `/report/${site.scanId}` : '/enterprise/portal/websites',
      };
    });
}

export function buildProtectedWebsites(websites: EnterpriseWebsiteRow[]): EnterpriseWebsiteRow[] {
  return websites
    .filter(
      (w) =>
        w.healthCategory === 'healthy' &&
        w.sslStatus === 'healthy' &&
        w.score !== null &&
        w.score >= 70,
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 12);
}

export function buildEnterpriseActivityFeed(input: {
  scans: Array<{
    id: string;
    websiteLabel: string | null;
    websiteUrl: string;
    securityScore: number | null;
    status: string;
    completedAt: string | null;
    startedAt: string | null;
  }>;
  changesDetected: number;
  alerts: Array<{
    id: string;
    title: string;
    siteLabel: string;
    severity: string;
    createdAt: string;
  }>;
}): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];

  for (const alert of input.alerts.slice(0, 3)) {
    items.push({
      id: `alert-${alert.id}`,
      title: alert.title,
      detail: `${alert.siteLabel} · ${alert.severity === 'critical' ? 'Needs immediate review' : 'Review recommended'}`,
      timeLabel: formatRelativeScanTime(alert.createdAt),
      tone: alert.severity === 'critical' ? 'bad' : 'warn',
      href: '/app/alerts',
    });
  }

  for (const scan of input.scans.slice(0, 6)) {
    const name = getWebsiteDisplayName(scan.websiteLabel, scan.websiteUrl);
    const time = scan.completedAt ?? scan.startedAt;

    if (scan.status === 'completed' && scan.securityScore !== null) {
      const band = getScoreBand(scan.securityScore);
      items.push({
        id: scan.id,
        title: `Security check completed for ${name}`,
        detail: `Score ${scan.securityScore}/100 — ${band.label}. Monitoring remains active.`,
        timeLabel: time ? formatRelativeScanTime(time) : 'Recently',
        tone: scoreToRiskBucket(scan.securityScore) === 'low' ? 'good' : 'neutral',
        href: `/report/${scan.id}`,
      });
    }
  }

  if (input.changesDetected > 0) {
    items.unshift({
      id: 'changes-summary',
      title: `${input.changesDetected} configuration change${input.changesDetected === 1 ? '' : 's'} detected this week`,
      detail: 'Review changes to confirm they match what you expect for each client site.',
      timeLabel: 'This week',
      tone: 'warn',
      href: '/enterprise/portal/websites',
    });
  }

  return items.slice(0, 8);
}

export function buildOrgInsights(input: {
  websites: EnterpriseWebsiteRow[];
  topIssueCategories: string[];
  monthlyTrend: number | null;
  postureState: PostureState | null;
}): OrgInsight[] {
  const strongest = [...input.websites]
    .filter((w) => w.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  const opportunity = [...input.websites]
    .filter((w) => w.score !== null && w.score < 90)
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101))[0];

  const trendLabel =
    input.monthlyTrend === null
      ? 'Trend data building'
      : input.monthlyTrend > 0
        ? `Improving (+${input.monthlyTrend} pts this month)`
        : input.monthlyTrend < 0
          ? `Declining (${input.monthlyTrend} pts this month)`
          : 'Stable this month';

  const postureTrend =
    input.postureState === 'HEALTHY' || input.postureState === 'STABLE'
      ? 'Organization protection is holding steady'
      : input.postureState === 'CRITICAL' || input.postureState === 'DEGRADED'
        ? 'Review recommended on lower-scoring client sites'
        : 'Monitoring active across your portfolio';

  return [
    {
      label: 'Most common issue',
      value: input.topIssueCategories[0] ?? 'No dominant issue type yet',
      detail: 'Focus remediation playbooks here to lift scores across clients.',
      tone: input.topIssueCategories[0] ? 'warn' : 'neutral',
    },
    {
      label: 'Strongest website',
      value: strongest ? `${strongest.displayName} (${strongest.score}/100)` : '—',
      detail: strongest ? 'Use this as a benchmark when advising other clients.' : 'Run scans to identify top performers.',
      tone: 'good',
    },
    {
      label: 'Biggest opportunity',
      value: opportunity ? `${opportunity.displayName} (${opportunity.score}/100)` : 'All sites scoring well',
      detail: opportunity
        ? `Address ${opportunity.topIssue ?? 'open findings'} to unlock the next score band.`
        : 'Continue monitoring for drift.',
      tone: opportunity ? 'warn' : 'good',
    },
    {
      label: 'Overall trend',
      value: trendLabel,
      detail: postureTrend,
      tone: input.monthlyTrend !== null && input.monthlyTrend >= 0 ? 'good' : 'neutral',
    },
  ];
}

export { getWebsiteDisplayName, getScoreBand };
