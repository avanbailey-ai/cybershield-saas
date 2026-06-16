import { computeRollingRiskScore, type CompletedScanScoreRow } from './rollingRiskScore';
import { POSTURE_DISPLAY, scoreToPostureState, type PostureState } from './postureState';
import type { OrgAnomalyFeedItem } from './orgDashboardSummary';
import type { OrgSecurityNarrative, TrendDirection } from './narrativeTypes';

const TREND_DELTA_THRESHOLD = 10;
const TREND_WINDOW_DAYS = 7;

export interface OrgNarrativeInput {
  orgId: string;
  rollingRiskScore: number | null;
  postureState: PostureState | null;
  scans: CompletedScanScoreRow[];
  anomalies: OrgAnomalyFeedItem[];
  totalSitesMonitored: number;
  criticalAlertsCount: number;
}

function scansInLastDays(
  scans: CompletedScanScoreRow[],
  days: number,
): CompletedScanScoreRow[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return scans.filter(
    (s) => s.completed_at && new Date(s.completed_at).getTime() >= cutoff,
  );
}

/** 7-day trend: improving / degrading / stable (delta > 10). */
export function computeTrendDirection(
  allScans: CompletedScanScoreRow[],
  currentRolling: number | null,
): { direction: TrendDirection; delta: number | null } {
  const windowScans = scansInLastDays(allScans, TREND_WINDOW_DAYS)
    .filter((s) => s.security_score !== null)
    .sort(
      (a, b) =>
        new Date(a.completed_at as string).getTime() -
        new Date(b.completed_at as string).getTime(),
    );

  if (windowScans.length < 2 || currentRolling === null) {
    return { direction: 'stable', delta: null };
  }

  const midpoint = Math.floor(windowScans.length / 2);
  const earlier = windowScans.slice(0, midpoint);
  const later = windowScans.slice(midpoint);

  const avg = (rows: CompletedScanScoreRow[]) => {
    const scores = rows.map((s) => s.security_score as number);
    return scores.reduce((sum, v) => sum + v, 0) / scores.length;
  };

  const earlierAvg = avg(earlier);
  const laterAvg = avg(later);
  const delta = Math.round(laterAvg - earlierAvg);

  if (delta > TREND_DELTA_THRESHOLD) {
    return { direction: 'improving', delta };
  }
  if (delta < -TREND_DELTA_THRESHOLD) {
    return { direction: 'degrading', delta };
  }
  return { direction: 'stable', delta };
}

function buildOrgRiskOverview(input: OrgNarrativeInput): string {
  const { rollingRiskScore, postureState, totalSitesMonitored, criticalAlertsCount } = input;
  const postureLabel = postureState ? POSTURE_DISPLAY[postureState].label.toLowerCase() : 'unknown';

  if (criticalAlertsCount > 0) {
    return `The organization monitors ${totalSitesMonitored} site${totalSitesMonitored === 1 ? '' : 's'} with ${criticalAlertsCount} site${criticalAlertsCount === 1 ? '' : 's'} in critical status. Overall posture is ${postureLabel}${rollingRiskScore !== null ? ` with a rolling score of ${rollingRiskScore}/100` : ''}. Immediate remediation is recommended on affected properties.`;
  }

  if (rollingRiskScore !== null && rollingRiskScore >= 85) {
    return `Security posture across ${totalSitesMonitored} monitored site${totalSitesMonitored === 1 ? '' : 's'} is ${postureLabel}. Rolling score of ${rollingRiskScore}/100 indicates strong baseline controls with continued monitoring recommended.`;
  }

  return `The organization maintains ${totalSitesMonitored} monitored site${totalSitesMonitored === 1 ? '' : 's'} at a ${postureLabel} posture${rollingRiskScore !== null ? ` (rolling score ${rollingRiskScore}/100)` : ''}. Address open findings to reduce exposure.`;
}

function buildTrendSummary(direction: TrendDirection, delta: number | null): string {
  const windowLabel = `last ${TREND_WINDOW_DAYS} days`;

  if (direction === 'improving') {
    return `Over the ${windowLabel}, security posture is improving${delta !== null ? ` (score up ~${delta} points)` : ''}. Recent scans show fewer high-severity findings and stronger control coverage.`;
  }
  if (direction === 'degrading') {
    return `Over the ${windowLabel}, the organization has experienced a moderate increase in exposure due to newly introduced configuration-level vulnerabilities${delta !== null ? ` (score down ~${Math.abs(delta)} points)` : ''}. While no active exploitation is detected, the system shows signs of security drift requiring attention.`;
  }
  return `Security trends over the ${windowLabel} remain stable with no significant score movement beyond normal scan variance.`;
}

function buildActiveThreatsSummary(anomalies: OrgAnomalyFeedItem[]): string {
  const open = anomalies.filter((a) => !a.resolved);
  if (open.length === 0) {
    return 'No active intelligence anomalies are currently flagged for this organization.';
  }

  const critical = open.filter((a) => a.severity === 'critical');
  const high = open.filter((a) => a.severity === 'high');

  const parts: string[] = [];
  if (critical.length > 0) {
    parts.push(`${critical.length} critical anomal${critical.length === 1 ? 'y' : 'ies'}`);
  }
  if (high.length > 0) {
    parts.push(`${high.length} high-severity signal${high.length === 1 ? '' : 's'}`);
  }
  if (parts.length === 0) {
    parts.push(`${open.length} monitoring signal${open.length === 1 ? '' : 's'}`);
  }

  const latest = open[0]?.message ?? 'Review anomaly feed for details.';
  return `${parts.join(' and ')} require attention. Latest signal: ${latest}`;
}

function buildPostureExplanation(
  postureState: PostureState | null,
  rollingRiskScore: number | null,
): string {
  const resolved = postureState ?? scoreToPostureState(rollingRiskScore);
  if (!resolved) {
    return 'Insufficient scan history to establish an organization posture baseline.';
  }

  const label = POSTURE_DISPLAY[resolved].label;

  switch (resolved) {
    case 'CRITICAL':
      return `Posture is ${label}: rolling score${rollingRiskScore !== null ? ` (${rollingRiskScore}/100)` : ''} indicates widespread critical gaps. Prioritize transport security and header hardening across all properties.`;
    case 'DEGRADED':
      return `Posture is ${label}: material weaknesses are present across recent scans. Target high-severity header and configuration fixes to restore stable posture.`;
    case 'STABLE':
      return `Posture is ${label}: core controls are largely in place with remaining gaps suitable for scheduled remediation.`;
    case 'HEALTHY':
      return `Posture is ${label}: monitored sites demonstrate strong security fundamentals. Maintain continuous scanning to catch configuration drift early.`;
    default:
      return `Current organization posture: ${label}.`;
  }
}

/** Aggregated org-level security narrative — deterministic. */
export function generateOrgSecurityNarrative(input: OrgNarrativeInput): OrgSecurityNarrative {
  const currentRolling =
    input.rollingRiskScore ?? computeRollingRiskScore(input.scans);
  const { direction, delta } = computeTrendDirection(input.scans, currentRolling);

  return {
    org_risk_overview: buildOrgRiskOverview(input),
    trend_summary: buildTrendSummary(direction, delta),
    trend_direction: direction,
    active_threats_summary: buildActiveThreatsSummary(input.anomalies),
    posture_explanation: buildPostureExplanation(input.postureState, currentRolling),
  };
}
