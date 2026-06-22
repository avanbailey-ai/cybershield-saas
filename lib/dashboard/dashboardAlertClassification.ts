/**
 * Dashboard alert classification — display-layer priority and deduplication.
 * DB rows unchanged; used when building Recommended Actions and activity.
 */

export type DashboardActionPriority = 'critical' | 'high' | 'review' | 'info';

export interface ClassifiedDashboardAlert {
  id: string;
  scanId: string | null;
  type: string | null;
  title: string;
  message: string | null;
  websiteId: string | null;
  websiteName: string;
  websiteUrl: string | null;
  websiteLabel: string | null;
  createdAt: string | null;
  priority: DashboardActionPriority;
  /** When false, omit from Recommended Actions (show in Monitoring Activity only). */
  showInRecommendedActions: boolean;
  actionLabel: string;
  actionHref: string;
}

const INFO_TITLE_PATTERNS = [
  /monitoring baseline established/i,
  /baseline (captured|recorded|established)/i,
  /initial (monitoring )?snapshot/i,
  /monitoring check completed/i,
  /security scan completed/i,
  /first score recorded/i,
];

const SCORE_CHANGE_TYPES = new Set(['risk_increase', 'security_score_drop']);

export function isBaselineOrSetupAlert(title: string, type: string | null): boolean {
  if (type === 'monitoring_baseline' || type === 'baseline_established') return true;
  return INFO_TITLE_PATTERNS.some((p) => p.test(title));
}

export function softenDashboardAlertTitle(title: string): string {
  return title
    .replace(/Risk Score Increased/gi, 'Score changed')
    .replace(/Security score dropped/gi, 'Website trust score changed')
    .replace(/Security Score Dropped/gi, 'Website trust score changed');
}

export function mapAlertPriority(input: {
  severity: string;
  title: string;
  type: string | null;
  siteScore: number | null;
}): DashboardActionPriority {
  const { severity, title, type, siteScore } = input;

  if (isBaselineOrSetupAlert(title, type)) return 'info';

  const isScoreChangeAlert =
    (type && SCORE_CHANGE_TYPES.has(type)) ||
    /score (changed|dropped|increased)/i.test(title) ||
    /trust score changed/i.test(title);

  if (isScoreChangeAlert && siteScore !== null && siteScore >= 70 && siteScore < 90) {
    return 'review';
  }

  if (isScoreChangeAlert && siteScore !== null && siteScore >= 90) {
    return 'info';
  }

  if (severity === 'critical') return 'critical';
  if (severity === 'high') {
    if (siteScore !== null && siteScore >= 70 && !/ssl|domain|expir/i.test(title)) {
      return 'review';
    }
    return 'high';
  }
  if (severity === 'medium') return 'review';
  return 'info';
}

function priorityOrder(p: DashboardActionPriority): number {
  switch (p) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'review':
      return 2;
    default:
      return 3;
  }
}

export function priorityLabel(p: DashboardActionPriority): string {
  switch (p) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'review':
      return 'Review';
    default:
      return 'Info';
  }
}

export function overallStatusLabel(score: number | null): string {
  if (score === null) return 'Awaiting first check';
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good — review recommended';
  if (score >= 50) return 'Needs attention';
  return 'Critical attention';
}

export function dedupeScanAlerts<
  T extends {
    id: string;
    scan_id: string | null;
    type?: string | null;
    title: string;
    message: string | null;
    severity: string;
    website_id: string | null;
    created_at: string | null;
  },
>(alerts: T[]): T[] {
  const byScanScoreChange = new Map<string, T[]>();
  const rest: T[] = [];

  for (const alert of alerts) {
    if (alert.scan_id && alert.type && SCORE_CHANGE_TYPES.has(alert.type)) {
      const key = `${alert.scan_id}:${alert.website_id ?? 'account'}`;
      const list = byScanScoreChange.get(key) ?? [];
      list.push(alert);
      byScanScoreChange.set(key, list);
    } else {
      rest.push(alert);
    }
  }

  const merged: T[] = [...rest];

  for (const [, bucket] of byScanScoreChange) {
    if (bucket.length === 1) {
      merged.push(bucket[0]!);
      continue;
    }

    const primary = bucket.reduce((a, b) =>
      priorityOrder(mapAlertPriority({ severity: a.severity, title: a.title, type: a.type ?? null, siteScore: null })) <=
      priorityOrder(mapAlertPriority({ severity: b.severity, title: b.title, type: b.type ?? null, siteScore: null }))
        ? a
        : b,
    );

    const scoreMsg = bucket
      .map((a) => a.message)
      .filter(Boolean)
      .join(' ');

    merged.push({
      ...primary,
      id: `merged:${primary.scan_id}:${primary.website_id ?? 'account'}`,
      title: 'Website trust score changed',
      message: scoreMsg || primary.message,
      severity:
        bucket.some((a) => a.severity === 'critical')
          ? 'critical'
          : bucket.some((a) => a.severity === 'high')
            ? 'high'
            : 'medium',
    });
  }

  return merged;
}

export function classifyAlertsForDashboard(
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    message: string | null;
    websiteId: string | null;
    websiteUrl: string | null;
    websiteLabel: string | null;
    createdAt: string | null;
    scanId?: string | null;
    type?: string | null;
  }>,
  websites: Array<{ id: string; score: number | null; displayName: string; latestScanId: string | null }>,
  getWebsiteDisplayName: (label: string | null | undefined, url: string) => string,
): ClassifiedDashboardAlert[] {
  const deduped = dedupeScanAlerts(
    alerts.map((a) => ({
      id: a.id,
      scan_id: a.scanId ?? null,
      type: a.type ?? null,
      title: a.title,
      message: a.message,
      severity: a.severity,
      website_id: a.websiteId,
      created_at: a.createdAt,
    })),
  );

  const sourceById = new Map(alerts.map((a) => [a.id, a]));

  return deduped
    .map((alert) => {
      const source =
        sourceById.get(alert.id) ??
        [...sourceById.values()].find(
          (a) => a.scanId === alert.scan_id && a.websiteId === alert.website_id,
        );
      const site = alert.website_id ? websites.find((w) => w.id === alert.website_id) : undefined;
      const siteScore = site?.score ?? null;
      const priority = mapAlertPriority({
        severity: alert.severity,
        title: alert.title,
        type: alert.type ?? null,
        siteScore,
      });
      const title = softenDashboardAlertTitle(alert.title);
      const websiteName =
        alert.website_id && (source?.websiteLabel || source?.websiteUrl)
          ? getWebsiteDisplayName(source.websiteLabel, source.websiteUrl ?? '')
          : site?.displayName ?? 'Your account';

      const showInRecommendedActions = priority === 'critical' || priority === 'high' || priority === 'review';

      return {
        id: alert.id,
        scanId: alert.scan_id,
        type: alert.type ?? null,
        title,
        message: alert.message,
        websiteId: alert.website_id,
        websiteName,
        websiteUrl: source?.websiteUrl ?? null,
        websiteLabel: source?.websiteLabel ?? null,
        createdAt: alert.created_at,
        priority,
        showInRecommendedActions,
        actionLabel: alert.website_id
          ? site?.latestScanId
            ? 'Open Report'
            : 'Open Health Center'
          : 'View Alerts',
        actionHref: alert.website_id
          ? site?.latestScanId
            ? `/report/${site.latestScanId}`
            : `/app/websites/${alert.website_id}/health`
          : '/app/alerts',
      };
    })
    .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
}
