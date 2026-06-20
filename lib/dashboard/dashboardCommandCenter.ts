import type { Plan } from '@/lib/billing/plans';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { formatRelativeScanTime } from '@/lib/websiteHealth/healthCenterCopy';
import { scoreToRiskBucket, type RiskBucket } from '@/lib/enterprise/enterpriseTypes';
import type { SslDashboardSummary } from '@/lib/ssl/fetchSslDashboardSummary';
import type { DomainDashboardSummary } from '@/lib/domain/fetchDomainDashboardSummary';

/** Section markers — used by verify-dashboard-v2.ts */
export const COMMAND_CENTER_COPY = {
  title: 'Website Intelligence Command Center',
  monitoringActive: 'CyberShield Monitoring Active',
  monitoringActiveDetail:
    'Your websites are being checked automatically. We will alert you if anything changes.',
  welcomeMonitoring: 'Continuous website protection is active — we detect changes and surface intelligence automatically.',
  emptyTitle: 'Welcome to CyberShield',
  emptySubtitle: 'Add your first website to start continuous website protection and intelligence.',
  orgHealthTitle: 'Website Health',
  activeMonitoringTitle: 'Monitoring Active',
  securityWinsTitle: "What's Working Well",
  needsAttentionTitle: 'Immediate Attention',
  recentActivityTitle: 'Recent Website Intelligence',
  quickActionsTitle: 'Quick Actions',
  scoreContextTitle: 'Score Guide',
} as const;

/** Dashboard V4 section markers — used by verify-dashboard-v4-strategy.ts */
export const DASHBOARD_V4_COPY = {
  websiteHealthTitle: 'Website Health',
  monitoringActiveTitle: 'Monitoring Active',
  monitoringActiveSubtitle: 'Continuous checks across SSL, domain, uptime, and configuration.',
  immediateAttentionTitle: 'Fix this first',
  recentIntelligenceTitle: 'Recent Website Intelligence',
  valueDeliveredTitle: 'What CyberShield Did For You',
  valueDeliveredSubtitle: 'Past 30 days of protection and intelligence',
  websiteMemoryTitle: 'Website Memory',
} as const;

export type ScoreBandKey =
  | 'excellent'
  | 'strong'
  | 'good'
  | 'fair'
  | 'needs_attention'
  | 'critical'
  | 'not_scored';

export interface ScoreBandDefinition {
  key: ScoreBandKey;
  label: string;
  min: number;
  max: number;
  badgeClass: string;
  textClass: string;
}

/** Score bands — SSOT for dashboard V2 */
export const SCORE_BANDS: ScoreBandDefinition[] = [
  {
    key: 'excellent',
    label: 'Excellent',
    min: 90,
    max: 100,
    badgeClass: 'bg-green-500/15 text-green-300 border-green-500/30',
    textClass: 'text-green-400',
  },
  {
    key: 'strong',
    label: 'Strong',
    min: 80,
    max: 89,
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    textClass: 'text-emerald-400',
  },
  {
    key: 'good',
    label: 'Good',
    min: 70,
    max: 79,
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    textClass: 'text-teal-400',
  },
  {
    key: 'fair',
    label: 'Fair',
    min: 60,
    max: 69,
    badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    textClass: 'text-yellow-400',
  },
  {
    key: 'needs_attention',
    label: 'Needs Attention',
    min: 50,
    max: 59,
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    textClass: 'text-orange-400',
  },
  {
    key: 'critical',
    label: 'Critical',
    min: 0,
    max: 49,
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
    textClass: 'text-red-400',
  },
];

export function getScoreBand(score: number | null): ScoreBandDefinition {
  if (score === null) {
    return {
      key: 'not_scored',
      label: 'Not scanned',
      min: 0,
      max: 0,
      badgeClass: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
      textClass: 'text-gray-400',
    };
  }
  for (const band of SCORE_BANDS) {
    if (score >= band.min && score <= band.max) return band;
  }
  return SCORE_BANDS[SCORE_BANDS.length - 1]!;
}

