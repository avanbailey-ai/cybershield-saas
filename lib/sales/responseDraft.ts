export interface ResponseDraftInput {
  name: string;
  company?: string | null;
  domain?: string | null;
  company_size?: string | null;
  security_needs?: string[] | null;
  message?: string | null;
  last_scan_score?: number | null;
  risk_level?: string | null;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there';
}

function companyLabel(company: string | null | undefined, domain: string | null | undefined): string {
  if (company?.trim()) return company.trim();
  if (domain?.trim()) return domain.trim();
  return 'your organization';
}

function needSummary(needs: string[] | null | undefined, message: string | null | undefined): string {
  const list = needs?.filter(Boolean) ?? [];
  if (list.length > 0) {
    const joined = list.slice(0, 3).join(', ');
    return list.length > 3 ? `${joined}, and related security coverage` : joined;
  }
  const msg = message?.trim();
  if (msg && msg.length >= 10) {
    return msg.length > 120 ? `${msg.slice(0, 117)}…` : msg;
  }
  return 'security monitoring and compliance reporting';
}

function urgencyLine(input: ResponseDraftInput): string {
  const needs = (input.security_needs ?? []).map((n) => n.toLowerCase());
  const msg = (input.message ?? '').toLowerCase();
  const urgent =
    input.risk_level === 'critical' ||
    input.risk_level === 'high' ||
    (input.last_scan_score != null && input.last_scan_score < 50) ||
    /\burgent|asap|deadline|breach|incident\b/i.test(msg);

  if (needs.some((n) => /soc2|hipaa|pci|audit/.test(n)) || /\bsoc2|hipaa|pci|audit\b/i.test(msg)) {
    return 'I can help scope audit-supporting reports, continuous monitoring, and documentation that supports compliance workflows — without overpromising certifications we have not completed.';
  }

  if (needs.some((n) => /multi-tenant|agency|client/.test(n)) || /\bagency|client|multi-tenant\b/i.test(msg)) {
    return 'If you manage multiple client or business-unit websites, we can structure multi-tenant monitoring, reporting, and review coverage around your team workflow.';
  }

  if (urgent) {
    return 'Given the urgency signals in your request, the next step is a focused risk triage on the websites you want covered and a short list of immediate remediation priorities.';
  }

  if (input.last_scan_score != null) {
    return `Based on the scan context (${input.last_scan_score}/100), I can help prioritize findings, monitoring coverage, and a practical remediation plan.`;
  }

  return 'I can help scope a security review covering website risk, monitoring needs, reporting, and next steps.';
}

/** Founder-led suggested reply for owner CRM (display/copy only — not auto-sent). */
export function buildSuggestedResponseDraft(input: ResponseDraftInput): string {
  const greeting = firstName(input.name);
  const org = companyLabel(input.company, input.domain);
  const website = input.domain?.trim()
    ? input.domain.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    : null;
  const needs = needSummary(input.security_needs, input.message);
  const context = urgencyLine(input);

  const reviewTarget = website ? `${org} (${website})` : org;

  return [
    `Hi ${greeting},`,
    '',
    `Thanks for requesting a CyberShield security review for ${reviewTarget}. I reviewed your request and saw that you're looking for help with ${needs}.`,
    '',
    context,
    '',
    'The next best step is to confirm the websites you want monitored and understand any compliance deadlines or security concerns you are working around.',
    '',
    'Would you be open to a quick call this week to scope coverage?',
    '',
    'Best,',
    'CyberShield Team',
  ].join('\n');
}
