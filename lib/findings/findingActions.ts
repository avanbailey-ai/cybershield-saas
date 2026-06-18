import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { enrichFinding, type EnrichedFinding } from './findingEnrichment';

export interface FindingActionContext {
  siteUrl: string;
  siteLabel: string;
  reportUrl?: string;
  developerEmail?: string;
}

export interface DeveloperEmailPayload {
  subject: string;
  body: string;
  mailtoHref: string;
}

export interface TicketPayload {
  title: string;
  body: string;
}

function formatSeverity(severity: SecurityFinding['severity']): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function buildReportLink(ctx: FindingActionContext): string {
  if (ctx.reportUrl) return ctx.reportUrl;
  if (ctx.siteUrl) return ctx.siteUrl;
  return 'CyberShield security report';
}

function buildEnrichedOrFallback(
  finding: SecurityFinding,
  enriched?: EnrichedFinding,
): EnrichedFinding {
  return enriched ?? enrichFinding(finding);
}

/** Pre-filled email for sharing a finding with a developer or agency contact. */
export function buildDeveloperEmailPayload(
  finding: SecurityFinding,
  ctx: FindingActionContext,
  enriched?: EnrichedFinding,
): DeveloperEmailPayload {
  const detail = buildEnrichedOrFallback(finding, enriched);
  const reportLink = buildReportLink(ctx);

  const subject = `[CyberShield] ${formatSeverity(detail.severity)}: ${detail.title} — ${ctx.siteLabel}`;

  const lines = [
    `Hi,`,
    ``,
    `CyberShield flagged a security finding on ${ctx.siteLabel} (${ctx.siteUrl}).`,
    ``,
    `Finding: ${detail.title}`,
    `Severity: ${formatSeverity(detail.severity)}`,
    ``,
    `Summary:`,
    detail.summary,
    ``,
    `Why it matters:`,
    ...detail.impactBullets.map((item) => `- ${item}`),
    ``,
    `Recommended fix:`,
    ...detail.remediationSteps.map((step, index) => `${index + 1}. ${step}`),
    ``,
    `Technical note:`,
    detail.technicalFix,
    ``,
    `Full report: ${reportLink}`,
    ``,
    `Thanks,`,
    `Sent via CyberShield`,
  ];

  const body = lines.join('\n');
  const recipient = ctx.developerEmail?.trim() ?? '';
  const mailtoQuery = new URLSearchParams({
    subject,
    body,
  }).toString();

  const mailtoHref = recipient
    ? `mailto:${encodeURIComponent(recipient)}?${mailtoQuery}`
    : `mailto:?${mailtoQuery}`;

  return { subject, body, mailtoHref };
}

/** Markdown-friendly ticket text for Jira, Linear, GitHub Issues, etc. */
export function buildTicketPayload(
  finding: SecurityFinding,
  ctx: FindingActionContext,
  enriched?: EnrichedFinding,
): TicketPayload {
  const detail = buildEnrichedOrFallback(finding, enriched);
  const reportLink = buildReportLink(ctx);

  const title = `[Security] ${detail.title} — ${ctx.siteLabel}`;

  const body = [
    `## Summary`,
    detail.summary,
    ``,
    `**Site:** ${ctx.siteLabel}`,
    `**URL:** ${ctx.siteUrl}`,
    `**Severity:** ${formatSeverity(detail.severity)}`,
    `**Category:** ${detail.category}`,
    ``,
    `## Business impact`,
    ...detail.impactBullets.map((item) => `- ${item}`),
    ``,
    `## Exploit scenario`,
    detail.exploitScenario,
    ``,
    `## Remediation steps`,
    ...detail.remediationSteps.map((step, index) => `${index + 1}. ${step}`),
    ``,
    `## Technical fix`,
    '```',
    detail.technicalFix,
    '```',
    ``,
    `## Report`,
    reportLink,
  ].join('\n');

  return { title, body };
}

/** Compact clipboard text for quick paste into Slack or email. */
export function buildFindingClipboardText(
  finding: SecurityFinding,
  ctx: FindingActionContext,
  enriched?: EnrichedFinding,
): string {
  return buildTicketPayload(finding, ctx, enriched).body;
}