/** Never show raw DB IDs — label || hostname from url */
export function getWebsiteDisplayName(label: string | null | undefined, url: string): string {
  if (label?.trim()) return label.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
  }
}

/** Alias for customer-facing UI — prefer over raw IDs */
export const websiteDisplayName = getWebsiteDisplayName;

export function riskBucketLabel(bucket: RiskBucket): string {
  switch (bucket) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return 'Not scored';
  }
}

export interface ValueSummaryMetrics {
  checksCompleted: number;
  changesDetected: number;
  sslDomainIssues: number;
  sslCertificatesProtected: number;
  domainRisksFlagged: number;
  downtimeEvents: number;
  sitesAllOnline: number;
  websitesMonitored: number;
}

export const VALUE_SUMMARY_COPY = {
  title: DASHBOARD_V4_COPY.valueDeliveredTitle,
  subtitle: DASHBOARD_V4_COPY.valueDeliveredSubtitle,
} as const;

export interface WebsiteActivityCard extends CommandCenterWebsite {
  riskLabel: string;
  topIssue: string;
  recommendedAction: string;
  actionHref: string;
}

export function buildWebsiteActivityCards(
  websites: CommandCenterWebsite[],
  needsAttention: NeedsAttentionItem[],
): WebsiteActivityCard[] {
  return websites.map((site) => {
    const attention = needsAttention.find((item) => item.websiteName === site.displayName);
    const bucket = scoreToRiskBucket(site.score);

    if (attention) {
      return {
        ...site,
        riskLabel: riskBucketLabel(bucket),
        topIssue: attention.title,
        recommendedAction: attention.actionLabel,
        actionHref: attention.actionHref,
      };
    }

    if (site.healthCategory === 'healthy') {
      return {
        ...site,
        riskLabel: riskBucketLabel(bucket),
        topIssue: 'No urgent issues detected',
        recommendedAction: 'Review Health Center',
        actionHref: `/app/websites/${site.id}/health`,
      };
    }

    if (site.score === null) {
      return {
        ...site,
        riskLabel: riskBucketLabel(bucket),
        topIssue: 'Awaiting first security check',
        recommendedAction: 'Run a security check',
        actionHref: '/app/websites',
      };
    }

    return {
      ...site,
      riskLabel: riskBucketLabel(bucket),
      topIssue: `Security score ${site.score}/100 — review findings`,
      recommendedAction: site.latestScanId ? 'View Report' : 'Open Health Center',
      actionHref: site.latestScanId
        ? `/report/${site.latestScanId}`
        : `/app/websites/${site.id}/health`,
    };
  });
}

export type WebsiteHealthCategory = 'healthy' | 'needs_attention' | 'critical' | 'unknown';

export function scoreToHealthCategory(score: number | null): WebsiteHealthCategory {
  if (score === null) return 'unknown';
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'needs_attention';
  return 'critical';
}

export interface OrgHealthSummary {
  overallScore: number | null;
  overallBand: ScoreBandDefinition;
  monitored: number;
  healthy: number;
  needsAttention: number;
  critical: number;
  unknown: number;
  monthlyTrend: number | null;
  monthlyTrendLabel: string;
}

export interface CommandCenterWebsite {
  id: string;
  displayName: string;
  url: string;
  score: number | null;
  scoreBand: ScoreBandDefinition;
  healthCategory: WebsiteHealthCategory;
  monitoringLabel: string;
  lastScanLabel: string;
  lastScanAt: string | null;
  recentChangesCount: number;
  latestScanId: string | null;
}

export interface ActiveMonitoringSummary {
  websitesMonitored: number;
  checksCompleted: number;
  changesDetected: number;
  sslWarnings: number;
  domainWarnings: number;
  lastActivityLabel: string;
  lastActivityAt: string | null;
}

