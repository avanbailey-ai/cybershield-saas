import type { AgencyClientReport } from '@/lib/intelligence/types';
import { securityScoreBand } from '@/lib/websiteHealth/healthCenterCopy';

export interface ClientOwnerExportInput {
  clientName: string;
  contactName: string;
  websiteLabel: string;
  siteUrl: string;
  securityScore: number;
  agencyName?: string | null;
  report: AgencyClientReport;
  sslStatus?: 'healthy' | 'warning' | 'critical' | 'unknown';
}

/** Calm, client-friendly executive export — copy only, never auto-sent. */
export function buildClientOwnerReport(input: ClientOwnerExportInput): string {
  const band = securityScoreBand(input.securityScore);
  const topFix = input.report.fixThisFirst.items[0];
  const sslLine =
    input.sslStatus === 'healthy'
      ? 'SSL certificate is valid and monitored.'
      : input.sslStatus === 'critical' || input.sslStatus === 'warning'
        ? 'SSL certificate needs review — your agency is tracking this.'
        : 'SSL status is being monitored.';

  return [
    `Website Health Report — ${input.websiteLabel}`,
    `Prepared for: ${input.clientName}`,
    `Website: ${input.siteUrl}`,
    `Date: ${new Date(input.report.generatedAt).toLocaleDateString()}`,
    '',
    'Executive Summary',
    input.report.clientSummary,
    '',
    `Security Score: ${input.securityScore}/100 (${band})`,
    '',
    'Priority Item to Review',
    topFix
      ? `${topFix.title} — ${topFix.ownerAction}`
      : 'No urgent items on the latest scan. Monitoring continues.',
    '',
    'Recent Changes',
    input.report.changesThisMonth,
    '',
    'SSL & Domain Status',
    sslLine,
    '',
    'Monitoring Activity',
    input.report.proofOfWork,
    '',
    'Recommended Next Steps',
    input.report.clientNextSteps,
    '',
    'Technical Appendix',
    input.report.technicalAppendix,
    '',
    input.agencyName ? `Prepared by ${input.agencyName} using CyberShield monitoring.` : 'Prepared using CyberShield monitoring.',
  ].join('\n');
}

/** Copy-ready client email — never auto-sent. */
export function buildClientOwnerEmail(input: ClientOwnerExportInput): { subject: string; body: string } {
  const topFix = input.report.fixThisFirst.items[0];
  const topItem = topFix?.title ?? 'No urgent items on the latest scan';

  const subject = `Monthly website health report for ${input.websiteLabel}`;

  const body = [
    `Hi ${input.contactName},`,
    '',
    `Here's this month's website health summary. CyberShield monitored your site for SSL, domain, uptime, security settings, and unexpected changes.`,
    '',
    `Current score: ${input.securityScore}/100`,
    `Top item to review: ${topItem}`,
    '',
    'Nothing here means the site is hacked or compromised. These are public website configuration items we\'re tracking so issues can be addressed early.',
    '',
    input.agencyName ?? 'Your website care team',
  ].join('\n');

  return { subject, body };
}

export function formatClientEmailForClipboard(input: { subject: string; body: string }): string {
  return `Subject: ${input.subject}\n\n${input.body}`;
}
