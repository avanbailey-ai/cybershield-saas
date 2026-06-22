import { formatRelativeScanTime } from '@/lib/websiteHealth/healthCenterCopy';
import { getScoreBand, getWebsiteDisplayName, type ActivityFeedItem } from './dashboardCommandCenter';
import { softenDashboardAlertTitle } from './dashboardAlertClassification';

export interface ScanComparisonSummary {
  hasPreviousScan: boolean;
  isBaselineOnly: boolean;
  previousScore: number | null;
  currentScore: number | null;
  scoreDelta: number | null;
  scoreChangeLabel: string;
  meaningfulChangesCount: number;
  baselineDataPointsCount: number;
  highlights: string[];
  primaryWebsiteName: string | null;
  reportHref: string | null;
}

export interface GroupedActivityItem {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  tone: ActivityFeedItem['tone'];
  href?: string;
  isGroupedSummary: boolean;
}

const MEANINGFUL_CHANGE_TYPES = new Set([
  'security_header_changed',
  'ssl_changed',
  'script_added',
  'script_removed',
  'new_third_party_service',
  'endpoint_added',
  'login_form_detected',
  'meta_changed',
  'security_score_drop',
]);

export function splitBaselineAndMeaningfulChanges(
  changes: Array<{ scan_id: string; type: string }>,
  firstScanIdByWebsite: Map<string, string>,
  websiteIdByScanId: Map<string, string>,
): { meaningful: number; baseline: number } {
  let meaningful = 0;
  let baseline = 0;

  for (const change of changes) {
    const websiteId = websiteIdByScanId.get(change.scan_id);
    const firstScanId = websiteId ? firstScanIdByWebsite.get(websiteId) : undefined;
    const isFirstScan = firstScanId === change.scan_id;

    if (isFirstScan || !MEANINGFUL_CHANGE_TYPES.has(change.type)) {
      baseline++;
    } else {
      meaningful++;
    }
  }

  return { meaningful, baseline };
}

export function buildScanComparisonSummary(input: {
  websites: Array<{
    id: string;
    displayName: string;
    url: string;
    score: number | null;
    latestScanId: string | null;
  }>;
  latestTwoScans: Map<
    string,
    { current: { id: string; score: number | null; completedAt: string | null }; previous: { id: string; score: number | null } | null }
  >;
  meaningfulChangesCount: number;
  baselineDataPointsCount: number;
  reviewItemsCount: number;
}): ScanComparisonSummary {
  const primary =
    input.websites.find((w) => w.score !== null) ??
    input.websites[0] ??
    null;

  if (!primary) {
    return {
      hasPreviousScan: false,
      isBaselineOnly: true,
      previousScore: null,
      currentScore: null,
      scoreDelta: null,
      scoreChangeLabel: 'Add a website to start monitoring.',
      meaningfulChangesCount: 0,
      baselineDataPointsCount: 0,
      highlights: [],
      primaryWebsiteName: null,
      reportHref: null,
    };
  }

  const pair = input.latestTwoScans.get(primary.id);
  const currentScore = primary.score;
  const previousScore = pair?.previous?.score ?? null;
  const hasPreviousScan = pair?.previous != null;
  const scoreDelta =
    currentScore !== null && previousScore !== null ? currentScore - previousScore : null;

  const highlights: string[] = [];

  if (!hasPreviousScan) {
    return {
      hasPreviousScan: false,
      isBaselineOnly: true,
      previousScore: null,
      currentScore,
      scoreDelta: null,
      scoreChangeLabel: 'Initial monitoring baseline captured. Future scans will compare against this snapshot.',
      meaningfulChangesCount: input.meaningfulChangesCount,
      baselineDataPointsCount: input.baselineDataPointsCount,
      highlights: [
        input.baselineDataPointsCount > 0
          ? `${input.baselineDataPointsCount} baseline data point${input.baselineDataPointsCount === 1 ? '' : 's'} recorded — not a risk signal.`
          : 'First scan complete — monitoring is active.',
      ],
      primaryWebsiteName: primary.displayName,
      reportHref: primary.latestScanId ? `/report/${primary.latestScanId}` : null,
    };
  }

  if (scoreDelta !== null && scoreDelta !== 0) {
    highlights.push(
      scoreDelta < 0
        ? `Trust score changed from ${previousScore} to ${currentScore} — review items may have been detected, not necessarily a confirmed issue.`
        : `Trust score improved from ${previousScore} to ${currentScore}.`,
    );
  } else if (currentScore !== null) {
    highlights.push(`Trust score stable at ${currentScore}/100 (${getScoreBand(currentScore).label}).`);
  }

  if (input.reviewItemsCount > 0) {
    highlights.push(
      `${input.reviewItemsCount} review item${input.reviewItemsCount === 1 ? '' : 's'} detected on the latest scan.`,
    );
  }

  if (input.meaningfulChangesCount > 0) {
    highlights.push(
      `${input.meaningfulChangesCount} meaningful change${input.meaningfulChangesCount === 1 ? '' : 's'} since the previous scan.`,
    );
  }

  let scoreChangeLabel = 'No score change since the last scan.';
  if (scoreDelta !== null && scoreDelta < 0) {
    scoreChangeLabel = `Score changed · ${previousScore} → ${currentScore}`;
  } else if (scoreDelta !== null && scoreDelta > 0) {
    scoreChangeLabel = `Score improved · ${previousScore} → ${currentScore}`;
  }

  return {
    hasPreviousScan: true,
    isBaselineOnly: input.baselineDataPointsCount > 0 && input.meaningfulChangesCount === 0,
    previousScore,
    currentScore,
    scoreDelta,
    scoreChangeLabel,
    meaningfulChangesCount: input.meaningfulChangesCount,
    baselineDataPointsCount: input.baselineDataPointsCount,
    highlights,
    primaryWebsiteName: primary.displayName,
    reportHref: primary.latestScanId ? `/report/${primary.latestScanId}` : null,
  };
}

