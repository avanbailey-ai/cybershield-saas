import { generateFindings } from '@/lib/securityIntelligence/findings';
import { generateRecommendations } from '@/lib/securityIntelligence/recommendations';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { buildScanResultFromRow, type PersistedScanRow } from '@/lib/report/intelligenceFromScan';

import type { PostureState } from './postureState';
import {
  classifyIssueSeverity,
  diffScanFindings,
  normalizeIssues,
  type ScanFindingDiff,
  type ScanFindingRow,
} from './scanDiff';
import type { SecurityNarrative, UrgencyLevel } from './narrativeTypes';

export interface NarrativeEngineInput {
  scanRow: ScanFindingRow & PersistedScanRow;
  url: string;
  previousScan: ScanFindingRow | null;
  orgAnomalies: Array<{
    type: string;
    severity: string;
    message: string;
    websiteId: string | null;
  }>;
  rollingRiskScore: number | null;
  postureState: PostureState | null;
}

const MAX_KEY_EVENTS = 5;
const MAX_RECOMMENDED_ACTIONS = 8;

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function issuesBySeverity(issues: string[]): {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
} {
  const buckets = { critical: [] as string[], high: [] as string[], medium: [] as string[], low: [] as string[] };
  for (const issue of issues) {
    buckets[classifyIssueSeverity(issue)].push(issue);
  }
  return buckets;
}

/** A. Executive summary — deterministic severity rules. */
export function buildExecutiveSummary(issues: string[]): string {
  const { critical, high } = issuesBySeverity(issues);

  if (critical.length > 0) {
    return 'Critical security vulnerabilities detected that may expose the system to active exploitation.';
  }
  if (high.length > 0) {
    return 'Multiple high-risk vulnerabilities were identified requiring attention.';
  }
  return 'Security posture is stable with no critical exposures detected.';
}

/** B. Risk story — structured paragraph from scan diff. */
export function buildRiskStory(diff: ScanFindingDiff, securityScore: number | null): string {
  const parts: string[] = [];

  if (diff.added.length > 0) {
    parts.push('New vulnerabilities were introduced since the last scan.');
  }
  if (diff.escalated.length > 0) {
    parts.push('Previously identified issues have increased in severity.');
  }
  if (diff.removed.length > 0) {
    parts.push('Some vulnerabilities have been resolved.');
  }

  if (parts.length === 0) {
    if (securityScore !== null && securityScore >= 90) {
      return 'No material changes were detected since the last scan. Current controls remain effective.';
    }
    return 'Scan results are consistent with the previous assessment with no significant drift detected.';
  }

  const scoreNote =
    securityScore !== null
      ? ` Current security score is ${securityScore}/100.`
      : '';

  return `${parts.join(' ')}${scoreNote}`.trim();
}

/** C. Business impact — severity-driven messaging. */
export function buildBusinessImpact(issues: string[]): string {
  const { critical, high } = issuesBySeverity(issues);

  if (critical.length > 0) {
    return 'These issues may allow unauthorized access, data exposure, or service disruption.';
  }
  if (high.length > 0) {
    return 'These vulnerabilities increase attack surface and operational risk.';
  }
  return 'Low immediate business risk but recommended for hardening.';
}

/** D. Key events — scan diff + anomalies, max 5. */
export function buildKeyEvents(
  diff: ScanFindingDiff,
  anomalies: NarrativeEngineInput['orgAnomalies'],
  websiteId: string,
): string[] {
  const events: string[] = [];

  for (const issue of diff.escalated) {
    const severity = classifyIssueSeverity(issue);
    if (severity === 'critical') {
      events.push('New critical vulnerability detected');
    } else if (severity === 'high') {
      events.push('High-severity finding introduced');
    }
  }

  if (diff.added.length > 0 && diff.escalated.length === 0) {
    events.push('Attack surface increased');
  }

  if (diff.removed.length > 0) {
    events.push('Security improvements applied');
  }

  if (diff.added.length > 0 || diff.removed.length > 0) {
    events.push('Configuration drift identified');
  }

  for (const anomaly of anomalies) {
    if (anomaly.websiteId && anomaly.websiteId !== websiteId) continue;

    if (anomaly.type === 'sudden_drop') {
      events.push('Security posture regression detected');
    } else if (anomaly.type === 'new_critical_finding') {
      events.push('New critical vulnerability detected');
    } else if (anomaly.type === 'volatility') {
      events.push('Score volatility detected across recent scans');
    }
  }

  const unique = [...new Set(events)];

  if (unique.length === 0) {
    return ['No significant changes detected'];
  }

  return unique.slice(0, MAX_KEY_EVENTS);
}

