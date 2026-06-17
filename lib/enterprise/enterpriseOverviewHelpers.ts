import type { OrgAnomalyFeedItem, RiskBucket } from './enterpriseTypes';
import { POSTURE_DISPLAY, type PostureState } from './postureState';
import { scoreToRiskBucket } from './enterpriseTypes';
import { classifyIssueSeverity, type FindingSeverity } from './scanDiff';

export type GroupedIntelligenceSignal = {
  id: string;
  type: string;
  typeLabel: string;
  severity: string;
  title: string;
  detail: string;
  relatedCount: number;
  latestAt: string;
  websiteId: string | null;
};

export type ImmediateAction = {
  id: string;
  site: string;
  severity: string;
  reason: string;
  ctaLabel: string;
  ctaHref: string;
};

export type SiteAtRisk = {
  websiteId: string;
  domain: string;
  label: string | null;
  score: number | null;
  bucket: RiskBucket;
  scanId: string | null;
  completedAt: string | null;
};

export type LatestScanRow = {
  id: string;
  websiteId: string;
  domain: string;
  label: string | null;
  score: number | null;
  bucket: RiskBucket;
  status: string;
  completedAt: string | null;
};

export type OrgAlertRow = {
  id: string;
  title: string;
  message: string;
  severity: string;
  websiteId: string | null;
  siteLabel: string;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  volatility: 'Score volatility',
  sudden_drop: 'Sudden score drop',
  new_critical_finding: 'New finding',
  ssl_changed: 'SSL / availability',
  header_removed: 'Header regression',
};

function severityRank(severity: string): number {
  switch (severity) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    default:
      return 4;
  }
}

function formatAnomalyTitle(anomaly: OrgAnomalyFeedItem): string {
  if (anomaly.type === 'volatility') {
    const varianceMatch = anomaly.message.match(/variance\s+(\d+)/i);
    const variance = varianceMatch?.[1] ?? '';
    return variance ? `Score volatility detected` : 'Score volatility detected';
  }
  if (anomaly.type === 'sudden_drop') {
    return 'Security score dropped significantly';
  }
  const cleaned = anomaly.message
    .replace(/^New\s+(high|critical|medium|low)[\s-]*(severity|finding)?[:\s]*/i, '')
    .replace(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*/i, '')
    .trim();
  return cleaned || anomaly.message;
}

function formatAnomalyDetail(anomaly: OrgAnomalyFeedItem, relatedCount: number): string {
  if (anomaly.type === 'volatility') {
    const varianceMatch = anomaly.message.match(/variance\s+(\d+)/i);
    const variance = varianceMatch?.[1] ?? '—';
    if (relatedCount > 1) {
      return `Latest variance: ${variance} · ${relatedCount} related signals in the last 24 hours`;
    }
    return variance !== '—' ? `Latest variance: ${variance}` : 'Recent scan scores vary more than usual';
  }
  return anomaly.message;
}

