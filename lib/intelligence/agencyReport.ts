import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { securityScoreBand } from '@/lib/websiteHealth/healthCenterCopy';
import { explainerForSecurityFinding } from './catalog';
import { rankFixThisFirstFromFindings } from './prioritization';
import type { AgencyClientReport } from './types';

export interface AgencyReportInput {
  clientName: string;
  siteUrl: string;
  siteLabel: string;
  securityScore: number;
  findings: SecurityFinding[];
  sslValid?: boolean | null;
  changesThisMonth?: string | null;
  scansThisMonth?: number;
  alertsThisMonth?: number;
}

/** Deterministic agency client report — no paid API tokens. */
export function generateAgencyClientReport(input: AgencyReportInput): AgencyClientReport {
  const bandLabel = securityScoreBand(input.securityScore);
  const fixThisFirst = rankFixThisFirstFromFindings(input.findings, {
    sslValid: input.sslValid,
  });
  const openCount = input.findings.length;
  const scans = input.scansThisMonth ?? 0;
  const alerts = input.alertsThisMonth ?? 0;

  const clientSummary = [
    `${input.clientName} website monitoring summary.`,
    `Security score: ${input.securityScore}/100 (${bandLabel}).`,
    openCount === 0
      ? 'No open findings on the latest scan.'
      : `${openCount} finding(s) tracked on the latest scan.`,
    fixThisFirst.items[0]
      ? `Priority: ${fixThisFirst.items[0].title}.`
      : 'No urgent fixes required right now.',
  ].join(' ');

  const monthlyReport = [
    `Monthly monitoring report for ${input.siteLabel} (${input.siteUrl})`,
    '',
    `Scans completed: ${scans}`,
    `Alerts generated: ${alerts}`,
    `Current security score: ${input.securityScore}/100`,
    '',
    'Summary for client check-in:',
    clientSummary,
    '',
    'Recommended talking points:',
    '- CyberShield runs automated checks between your team’s manual reviews.',
    '- We flag SSL, uptime, and configuration changes before clients notice.',
    fixThisFirst.items[0]
      ? `- Next action: ${fixThisFirst.items[0].ownerAction}`
      : '- No urgent client action required this month.',
  ].join('\n');

  const proofOfWork = [
    'Proof of work (this billing period)',
    `- ${scans} automated security scan${scans === 1 ? '' : 's'}`,
    `- ${alerts} alert${alerts === 1 ? '' : 's'} reviewed`,
    `- ${openCount} finding${openCount === 1 ? '' : 's'} documented with fix guidance`,
    '- Change detection active on monitored URLs',
  ].join('\n');

  const changesThisMonth =
    input.changesThisMonth?.trim() ??
    (openCount > 0
      ? 'Configuration or content changes were detected — see findings below.'
      : 'No significant changes detected this month.');

  const technicalAppendix = input.findings
    .map((f) => {
      const ex = explainerForSecurityFinding(f);
      return [
        `### ${f.title} (${f.severity})`,
        ex.plainEnglish,
        `Fix: ${ex.recommendedNextStep}`,
      ].join('\n');
    })
    .join('\n\n');

  const clientNextSteps = [
    fixThisFirst.items.length > 0
      ? `1. ${fixThisFirst.items[0]!.title} — ${fixThisFirst.items[0]!.ownerAction}`
      : '1. No urgent client action — monitoring continues.',
    fixThisFirst.items[1]
      ? `2. ${fixThisFirst.items[1].title} — ${fixThisFirst.items[1].ownerAction}`
      : '2. Keep care-plan monitoring active for early warning.',
    '3. Share the developer handoff section with your technical contact if fixes are needed.',
  ].join('\n');

  return {
    clientSummary,
    monthlyReport,
    proofOfWork,
    changesThisMonth,
    fixThisFirst,
    technicalAppendix: technicalAppendix || 'No open technical findings on the latest scan.',
    clientNextSteps,
    generatedAt: new Date().toISOString(),
  };
}

export function formatAgencyReportPlainText(report: AgencyClientReport): string {
  return [
    report.monthlyReport,
    '',
    '---',
    report.proofOfWork,
    '',
    'Changes this month',
    report.changesThisMonth,
    '',
    'Fix this first',
    report.fixThisFirst.summary,
    '',
    'Client next steps',
    report.clientNextSteps,
    '',
    'Technical appendix',
    report.technicalAppendix,
  ].join('\n');
}
