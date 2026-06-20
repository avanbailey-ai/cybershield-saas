/** Labels and filters for latest-vs-historical scan intelligence. */

export const HISTORICAL_FINDING_LABEL =
  'Historical — resolved or superseded by newer scan.';

export interface LatestScanContext {
  websiteId: string;
  latestScanId: string | null;
  latestScore: number | null;
  latestCompletedAt: string | null;
}

export function isHealthyLatestScore(score: number | null | undefined): boolean {
  return score !== null && score !== undefined && score >= 90;
}

/**
 * Suppress stale critical/high attention items when the latest scan is healthy.
 * Alerts created before the latest completed scan are treated as historical.
 */
export function isSupersededByLatestScan(input: {
  itemCreatedAt: string | null | undefined;
  latestCompletedAt: string | null | undefined;
  latestScore: number | null | undefined;
}): boolean {
  if (!isHealthyLatestScore(input.latestScore)) return false;
  if (!input.latestCompletedAt || !input.itemCreatedAt) return isHealthyLatestScore(input.latestScore);

  const latestMs = new Date(input.latestCompletedAt).getTime();
  const itemMs = new Date(input.itemCreatedAt).getTime();
  if (Number.isNaN(latestMs) || Number.isNaN(itemMs)) return isHealthyLatestScore(input.latestScore);

  return itemMs < latestMs;
}

export function isHistoricalScanRow(input: {
  scanId: string;
  scanCompletedAt: string | null;
  latestScanId: string | null;
  latestScore: number | null;
}): boolean {
  if (!input.latestScanId || input.scanId === input.latestScanId) return false;
  if (isHealthyLatestScore(input.latestScore)) return true;
  if (!input.scanCompletedAt || !input.latestScanId) return false;
  return input.scanId !== input.latestScanId;
}

export function historicalScanBadgeLabel(isHistorical: boolean): string | null {
  return isHistorical ? HISTORICAL_FINDING_LABEL : null;
}

export const HISTORICAL_ALERT_LABEL = 'Historical — resolved or superseded by newer scan.';

export interface LatestScanForAlertFreshness {
  scanId: string | null;
  score: number | null;
  completedAt: string | null;
  /** True when the latest scan still warrants critical/high attention. */
  hasCriticalHighFindings: boolean;
}

export interface AlertForFreshnessCheck {
  severity: string;
  createdAt: string;
  scanId?: string | null;
}

export function isUrgentAlertSeverity(severity: string): boolean {
  const normalized = severity.toLowerCase();
  return normalized === 'critical' || normalized === 'high';
}

/** Infer whether the latest scan still has critical/high-level findings. */
export function latestScanHasCriticalHighFindings(
  score: number | null | undefined,
  issues?: string[] | null,
): boolean {
  if (score !== null && score !== undefined && score < 70) return true;
  if (score !== null && score !== undefined && score >= 90) return false;
  if (!issues?.length) return score !== null && score !== undefined && score < 80;
  const urgentPattern = /critical|high|ssl|https|vulnerabilit|exposed|missing.*header/i;
  return issues.some((issue) => urgentPattern.test(issue));
}

/**
 * Whether an alert should appear in current/urgent lists for a website.
 * Does not delete history — callers hide or label stale items instead.
 */
export function isAlertCurrentForLatestScan(
  alert: AlertForFreshnessCheck,
  latest: LatestScanForAlertFreshness,
): boolean {
  if (!isUrgentAlertSeverity(alert.severity)) return true;

  if (alert.scanId && latest.scanId && alert.scanId === latest.scanId) return true;

  const score = latest.score;
  if (score === null || score === undefined) return true;

  if (score < 70) return true;

  const alertMs = alert.createdAt ? new Date(alert.createdAt).getTime() : NaN;
  const latestMs = latest.completedAt ? new Date(latest.completedAt).getTime() : NaN;
  const isOlderThanLatestScan =
    !Number.isNaN(alertMs) && !Number.isNaN(latestMs) && alertMs < latestMs;

  if (!isOlderThanLatestScan) return true;

  if (score >= 90) {
    return false;
  }

  if (score >= 70 && score < 90) {
    if (latest.hasCriticalHighFindings) return true;
    return false;
  }

  return true;
}

export function filterCurrentAlertsByLatestScan<T extends AlertForFreshnessCheck & { websiteId?: string | null }>(
  alerts: T[],
  latestByWebsite: Map<string, LatestScanForAlertFreshness>,
): T[] {
  return alerts.filter((alert) => {
    const websiteId = alert.websiteId;
    if (!websiteId) return true;
    const latest = latestByWebsite.get(websiteId);
    if (!latest) return true;
    return isAlertCurrentForLatestScan(alert, latest);
  });
}

export function historicalAlertBadgeLabel(
  alert: AlertForFreshnessCheck,
  latest: LatestScanForAlertFreshness,
): string | null {
  return isAlertCurrentForLatestScan(alert, latest) ? null : HISTORICAL_ALERT_LABEL;
}