/** Deduplicate and group raw org anomalies for dashboard display. */
export function groupIntelligenceSignals(
  anomalies: OrgAnomalyFeedItem[],
  maxVisible = 5,
): { items: GroupedIntelligenceSignal[]; total: number; hasMore: boolean } {
  const open = anomalies.filter((a) => !a.resolved);
  const groups = new Map<string, OrgAnomalyFeedItem[]>();

  for (const anomaly of open) {
    const key =
      anomaly.type === 'volatility'
        ? 'volatility'
        : `${anomaly.type}:${formatAnomalyTitle(anomaly).toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(anomaly);
    groups.set(key, list);
  }

  const grouped: GroupedIntelligenceSignal[] = [...groups.entries()].map(([key, items]) => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const latest = sorted[0]!;
    return {
      id: latest.id,
      type: latest.type,
      typeLabel: TYPE_LABELS[latest.type] ?? latest.type.replace(/_/g, ' '),
      severity: latest.severity,
      title: formatAnomalyTitle(latest),
      detail: formatAnomalyDetail(latest, sorted.length),
      relatedCount: sorted.length,
      latestAt: latest.createdAt,
      websiteId: latest.websiteId,
    };
  });

  grouped.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );

  return {
    items: grouped,
    total: grouped.length,
    hasMore: grouped.length > maxVisible,
  };
}

export function buildImmediateActions(input: {
  sitesAtRisk: SiteAtRisk[];
  alerts: OrgAlertRow[];
  intelligence: GroupedIntelligenceSignal[];
  totalSites: number;
  prioritySlotsUsed: number | null;
  prioritySlotsLimit: number | null;
  orgId: string;
}): ImmediateAction[] {
  const actions: ImmediateAction[] = [];

  for (const site of input.sitesAtRisk.slice(0, 3)) {
    if (site.score === null || site.score >= 70) continue;
    actions.push({
      id: `site-${site.websiteId}`,
      site: site.label ?? site.domain,
      severity: site.bucket === 'critical' ? 'critical' : 'high',
      reason:
        site.score !== null
          ? `Security score is ${site.score}/100 — review transport security and browser protection headers.`
          : 'This site needs a security review.',
      ctaLabel: site.scanId ? 'View report' : 'Manage site',
      ctaHref: site.scanId ? `/report/${site.scanId}` : '/enterprise/portal/websites',
    });
  }

  for (const alert of input.alerts.filter((a) => a.severity === 'critical' || a.severity === 'high').slice(0, 2)) {
    actions.push({
      id: `alert-${alert.id}`,
      site: alert.siteLabel,
      severity: alert.severity,
      reason: alert.message.slice(0, 120),
      ctaLabel: 'View alerts',
      ctaHref: '/dashboard/alerts',
    });
  }

  if (
    input.prioritySlotsLimit !== null &&
    input.prioritySlotsUsed !== null &&
    input.totalSites > 0 &&
    input.prioritySlotsUsed < Math.min(3, input.prioritySlotsLimit)
  ) {
    actions.push({
      id: 'priority-slots',
      site: 'Organization',
      severity: 'medium',
      reason: 'Add priority monitoring to your highest-value websites for 5-minute checks.',
      ctaLabel: 'Manage websites',
      ctaHref: '/enterprise/portal/websites',
    });
  }

  if (actions.length < 3 && input.intelligence.length > 0) {
    const signal = input.intelligence[0]!;
    actions.push({
      id: `intel-${signal.id}`,
      site: 'Monitoring',
      severity: signal.severity,
      reason: signal.detail,
      ctaLabel: 'View websites',
      ctaHref: '/enterprise/portal/websites',
    });
  }

  if (actions.length === 0 && input.totalSites > 0) {
    actions.push({
      id: 'export-report',
      site: 'Organization',
      severity: 'low',
      reason: 'Export the security posture report for stakeholders.',
      ctaLabel: 'Export PDF',
      ctaHref: '#export-pdf',
    });
  }

  return actions.slice(0, 5);
}

export function buildConciseRiskOverview(input: {
  postureState: PostureState | null;
  rollingRiskScore: number | null;
  totalSites: number;
  criticalSites: number;
  sitesAtRisk: SiteAtRisk[];
  topIssueCategories: string[];
}): { summary: string; primaryDriver: string; affectedSite: string | null; nextStep: string } {
  const postureLabel = input.postureState
    ? POSTURE_DISPLAY[input.postureState].label.toLowerCase()
    : 'unknown';
  const worst = input.sitesAtRisk[0];

  let summary: string;
  if (input.totalSites === 0) {
    summary = 'Add monitored websites to begin tracking organization security posture.';
  } else if (input.criticalSites > 0) {
    summary = `Your organization is in ${postureLabel} posture because ${input.criticalSites} of ${input.totalSites} monitored site${input.totalSites === 1 ? '' : 's'} scored below 50. Focus first on transport security and missing browser protection headers.`;
  } else if (input.rollingRiskScore !== null && input.rollingRiskScore >= 85) {
    summary = `Security posture is ${postureLabel} across ${input.totalSites} monitored site${input.totalSites === 1 ? '' : 's'}${input.rollingRiskScore !== null ? ` (rolling score ${input.rollingRiskScore}/100)` : ''}. Continue monitoring for configuration drift.`;
  } else {
    summary = `Your organization is in ${postureLabel} posture with ${input.totalSites} monitored site${input.totalSites === 1 ? '' : 's'}. Address open findings on lower-scoring properties to improve overall resilience.`;
  }

  const primaryDriver =
    input.topIssueCategories[0] ?? (input.criticalSites > 0 ? 'Critical site scores' : 'No dominant risk driver');

  return {
    summary,
    primaryDriver,
    affectedSite: worst ? worst.label ?? worst.domain : null,
    nextStep:
      input.criticalSites > 0
        ? 'Review the lowest-scoring site report and remediate missing security headers first.'
        : 'Keep monitoring enabled and export a posture report for your next review.',
  };
}

export function extractTopRiskDrivers(
  scanIssues: string[][],
  limit = 3,
): string[] {
  const categories: Record<string, number> = {
    'Missing security headers': 0,
    'Transport security': 0,
    'Third-party scripts': 0,
    'SSL / HTTPS': 0,
  };

  for (const issues of scanIssues) {
    for (const issue of issues) {
      const lower = issue.toLowerCase();
      if (/ssl|https|certificate|transport|hsts|strict-transport/.test(lower)) {
        categories['Transport security']++;
      } else if (/content-security-policy|x-frame|header|referrer-policy|permissions-policy/.test(lower)) {
        categories['Missing security headers']++;
      } else if (/script|third.?party/.test(lower)) {
        categories['Third-party scripts']++;
      } else if (/ssl|https/.test(lower)) {
        categories['SSL / HTTPS']++;
      }
    }
  }

  return Object.entries(categories)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export function latestScanPerWebsite(
  scans: Array<{
    id: string;
    websiteId: string;
    domain: string;
    label: string | null;
    score: number | null;
    status: string;
    completedAt: string | null;
  }>,
): LatestScanRow[] {
  const bySite = new Map<string, LatestScanRow>();

  for (const scan of scans) {
    const existing = bySite.get(scan.websiteId);
    if (
      !existing ||
      (scan.completedAt &&
        (!existing.completedAt ||
          new Date(scan.completedAt).getTime() > new Date(existing.completedAt).getTime()))
    ) {
      bySite.set(scan.websiteId, {
        id: scan.id,
        websiteId: scan.websiteId,
        domain: scan.domain,
        label: scan.label,
        score: scan.score,
        bucket: scoreToRiskBucket(scan.score),
        status: scan.status,
        completedAt: scan.completedAt,
      });
    }
  }

  return [...bySite.values()].sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
}

export function splitAlertsByPriority(alerts: OrgAlertRow[]): {
  urgent: OrgAlertRow[];
  lower: OrgAlertRow[];
} {
  const urgent = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  const lower = alerts.filter((a) => a.severity === 'medium' || a.severity === 'low');
  return { urgent, lower };
}

export function formatFindingMessage(issue: string, severity: FindingSeverity): string {
  const title = issue.replace(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*/i, '').trim();
  if (severity === 'critical' || severity === 'high') {
    return `New ${severity}-severity finding: ${title}`;
  }
  return `New ${severity}-severity finding: ${title}`;
}

export function resolveIssueSeverity(issue: string): FindingSeverity {
  const prefix = issue.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*/i);
  if (prefix) {
    return prefix[1]!.toLowerCase() as FindingSeverity;
  }
  return classifyIssueSeverity(issue);
}