export interface SecurityWin {
  label: string;
  detail: string;
}

export interface NeedsAttentionItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  websiteName: string;
  whyItMatters: string;
  actionLabel: string;
  actionHref: string;
}

export interface ActivityFeedItem {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  href?: string;
}

export interface CommandCenterData {
  userDisplayName: string;
  userEmail: string;
  planLabel: string;
  planMonitoringLabel: string;
  accountStatus: 'Protected' | 'Action needed' | 'Setup required';
  lastActivityLabel: string;
  lastActivityAt: string | null;
  orgHealth: OrgHealthSummary;
  websites: CommandCenterWebsite[];
  activeMonitoring: ActiveMonitoringSummary;
  valueSummary: ValueSummaryMetrics;
  securityWins: SecurityWin[];
  needsAttention: NeedsAttentionItem[];
  activityFeed: ActivityFeedItem[];
  showRetentionBanner: boolean;
  isEmpty: boolean;
}

export function buildOrgHealthSummary(
  websites: Array<{ score: number | null }>,
  monthlyTrend: number | null,
): OrgHealthSummary {
  let healthy = 0;
  let needsAttention = 0;
  let critical = 0;
  let unknown = 0;
  const scores: number[] = [];

  for (const site of websites) {
    const cat = scoreToHealthCategory(site.score);
    if (cat === 'healthy') healthy++;
    else if (cat === 'needs_attention') needsAttention++;
    else if (cat === 'critical') critical++;
    else unknown++;
    if (site.score !== null) scores.push(site.score);
  }

  const overallScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const monthlyTrendLabel =
    monthlyTrend === null
      ? 'Trend data building'
      : monthlyTrend > 0
        ? `+${monthlyTrend} this month`
        : monthlyTrend < 0
          ? `${monthlyTrend} this month`
          : 'Stable this month';

  return {
    overallScore,
    overallBand: getScoreBand(overallScore),
    monitored: websites.length,
    healthy,
    needsAttention,
    critical,
    unknown,
    monthlyTrend,
    monthlyTrendLabel,
  };
}

export function buildSecurityWins(input: {
  avgScore: number | null;
  sslSummary: SslDashboardSummary;
  domainSummary: DomainDashboardSummary;
  criticalAlerts: number;
  websitesMonitored: number;
  checksCompleted: number;
  headerPassRate: number | null;
}): SecurityWin[] {
  const wins: SecurityWin[] = [];

  if (input.websitesMonitored > 0) {
    wins.push({
      label: 'Monitoring coverage',
      detail: `${input.websitesMonitored} website${input.websitesMonitored === 1 ? '' : 's'} under active monitoring.`,
    });
  }

  if (input.checksCompleted > 0) {
    wins.push({
      label: 'Regular security checks',
      detail: `${input.checksCompleted} completed scan${input.checksCompleted === 1 ? '' : 's'} keeping your posture current.`,
    });
  }

  if (input.avgScore !== null && input.avgScore >= 70) {
    wins.push({
      label: 'Strong security posture',
      detail: `Average score of ${input.avgScore}/100 across monitored sites.`,
    });
  }

  if (input.sslSummary.critical === 0 && input.sslSummary.warning === 0 && input.sslSummary.healthy > 0) {
    wins.push({
      label: 'SSL certificates healthy',
      detail: 'All monitored certificates are valid with no expiry warnings.',
    });
  }

  if (
    input.domainSummary.critical === 0 &&
    input.domainSummary.warning === 0 &&
    input.domainSummary.healthy > 0
  ) {
    wins.push({
      label: 'Domain registrations secure',
      detail: 'No domain expiry warnings on monitored sites.',
    });
  }

  if (input.criticalAlerts === 0 && input.websitesMonitored > 0) {
    wins.push({
      label: 'No critical alerts',
      detail: 'No open critical issues requiring immediate action.',
    });
  }

  if (input.headerPassRate !== null && input.headerPassRate >= 0.8) {
    wins.push({
      label: 'Security headers in good shape',
      detail: `${Math.round(input.headerPassRate * 100)}% of header checks passing across sites.`,
    });
  }

  if (wins.length === 0) {
    wins.push({
      label: 'Ready to monitor',
      detail: 'Add a website and run your first scan to unlock security insights.',
    });
  }

  return wins.slice(0, 6);
}

