import type { SecurityFinding, SecurityIntelligenceReport } from '@/lib/securityIntelligence/types';
import { securityScoreBand } from '@/lib/websiteHealth/healthCenterCopy';
import { explainerForSecurityFinding } from './catalog';
import { buildDeveloperHandoff, rankFixThisFirstFromFindings } from './prioritization';
import type { CustomerIntelligenceReport } from './types';

export interface CustomerReportInput {
  siteLabel: string;
  siteUrl: string;
  report: SecurityIntelligenceReport;
  findings: SecurityFinding[];
  sslValid?: boolean | null;
  sslDaysUntilExpiry?: number | null;
  previousScore?: number | null;
  changesSummary?: string | null;
  planLevel?: 'free' | 'pro' | 'growth' | 'agency' | 'enterprise';
}

function healthStatement(score: number, sslValid: boolean | null | undefined): string {
  const sslPart =
    sslValid === false
      ? 'Your HTTPS certificate needs attention.'
      : sslValid === true
        ? 'HTTPS is active.'
        : 'SSL status was not verified on this scan.';
  return `Your website security score is ${score}/100 (${securityScoreBand(score)}). ${sslPart} This reflects browser protections, connection security, and exposed site surfaces — not a guarantee of perfect security.`;
}

function changesSinceLastScan(
  previousScore: number | null | undefined,
  currentScore: number,
  changesSummary: string | null | undefined,
): string {
  if (changesSummary?.trim()) return changesSummary.trim();
  if (previousScore == null) {
    return 'This is the baseline scan — future reports will highlight what changed.';
  }
  const delta = currentScore - previousScore;
  if (delta > 0) {
    return `Score improved by ${delta} points since the last scan (${previousScore} → ${currentScore}).`;
  }
  if (delta < 0) {
    return `Score decreased by ${Math.abs(delta)} points since the last scan (${previousScore} → ${currentScore}). Review new findings below.`;
  }
  return 'Score unchanged since the last scan. Monitoring continues for configuration drift.';
}

function monitoringValue(planLevel: CustomerReportInput['planLevel']): string {
  if (planLevel === 'free') {
    return 'This scan is a one-time snapshot. Continuous monitoring catches SSL expiry, downtime, and configuration changes before customers notice — available on paid plans.';
  }
  return 'CyberShield monitors your site on a recurring schedule, alerts you when protections drift, and keeps a change history your team can act on.';
}

function upgradeReason(planLevel: CustomerReportInput['planLevel']): string | null {
  if (planLevel && planLevel !== 'free') return null;
  return 'Upgrade to Pro for daily monitoring, email alerts, and change detection — so issues are caught between manual scans.';
}

/** Deterministic customer report — no paid API tokens. */
export function generateCustomerReport(input: CustomerReportInput): CustomerIntelligenceReport {
  const { report, findings, siteLabel } = input;
  const score = report.securityScore;
  const fixThisFirst = rankFixThisFirstFromFindings(findings, {
    sslValid: input.sslValid,
    sslDaysUntilExpiry: input.sslDaysUntilExpiry,
    planLevel: input.planLevel,
  });
  const findingExplanations = findings.map(explainerForSecurityFinding);

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  const executiveSummary = [
    `${siteLabel} — security review summary`,
    criticalCount + highCount > 0
      ? `${criticalCount + highCount} higher-priority item(s) deserve attention this week.`
      : 'No critical issues detected on this scan — focus on maintaining good practices.',
    fixThisFirst.summary,
  ].join(' ');

  return {
    executiveSummary,
    healthStatement: healthStatement(score, input.sslValid),
    changesSinceLastScan: changesSinceLastScan(
      input.previousScore,
      score,
      input.changesSummary,
    ),
    fixThisFirst,
    findingExplanations,
    developerHandoff: buildDeveloperHandoff(findings),
    monitoringValue: monitoringValue(input.planLevel),
    upgradeReason: upgradeReason(input.planLevel),
    generatedAt: new Date().toISOString(),
  };
}

export function formatCustomerReportPlainText(report: CustomerIntelligenceReport): string {
  const lines = [
    'CYBERSHIELD WEBSITE REPORT',
    '',
    'Executive summary',
    report.executiveSummary,
    '',
    'Overall health',
    report.healthStatement,
    '',
    'What changed since last scan',
    report.changesSinceLastScan,
    '',
    'Fix this first',
    report.fixThisFirst.summary,
    ...report.fixThisFirst.items.map(
      (i) => `${i.rank}. ${i.title} — ${i.whyItMatters} (${i.difficulty} fix)`,
    ),
    '',
    'Monitoring value',
    report.monitoringValue,
  ];

  if (report.upgradeReason) {
    lines.push('', 'Upgrade note', report.upgradeReason);
  }

  lines.push('', 'Developer handoff', report.developerHandoff);
  return lines.join('\n');
}
