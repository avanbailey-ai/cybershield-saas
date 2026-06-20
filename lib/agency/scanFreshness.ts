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