/** Map intelligence findings + issue patterns to actionable strings. */
function findingsToActions(findings: SecurityFinding[], issues: string[]): string[] {
  const actions: string[] = [];
  const recommendations = generateRecommendations(findings);

  for (const rec of recommendations) {
    actions.push(rec.title);
  }

  const issueText = issues.join(' ').toLowerCase();

  if (/content-security-policy|csp/i.test(issueText) && !actions.some((a) => /csp/i.test(a))) {
    actions.push('Add Content-Security-Policy header');
  }
  if (/strict-transport-security|hsts/i.test(issueText) && !actions.some((a) => /hsts/i.test(a))) {
    actions.push('Enable Strict-Transport-Security');
  }
  if (/xss|cross-site scripting/i.test(issueText)) {
    actions.push('Sanitize inputs and enforce CSP rules');
  }

  return actions;
}

/** E. Recommended actions — intelligence findings + anomaly rules, prioritized. */
export function buildRecommendedActions(
  findings: SecurityFinding[],
  issues: string[],
  anomalies: NarrativeEngineInput['orgAnomalies'],
  websiteId: string,
): string[] {
  const actions = findingsToActions(findings, issues);

  const siteAnomalies = anomalies.filter(
    (a) => !a.websiteId || a.websiteId === websiteId,
  );
  if (siteAnomalies.length > 0) {
    actions.push('Investigate recent configuration changes');
  }

  const deduped = [...new Set(actions)];

  const sorted = deduped.sort((a, b) => {
    const rankA = findings.find((f) => a.includes(f.title.split(' ')[0]))?.severity ?? 'medium';
    const rankB = findings.find((f) => b.includes(f.title.split(' ')[0]))?.severity ?? 'medium';
    return (SEVERITY_ORDER[rankA] ?? 2) - (SEVERITY_ORDER[rankB] ?? 2);
  });

  return sorted.slice(0, MAX_RECOMMENDED_ACTIONS);
}

/** F. Urgency level — findings, rolling score, anomalies. */
export function computeUrgencyLevel(
  issues: string[],
  rollingRiskScore: number | null,
  anomalies: NarrativeEngineInput['orgAnomalies'],
  websiteId: string,
): UrgencyLevel {
  const { critical } = issuesBySeverity(issues);
  if (critical.length > 0) return 'critical';

  if (rollingRiskScore !== null && rollingRiskScore < 50) return 'high';

  const relevantAnomalies = anomalies.filter(
    (a) => !a.websiteId || a.websiteId === websiteId,
  );
  if (relevantAnomalies.length > 0) return 'medium';

  return 'low';
}

/** Full scan-level security narrative — deterministic, no AI. */
export function generateSecurityNarrative(input: NarrativeEngineInput): SecurityNarrative {
  const { scanRow, url, previousScan, orgAnomalies, rollingRiskScore } = input;

  const issues = normalizeIssues(scanRow.issues);
  const diff = diffScanFindings(previousScan, scanRow);
  const scanResult = buildScanResultFromRow(url, scanRow);
  const findings = generateFindings(scanResult);

  const executive_summary = buildExecutiveSummary(issues);
  const risk_story = buildRiskStory(diff, scanRow.security_score);
  const business_impact = buildBusinessImpact(issues);
  const key_events = buildKeyEvents(diff, orgAnomalies, scanRow.website_id);
  const recommended_actions = buildRecommendedActions(
    findings,
    issues,
    orgAnomalies,
    scanRow.website_id,
  );
  const urgency_level = computeUrgencyLevel(
    issues,
    rollingRiskScore,
    orgAnomalies,
    scanRow.website_id,
  );

  return {
    executive_summary,
    risk_story,
    key_events,
    business_impact,
    recommended_actions,
    urgency_level,
  };
}