const SEVERITY_ORDER: Record<NeedsAttentionItem['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function prioritizeNeedsAttention(items: NeedsAttentionItem[]): NeedsAttentionItem[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function buildNeedsAttentionFromAlerts(
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    message: string | null;
    websiteUrl: string | null;
    websiteLabel: string | null;
    websiteId: string | null;
  }>,
): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];

  for (const alert of alerts) {
    const severity = normalizeSeverity(alert.severity);
    const websiteName = alert.websiteLabel || alert.websiteUrl
      ? getWebsiteDisplayName(alert.websiteLabel, alert.websiteUrl ?? '')
      : 'Your account';

    items.push({
      id: alert.id,
      severity,
      title: alert.title,
      websiteName,
      whyItMatters: alert.message ?? 'This issue could affect your website security or availability.',
      actionLabel: alert.websiteId ? 'Open Health Center' : 'View Alerts',
      actionHref: alert.websiteId
        ? `/app/websites/${alert.websiteId}/health`
        : '/app/alerts',
    });
  }

  return prioritizeNeedsAttention(items);
}

export function buildNeedsAttentionFromWebsites(
  websites: CommandCenterWebsite[],
  sslSummary: SslDashboardSummary,
  domainSummary: DomainDashboardSummary,
): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];

  for (const site of websites) {
    if (site.healthCategory === 'critical') {
      items.push({
        id: `score-${site.id}`,
        severity: 'critical',
        title: `Security score needs immediate attention (${site.score}/100)`,
        websiteName: site.displayName,
        whyItMatters: 'A low score means visitors may be exposed to preventable security risks.',
        actionLabel: 'Open Health Center',
        actionHref: `/app/websites/${site.id}/health`,
      });
    } else if (site.healthCategory === 'needs_attention') {
      items.push({
        id: `score-${site.id}`,
        severity: 'medium',
        title: `Security score below target (${site.score}/100)`,
        websiteName: site.displayName,
        whyItMatters: 'Addressing findings now prevents small issues from becoming critical.',
        actionLabel: 'View Report',
        actionHref: site.latestScanId ? `/report/${site.latestScanId}` : `/app/websites/${site.id}/health`,
      });
    }
  }

  for (const ssl of sslSummary.sites) {
    if (ssl.status === 'critical' || ssl.status === 'warning') {
      const name = getWebsiteDisplayName(ssl.label, ssl.url);
      items.push({
        id: `ssl-${ssl.websiteId}`,
        severity: ssl.status === 'critical' ? 'critical' : 'high',
        title: ssl.status === 'critical' ? 'SSL certificate expiring soon' : 'SSL certificate warning',
        websiteName: name,
        whyItMatters: 'An expired certificate breaks trust and can take your site offline for visitors.',
        actionLabel: 'Open Health Center',
        actionHref: `/app/websites/${ssl.websiteId}/health`,
      });
    }
  }

  for (const domain of domainSummary.sites) {
    if (domain.status === 'critical' || domain.status === 'warning') {
      const name = getWebsiteDisplayName(domain.label, domain.url);
      items.push({
        id: `domain-${domain.websiteId}`,
        severity: domain.status === 'critical' ? 'critical' : 'high',
        title: domain.status === 'critical' ? 'Domain registration expiring soon' : 'Domain registration warning',
        websiteName: name,
        whyItMatters: 'Losing your domain means losing your website and customer trust.',
        actionLabel: 'Open Health Center',
        actionHref: `/app/websites/${domain.websiteId}/health`,
      });
    }
  }

  return prioritizeNeedsAttention(items).slice(0, 8);
}

