export const EXCLUDED_LEAD_STATUSES = ['spam', 'test', 'invalid', 'closed'] as const;

export type EnterpriseLeadStatus =
  | 'new'
  | 'received'
  | 'analyzed'
  | 'responded'
  | 'contacted'
  | 'qualified'
  | 'closed'
  | 'spam'
  | 'test'
  | 'invalid';

export const OWNER_LEAD_STATUS_OPTIONS: EnterpriseLeadStatus[] = [
  'new',
  'contacted',
  'responded',
  'qualified',
  'closed',
  'spam',
  'test',
];

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidLeadName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  return /[a-zA-Z]/.test(trimmed);
}

export function isValidCompany(company: string, email: string): boolean {
  const trimmed = company.trim();
  if (trimmed.length < 2) return false;
  if (isValidEmail(trimmed)) return false;
  if (trimmed.toLowerCase() === email.trim().toLowerCase()) return false;
  return true;
}

/** Reject junk domains like "s", undefined, or malformed hosts. */
export function isValidLeadDomain(domain: string | null | undefined): boolean {
  if (!domain?.trim()) return false;

  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0];

  if (host.length < 4) return false;
  if (['undefined', 'null', 'nan'].includes(host)) return false;
  if (!host.includes('.')) return false;
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(host)) return false;

  return true;
}

export function formatLeadDomainDisplay(domain: string | null | undefined): string {
  if (!isValidLeadDomain(domain)) return 'No valid domain';
  const host = domain!
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  return host;
}

export function isValidMessage(message: string | null | undefined, minLen = 10): boolean {
  if (!message?.trim()) return false;
  const trimmed = message.trim();
  if (trimmed.length < minLen) return false;
  return /[a-zA-Z]{2,}/.test(trimmed);
}

export interface LeadValidationInput {
  name: string;
  email: string;
  company?: string;
  domain?: string;
  message?: string;
}

export interface LeadValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  firstError?: string;
}

export function validateEnterpriseLead(
  input: LeadValidationInput,
  options?: { requireDomain?: boolean; requireMessage?: boolean },
): LeadValidationResult {
  const errors: Record<string, string> = {};

  if (!isValidLeadName(input.name)) {
    errors.name = 'Please enter your full name (at least 2 characters).';
  }

  if (!isValidEmail(input.email)) {
    errors.email = 'Please enter a valid work email address.';
  }

  if (input.company?.trim()) {
    if (!isValidCompany(input.company, input.email)) {
      errors.company = 'Enter a company name — not an email address.';
    }
  }

  if (input.domain?.trim()) {
    if (!isValidLeadDomain(input.domain)) {
      errors.domain = 'Please enter a valid website domain (e.g. example.com).';
    }
  } else if (options?.requireDomain) {
    errors.domain = 'Please enter the website domain you want reviewed.';
  }

  if (options?.requireMessage && !isValidMessage(input.message)) {
    errors.message = 'Please describe your security needs (at least 10 characters).';
  }

  const firstError = Object.values(errors)[0];
  return { valid: Object.keys(errors).length === 0, errors, firstError };
}

export function isExcludedLeadStatus(status: string): boolean {
  return (EXCLUDED_LEAD_STATUSES as readonly string[]).includes(status);
}

export interface LeadQualificationFields {
  status: string;
  company?: string | null;
  email?: string | null;
  domain?: string | null;
  message?: string | null;
}

/** Whether a lead counts toward pipeline value and qualified metrics. */
export function isQualifiableLead(lead: LeadQualificationFields): boolean {
  if (isExcludedLeadStatus(lead.status)) return false;
  if (!lead.email?.trim() || !isValidEmail(lead.email)) return false;
  if (!lead.company?.trim() || !isValidCompany(lead.company, lead.email)) return false;
  if (!isValidLeadDomain(lead.domain)) return false;
  return true;
}
