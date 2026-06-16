import type { CompletedScanScoreRow } from './rollingRiskScore';
import { computeRollingRiskScore } from './rollingRiskScore';
import {
  classifyIssueSeverity,
  diffScanFindings,
  isHighOrCriticalSeverity,
  type ScanFindingRow,
} from './scanDiff';

export type AnomalyType = 'sudden_drop' | 'new_critical_finding' | 'volatility';
export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DetectedAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  websiteId: string | null;
}

export const VOLATILITY_WINDOW = 5;
export const VOLATILITY_VARIANCE_THRESHOLD = 75;
export const SUDDEN_DROP_THRESHOLD = 15;

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

/** Org-level rolling score drop vs prior stored value. */
export function detectRollingScoreDrop(
  previousRollingScore: number | null,
  currentRollingScore: number | null,
): DetectedAnomaly | null {
  if (
    previousRollingScore === null ||
    currentRollingScore === null ||
    previousRollingScore - currentRollingScore < SUDDEN_DROP_THRESHOLD
  ) {
    return null;
  }

  const drop = previousRollingScore - currentRollingScore;
  return {
    type: 'sudden_drop',
    severity: drop >= 25 ? 'critical' : 'high',
    message: `Org rolling risk score dropped ${drop} points (${previousRollingScore} → ${currentRollingScore})`,
    websiteId: null,
  };
}

/** Per-website score drop between consecutive completed scans. */
export function detectWebsiteScoreDrop(
  previous: ScanFindingRow | null,
  current: ScanFindingRow,
): DetectedAnomaly | null {
  if (
    !previous ||
    previous.security_score === null ||
    current.security_score === null
  ) {
    return null;
  }

  const drop = previous.security_score - current.security_score;
  if (drop < SUDDEN_DROP_THRESHOLD) return null;

  return {
    type: 'sudden_drop',
    severity: drop >= 25 ? 'critical' : 'high',
    message: `Security score dropped ${drop} points (${previous.security_score} → ${current.security_score})`,
    websiteId: current.website_id,
  };
}

/** New HIGH/CRITICAL findings vs previous scan on the same website. */
export function detectNewCriticalFindings(
  previous: ScanFindingRow | null,
  current: ScanFindingRow,
): DetectedAnomaly[] {
  const diff = diffScanFindings(previous, current);
  const anomalies: DetectedAnomaly[] = [];

  for (const issue of diff.escalated) {
    const severity = classifyIssueSeverity(issue);
    if (!isHighOrCriticalSeverity(severity)) continue;

    anomalies.push({
      type: 'new_critical_finding',
      severity: severity === 'critical' ? 'critical' : 'high',
      message: `New ${severity} finding: ${issue}`,
      websiteId: current.website_id,
    });
  }

  return anomalies;
}

/** High variance across recent org scan scores. */
export function detectScoreVolatility(
  scans: CompletedScanScoreRow[],
  windowSize = VOLATILITY_WINDOW,
): DetectedAnomaly | null {
  const scores = scans
    .filter((s) => s.security_score !== null && s.completed_at)
    .sort(
      (a, b) =>
        new Date(b.completed_at as string).getTime() -
        new Date(a.completed_at as string).getTime(),
    )
    .slice(0, windowSize)
    .map((s) => s.security_score as number);

  if (scores.length < windowSize) return null;

  const scoreVariance = variance(scores);
  if (scoreVariance <= VOLATILITY_VARIANCE_THRESHOLD) return null;

  return {
    type: 'volatility',
    severity: scoreVariance >= 150 ? 'high' : 'medium',
    message: `Score volatility detected across last ${windowSize} scans (variance ${Math.round(scoreVariance)})`,
    websiteId: null,
  };
}

export interface AnomalyDetectionInput {
  orgScans: CompletedScanScoreRow[];
  previousRollingScore: number | null;
  currentRollingScore: number | null;
  websiteScanPairs: Array<{
    websiteId: string;
    previous: ScanFindingRow | null;
    current: ScanFindingRow;
  }>;
}

export function detectOrgAnomalies(input: AnomalyDetectionInput): DetectedAnomaly[] {
  const { orgScans, previousRollingScore, currentRollingScore, websiteScanPairs } = input;
  const anomalies: DetectedAnomaly[] = [];

  const rollingDrop = detectRollingScoreDrop(previousRollingScore, currentRollingScore);
  if (rollingDrop) anomalies.push(rollingDrop);

  const volatility = detectScoreVolatility(orgScans);
  if (volatility) anomalies.push(volatility);

  for (const pair of websiteScanPairs) {
    const siteDrop = detectWebsiteScoreDrop(pair.previous, pair.current);
    if (siteDrop) anomalies.push(siteDrop);
    anomalies.push(...detectNewCriticalFindings(pair.previous, pair.current));
  }

  return anomalies;
}

/** Convenience: recompute rolling score then run full anomaly pass. */
export function detectAnomaliesFromScans(
  orgScans: CompletedScanScoreRow[],
  findingScans: ScanFindingRow[],
  previousRollingScore: number | null,
): DetectedAnomaly[] {
  const currentRollingScore = computeRollingRiskScore(orgScans);

  const latestByWebsite = new Map<string, ScanFindingRow>();
  for (const scan of [...findingScans].sort(
    (a, b) =>
      new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime(),
  )) {
    if (!latestByWebsite.has(scan.website_id)) {
      latestByWebsite.set(scan.website_id, scan);
    }
  }

  const websiteScanPairs: AnomalyDetectionInput['websiteScanPairs'] = [];

  for (const current of latestByWebsite.values()) {
    const previous = findingScans
      .filter(
        (s) =>
          s.website_id === current.website_id &&
          s.id !== current.id &&
          s.completed_at &&
          current.completed_at &&
          new Date(s.completed_at).getTime() < new Date(current.completed_at).getTime(),
      )
      .sort(
        (a, b) =>
          new Date(b.completed_at as string).getTime() -
          new Date(a.completed_at as string).getTime(),
      )[0] ?? null;

    websiteScanPairs.push({
      websiteId: current.website_id,
      previous,
      current,
    });
  }

  return detectOrgAnomalies({
    orgScans,
    previousRollingScore,
    currentRollingScore,
    websiteScanPairs,
  });
}