export function buildProtectionStatusSummary(input: {
  websites: Array<{ displayName: string; score: number | null; scoreBandLabel: string }>;
  reviewItemsCount: number;
  criticalCount: number;
  monitoringCadence: string;
  lastCheckLabel: string;
}): string {
  const count = input.websites.length;
  if (count === 0) {
    return 'Add a website to start monitoring.';
  }

  const primary = input.websites[0]!;
  const scores = input.websites.filter((w) => w.score !== null).map((w) => w.score as number);
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const sitePhrase =
    count === 1
      ? `${primary.displayName} is currently rated ${primary.scoreBandLabel}${primary.score !== null ? ` at ${primary.score}/100` : ''}`
      : `${count} websites are being monitored${avgScore !== null ? ` · average ${avgScore}/100` : ''}`;

  if (input.criticalCount > 0) {
    return `${count} website${count === 1 ? ' is' : 's are'} being monitored. ${sitePhrase}. ${input.criticalCount} item${input.criticalCount === 1 ? '' : 's'} need urgent attention.`;
  }

  if (input.reviewItemsCount > 0) {
    return `${count} website${count === 1 ? ' is' : 's are'} being monitored. ${sitePhrase}. No critical issues were found. ${input.reviewItemsCount} review item${input.reviewItemsCount === 1 ? '' : 's'} ${input.reviewItemsCount === 1 ? 'is' : 'are'} recommended.`;
  }

  return `${count} website${count === 1 ? ' is' : 's are'} being monitored. ${sitePhrase}. No critical issues were found. Monitoring is active (${input.monitoringCadence.toLowerCase()}). Last check ${input.lastCheckLabel}.`;
}

