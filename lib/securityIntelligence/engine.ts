import type { ScanResult } from '@/lib/scanner/runScan';
import type { EngineInput, SecurityIntelligenceReport } from './types';
import { generateFindings } from './findings';
import { generateRecommendations, flattenRecommendations } from './recommendations';
import { computeAttackSurfaceScore, computeSecurityScore, scoreToRiskLevel } from './scoring';
import { detectSecurityChanges } from './changeDetection';

function normalizeScanResult(scan: ScanResult): ScanResult {
  const page = scan.pageSnapshot;
  return {
    ...scan,
    pageSnapshot: {
      metaTags: page.metaTags ?? {},
      scripts: page.scripts ?? [],
      loginFormDetected: page.loginFormDetected ?? false,
      endpoints: page.endpoints ?? [],
      formsDetected: page.formsDetected ?? 0,
      thirdPartyScripts: page.thirdPartyScripts ?? [],
      externalApiCalls: page.externalApiCalls ?? [],
      techFingerprint: page.techFingerprint ?? { frameworks: [], cdn: [], analytics: [] },
    },
  };
}

export type { SecurityIntelligenceReport, SecurityFinding, SecurityRecommendation, ChangeSummary } from './types';

/** Build summary text from findings — deterministic. */
function buildSummary(scan: ScanResult, securityScore: number, riskLevel: string): string {
  const parts: string[] = [`Security score: ${securityScore}/100 (${riskLevel} risk).`];
  parts.push(scan.ssl ? 'HTTPS is enabled.' : 'HTTPS is not enabled — traffic is unencrypted.');
  if (scan.issues.length > 0) {
    parts.push(`${scan.issues.length} issue(s) detected across transport, headers, and attack surface.`);
  } else {
    parts.push('No major issues detected.');
  }
  return parts.join(' ');
}

/** Orchestrator: Scan → Findings → Scoring → Recommendations → Change Detection → Report */
export function runSecurityIntelligence(input: EngineInput): SecurityIntelligenceReport {
  const { scanResult: rawScan, previousScan = null } = input;
  const scanResult = normalizeScanResult(rawScan);

  const findings = generateFindings(scanResult);
  const securityScore = computeSecurityScore(findings);
  const riskLevel = scoreToRiskLevel(securityScore);
  const attackSurfaceScore = computeAttackSurfaceScore(scanResult);
  const recommendations = generateRecommendations(findings);
  const changeSummary = detectSecurityChanges({ previousScan, currentScan: scanResult });

  return {
    summary: buildSummary(scanResult, securityScore, riskLevel),
    riskLevel,
    securityScore,
    attackSurfaceScore,
    findings,
    recommendations,
    changeSummary,
  };
}

/** Apply engine scoring to a scan result (updates score, riskLevel, issues, explanation). */
export function applyIntelligenceToScanResult(scan: ScanResult): ScanResult {
  const intel = runSecurityIntelligence({ scanResult: scan });
  const passed: string[] = [];

  if (scan.ssl) passed.push('HTTPS/SSL enabled');
  if (scan.headers.csp) passed.push('Content-Security-Policy header present');
  if (scan.headers.hsts) passed.push('Strict-Transport-Security (HSTS) header present');
  if (scan.headers.xFrame) passed.push('X-Frame-Options header present');
  if (scan.headers.xContentType) passed.push('X-Content-Type-Options header present');
  if (scan.headers.referrerPolicy) passed.push('Referrer-Policy header present');
  if (scan.headers.permissionsPolicy) passed.push('Permissions-Policy header present');
  if (scan.pageSnapshot.loginFormDetected) passed.push('Login form detected on page');

  const issues = intel.findings.map((f) => `${f.title} — ${f.explanation}`);

  return {
    ...scan,
    score: intel.securityScore,
    riskLevel: intel.riskLevel,
    issues,
    passed,
    explanation: intel.summary,
  };
}

/** Map intelligence report to legacy SecurityReport shape for DB storage. */
export function toLegacySecurityReport(intel: SecurityIntelligenceReport): {
  summary: string;
  riskScoreExplanation: string;
  vulnerabilities: Array<{ title: string; severity: string; description: string }>;
  businessImpact: string;
  recommendations: string[];
  urgencyStatement?: string;
} {
  const riskScore = 100 - intel.securityScore;
  let businessImpact: string;
  if (intel.securityScore < 40) {
    businessImpact =
      'Critical security gaps expose your business to data breaches, SEO penalties, and loss of customer trust.';
  } else if (intel.securityScore < 60) {
    businessImpact =
      'Notable security weaknesses increase your attack surface and may lead to compliance gaps.';
  } else if (intel.securityScore < 80) {
    businessImpact =
      'Moderate security posture — addressing remaining gaps strengthens compliance readiness.';
  } else {
    businessImpact =
      'Strong security fundamentals detected. Continued monitoring ensures new vulnerabilities are caught early.';
  }

  let urgencyStatement: string | undefined;
  if (intel.securityScore < 40) {
    urgencyStatement = 'Act within 24 hours — critical vulnerabilities may be actively exploitable.';
  } else if (intel.securityScore < 60) {
    urgencyStatement = 'Address these issues within the next week to prevent escalation.';
  }

  const changeNote =
    intel.changeSummary.posture !== 'no_change'
      ? ` Posture ${intel.changeSummary.posture} since last scan.`
      : '';

  return {
    summary: intel.summary,
    riskScoreExplanation:
      `Security score: ${intel.securityScore}/100 (risk score: ${riskScore}/100, ${intel.riskLevel} risk). ` +
      `Attack surface score: ${intel.attackSurfaceScore}/100.${changeNote}`,
    vulnerabilities: intel.findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      description: f.explanation,
    })),
    businessImpact,
    recommendations: flattenRecommendations(intel.recommendations),
    urgencyStatement,
  };
}
