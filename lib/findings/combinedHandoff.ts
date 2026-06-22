import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { buildBusinessFindingCopy } from '@/lib/report/findingBusinessCopy';
import { enrichFinding, type EnrichedFinding } from './findingEnrichment';
import type { DeveloperEmailPayload, FindingActionContext, TicketPayload } from './findingActions';

export interface ReportHandoffMeta {
  scanDate: string;
  securityScore: number | null;
  riskLevel: string;
}

export interface CombinedHandoffContext extends FindingActionContext {
  handoff: ReportHandoffMeta;
}

export interface CombinedHandoffItem {
  rank: number;
  finding: SecurityFinding;
  enriched: EnrichedFinding;
  plainTitle: string;
  effortLabel: string;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
  }
}

function formatSeverity(severity: SecurityFinding['severity']): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function effortLabelForFinding(finding: SecurityFinding): string {
  if (finding.category === 'headers' || finding.category === 'transport') {
    return finding.severity === 'critical' ? 'Moderate · 1–2 hours' : 'Easy · 15–30 minutes';
  }
  if (finding.category === 'third_party') return 'Moderate · 1–3 hours';
  if (finding.category === 'authentication') return 'Moderate · 2–4 hours';
  return finding.severity === 'low' ? 'Easy · 30 minutes' : 'Moderate · 1–2 hours';
}

export function orderFindingsForHandoff(
  findings: SecurityFinding[],
  priorityFindingIds: string[],
): SecurityFinding[] {
  const remaining = new Map(findings.map((f) => [f.id, f]));
  const ordered: SecurityFinding[] = [];

  for (const id of priorityFindingIds) {
    const finding = remaining.get(id);
    if (finding) {
      ordered.push(finding);
      remaining.delete(id);
    }
  }

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  ordered.push(
    ...[...remaining.values()].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    ),
  );

  return ordered;
}

export function buildCombinedHandoffItems(
  findings: SecurityFinding[],
  priorityFindingIds: string[] = [],
): CombinedHandoffItem[] {
  const ordered = orderFindingsForHandoff(findings, priorityFindingIds);
  return ordered.map((finding, index) => {
    const business = buildBusinessFindingCopy(finding);
    return {
      rank: index + 1,
      finding,
      enriched: enrichFinding(finding),
      plainTitle: business.plainTitle,
      effortLabel: effortLabelForFinding(finding),
    };
  });
}

export function buildRecommendedFixOrder(items: CombinedHandoffItem[]): string[] {
  return items.map((item) => item.plainTitle);
}

function findingEmailBlock(item: CombinedHandoffItem): string[] {
  const fixSteps = item.enriched.remediationSteps.map((step) => `* ${step}`);
  return [
    `${item.rank}. ${item.plainTitle}`,
    `   Severity: ${formatSeverity(item.finding.severity)}`,
    `   What was found: ${item.enriched.summary}`,
    `   Why it matters: ${item.enriched.businessImpact}`,
    `   Recommended fixes:`,
    ...fixSteps.map((line) => `   ${line}`),
    `   Estimated effort: ${item.effortLabel}`,
    '',
  ];
}

/** Single developer email covering all findings. */
export function buildCombinedDeveloperEmailPayload(
  findings: SecurityFinding[],
  ctx: CombinedHandoffContext,
  priorityFindingIds: string[] = [],
): DeveloperEmailPayload {
  const domain = domainFromUrl(ctx.siteUrl);
  const items = buildCombinedHandoffItems(findings, priorityFindingIds);
  const score =
    ctx.handoff.securityScore !== null ? `${ctx.handoff.securityScore}/100` : 'Not scored';
  const count = items.length;

  const subject = `CyberShieldCloud website hardening items for ${domain}`;

  const lines = [
    'Hi,',
    '',
    `CyberShieldCloud scanned ${domain} on ${ctx.handoff.scanDate} and found ${count} recommended website trust/security improvement${count === 1 ? '' : 's'}.`,
    '',
    `Website: ${ctx.siteUrl}`,
    `Current score: ${score}`,
    `Risk level: ${ctx.handoff.riskLevel}`,
    '',
    'Recommended priority: Review and address the items below, then rerun the scan.',
    '',
    ...items.flatMap((item) => findingEmailBlock(item)),
    'Please confirm once these items have been reviewed or fixed so we can run a follow-up scan.',
    '',
    ctx.reportUrl ? `Full report: ${ctx.reportUrl}` : '',
    '',
    'Thanks,',
    'Sent via CyberShieldCloud',
  ].filter((line) => line !== '');

  const body = lines.join('\n');
  const recipient = ctx.developerEmail?.trim() ?? '';
  const mailtoQuery = new URLSearchParams({ subject, body }).toString();
  const mailtoHref = recipient
    ? `mailto:${encodeURIComponent(recipient)}?${mailtoQuery}`
    : `mailto:?${mailtoQuery}`;

  return { subject, body, mailtoHref };
}

/** Combined ticket for Jira, Linear, GitHub Issues, etc. */
export function buildCombinedTicketPayload(
  findings: SecurityFinding[],
  ctx: CombinedHandoffContext,
  priorityFindingIds: string[] = [],
): TicketPayload {
  const domain = domainFromUrl(ctx.siteUrl);
  const items = buildCombinedHandoffItems(findings, priorityFindingIds);
  const score =
    ctx.handoff.securityScore !== null ? `${ctx.handoff.securityScore}/100` : 'Not scored';

  const title = `Review CyberShieldCloud website hardening items for ${domain}`;

  const checklist = items.map(
    (item) => `- [ ] ${item.plainTitle} (${formatSeverity(item.finding.severity)})`,
  );

  const findingSections = items.flatMap((item) => [
    `### ${item.rank}. ${item.plainTitle}`,
    `**Severity:** ${formatSeverity(item.finding.severity)}`,
    '',
    `**What was found:** ${item.enriched.summary}`,
    '',
    `**Why it matters:** ${item.enriched.businessImpact}`,
    '',
    '**Fix steps:**',
    ...item.enriched.remediationSteps.map((step, i) => `${i + 1}. ${step}`),
    '',
    `**Estimated effort:** ${item.effortLabel}`,
    '',
  ]);

  const body = [
    '## Overview',
    `CyberShieldCloud scanned **${ctx.siteUrl}** on ${ctx.handoff.scanDate}.`,
    `Current score: **${score}** · Risk level: **${ctx.handoff.riskLevel}**`,
    '',
    '## Acceptance criteria',
    '- All checklist items reviewed or remediated',
    '- No private keys or tokens exposed client-side (where applicable)',
    '- Follow-up CyberShield scan shows expected improvements',
    '',
    '## Finding checklist',
    ...checklist,
    '',
    '## Fix steps by finding',
    ...findingSections,
    '## Verification steps',
    '1. Deploy fixes to staging or production as appropriate',
    '2. Manually verify affected pages (login routes, scripts, headers, APIs)',
    '3. Rerun CyberShield scan from the dashboard',
    '4. Confirm score and findings reflect the changes',
    '',
    '## Report',
    ctx.reportUrl ?? ctx.siteUrl,
  ].join('\n');

  return { title, body };
}

/** Plain-text export suitable for clipboard / future PDF handoff. */
export function buildCombinedHandoffExportText(
  findings: SecurityFinding[],
  ctx: CombinedHandoffContext,
  priorityFindingIds: string[] = [],
): string {
  return buildCombinedDeveloperEmailPayload(findings, ctx, priorityFindingIds).body;
}