export function buildGroupedActivityFeed(input: {
  scans: Array<{
    id: string;
    websiteId: string;
    websiteLabel: string | null;
    websiteUrl: string;
    securityScore: number | null;
    status: string;
    completedAt: string | null;
    startedAt: string | null;
  }>;
  classifiedAlerts: Array<{
    id: string;
    title: string;
    message: string | null;
    createdAt: string | null;
    priority: string;
    actionHref: string;
  }>;
  meaningfulChanges: number;
}): GroupedActivityItem[] {
  const items: GroupedActivityItem[] = [];
  const now = Date.now();
  const eightHoursAgo = now - 8 * 60 * 60 * 1000;

  const routineCompleted = input.scans.filter((s) => {
    if (s.status !== 'completed') return false;
    const t = s.completedAt ?? s.startedAt;
    if (!t) return false;
    return new Date(t).getTime() >= eightHoursAgo;
  });

  if (routineCompleted.length >= 2) {
    items.push({
      id: 'routine-summary',
      title: `${routineCompleted.length} routine monitoring checks completed in the last 8 hours`,
      detail: 'Scheduled checks ran successfully. Expand alerts or reports for meaningful changes only.',
      timeLabel: 'Recent',
      tone: 'good',
      isGroupedSummary: true,
    });
  }

  const completedByWebsite = new Map<string, typeof input.scans>();
  for (const scan of input.scans.filter((s) => s.status === 'completed' && s.securityScore !== null)) {
    const list = completedByWebsite.get(scan.websiteId) ?? [];
    list.push(scan);
    completedByWebsite.set(scan.websiteId, list);
  }

  for (const [, siteScans] of completedByWebsite) {
    const sorted = [...siteScans].sort(
      (a, b) =>
        new Date(b.completedAt ?? b.startedAt ?? 0).getTime() -
        new Date(a.completedAt ?? a.startedAt ?? 0).getTime(),
    );
    const latest = sorted[0];
    const previous = sorted[1];
    if (!latest || !previous) continue;
    if (latest.securityScore === previous.securityScore) continue;

    const name = getWebsiteDisplayName(latest.websiteLabel, latest.websiteUrl);
    items.push({
      id: `score:${latest.id}`,
      title: `Latest score changed from ${previous.securityScore} to ${latest.securityScore} · ${name}`,
      detail: 'This reflects detected exposure or configuration differences — not necessarily a confirmed compromise.',
      timeLabel: latest.completedAt ? formatRelativeScanTime(latest.completedAt) : 'Recently',
      tone: latest.securityScore! >= 70 ? 'neutral' : 'warn',
      href: `/report/${latest.id}`,
      isGroupedSummary: false,
    });
  }

  for (const alert of input.classifiedAlerts.slice(0, 5)) {
    if (alert.priority === 'info') continue;
    items.push({
      id: `alert:${alert.id}`,
      title: softenDashboardAlertTitle(alert.title),
      detail: alert.message ?? 'Review the report for details.',
      timeLabel: alert.createdAt ? formatRelativeScanTime(alert.createdAt) : 'Recent',
      tone: alert.priority === 'critical' || alert.priority === 'high' ? 'warn' : 'neutral',
      href: alert.actionHref,
      isGroupedSummary: false,
    });
  }

  for (const scan of input.scans.filter((s) => s.status === 'failed').slice(0, 2)) {
    const name = getWebsiteDisplayName(scan.websiteLabel, scan.websiteUrl);
    items.push({
      id: `failed:${scan.id}`,
      title: `Monitoring check incomplete · ${name}`,
      detail: 'CyberShield will retry automatically, or run a manual scan from the website card.',
      timeLabel: scan.startedAt ? formatRelativeScanTime(scan.startedAt) : 'Recently',
      tone: 'bad',
      isGroupedSummary: false,
    });
  }

  if (input.meaningfulChanges > 0 && items.length < 6) {
    items.push({
      id: 'meaningful-changes',
      title: `${input.meaningfulChanges} meaningful change${input.meaningfulChanges === 1 ? '' : 's'} detected recently`,
      detail: 'Review Website Memory to confirm updates match your expectations.',
      timeLabel: 'Recent',
      tone: 'neutral',
      href: '/app/websites',
      isGroupedSummary: true,
    });
  }

  return items.slice(0, 8);
}

export function buildRecommendedNextStep(input: {
  recommendedActions: Array<{ title: string; priority: string; actionHref: string }>;
  reviewItemsCount: number;
  primaryReportHref: string | null;
  primaryWebsiteId: string | null;
}): {
  headline: string;
  detail: string;
  primaryLabel: string;
  primaryHref: string;
  showDeveloperActions: boolean;
} {
  const urgent = input.recommendedActions.filter((a) => a.priority === 'critical' || a.priority === 'high');
  const review = input.recommendedActions.filter((a) => a.priority === 'review');

  if (urgent.length > 0) {
    return {
      headline: `Recommended next step: Address "${urgent[0]!.title}"`,
      detail: urgent[0]!.title,
      primaryLabel: 'Open Report',
      primaryHref: urgent[0]!.actionHref,
      showDeveloperActions: true,
    };
  }

  if (review.length > 0 || input.reviewItemsCount > 0) {
    const count = Math.max(review.length, input.reviewItemsCount);
    return {
      headline: `Recommended next step: Review ${count} website trust improvement${count === 1 ? '' : 's'}.`,
      detail: 'These are preventive hardening items — not confirmed active vulnerabilities.',
      primaryLabel: 'Open Report',
      primaryHref: input.primaryReportHref ?? review[0]?.actionHref ?? '/app/reports',
      showDeveloperActions: true,
    };
  }

  return {
    headline: 'Recommended next step: No urgent action. Keep monitoring active.',
    detail: 'CyberShield will alert you when meaningful changes are detected.',
    primaryLabel: input.primaryReportHref ? 'Open Report' : 'View Websites',
    primaryHref: input.primaryReportHref ?? '/app/websites',
    showDeveloperActions: false,
  };
}