export function formatActivityFeed(input: {
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
}): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];

  for (const scan of input.scans.slice(0, 8)) {
    const name = getWebsiteDisplayName(scan.websiteLabel, scan.websiteUrl);
    const time = scan.completedAt ?? scan.startedAt;

    if (scan.status === 'completed' && scan.securityScore !== null) {
      const band = getScoreBand(scan.securityScore);
      const bucket = scoreToRiskBucket(scan.securityScore);
      items.push({
        id: scan.id,
        title: `Website health updated for ${name}`,
        detail: `Protection score ${scan.securityScore}/100 · ${band.label}`,
        timeLabel: time ? formatRelativeScanTime(time) : 'Recently',
        tone: bucket === 'low' ? 'good' : bucket === 'critical' || bucket === 'high' ? 'warn' : 'neutral',
        href: `/report/${scan.id}`,
      });
    } else if (scan.status === 'processing' || scan.status === 'pending') {
      items.push({
        id: scan.id,
        title: `Monitoring check in progress for ${name}`,
        detail: 'Intelligence will appear when the check completes.',
        timeLabel: time ? formatRelativeScanTime(time) : 'In progress',
        tone: 'neutral',
      });
    } else if (scan.status === 'failed') {
      items.push({
        id: scan.id,
        title: `Monitoring check incomplete for ${name}`,
        detail: 'CyberShield will retry automatically, or review from Quick Actions.',
        timeLabel: time ? formatRelativeScanTime(time) : 'Recently',
        tone: 'bad',
      });
    }
  }

  if (input.changesDetected > 0 && items.length < 8) {
    items.unshift({
      id: 'changes-summary',
      title: `${input.changesDetected} website change${input.changesDetected === 1 ? '' : 's'} detected recently`,
      detail: 'Review Website Memory to confirm updates match your expectations.',
      timeLabel: 'Recent',
      tone: 'warn',
      href: '/app/websites',
    });
  }

  return items.slice(0, 8);
}

export function resolveAccountStatus(input: {
  websiteCount: number;
  criticalCount: number;
  needsAttentionCount: number;
}): CommandCenterData['accountStatus'] {
  if (input.websiteCount === 0) return 'Setup required';
  if (input.criticalCount > 0 || input.needsAttentionCount > 0) return 'Action needed';
  return 'Protected';
}

export function shouldShowRetentionBanner(orgHealth: OrgHealthSummary): boolean {
  return (
    orgHealth.monitored > 0 &&
    orgHealth.critical === 0 &&
    orgHealth.needsAttention === 0 &&
    (orgHealth.overallScore === null || orgHealth.overallScore >= 70)
  );
}

function normalizeSeverity(severity: string): NeedsAttentionItem['severity'] {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

export function monitoringLabelForWebsite(
  priorityMonitoring: boolean,
  planHasPriority: boolean,
  scanFrequency: (typeof PLAN_LIMITS)[Plan]['scanFrequency'] = 'hourly',
): string {
  if (priorityMonitoring && planHasPriority) return 'Priority · every 5 min';
  if (scanFrequency === 'daily') return 'Active · daily checks';
  if (scanFrequency === 'hourly') return 'Active · hourly checks';
  return 'Manual scans only';
}

export function scheduledMonitoringDetailLabel(
  priorityMonitoring: boolean,
  planHasPriority: boolean,
  scanFrequency: (typeof PLAN_LIMITS)[Plan]['scanFrequency'],
): string {
  if (priorityMonitoring && planHasPriority) {
    return 'Priority monitoring — checked every 5 minutes';
  }
  if (scanFrequency === 'daily') {
    return 'Daily monitoring checks — plus weekly deep scans';
  }
  if (scanFrequency === 'hourly') {
    return 'Hourly monitoring checks — plus weekly deep scans';
  }
  return 'Manual scans only — upgrade for scheduled monitoring';
}
