import type { LeadScore } from './types';
import type { ContactSignals } from './contactDiscovery';

export type PlanFit = 79 | 149 | 299;

const PRIORITY_INDUSTRY_KEYWORDS = [
  'agency',
  'agencies',
  'medical',
  'healthcare',
  'dental',
  'law',
  'legal',
  'attorney',
  'accounting',
  'accountant',
  'saas',
  'software',
  'e-commerce',
  'ecommerce',
  'retail',
  'professional services',
  'technology',
];

const DEPRIORITIZE_KEYWORDS = [
  'government',
  'municipal',
  'county',
  'federal',
  'blog',
  'personal',
  'hobby',
  'directory',
  'wiki',
  'nonprofit',
  'church',
  'school',
  'school district',
  'university',
  'college',
  'parked domain',
  'under construction',
  'coming soon',
  'test site',
  'localhost',
  'wix free',
  'godaddy parking',
];

const JUNK_WEBSITE_PATTERNS = [
  /parked/i,
  /domain.*for sale/i,
  /under construction/i,
  /coming soon/i,
  /\.blogspot\./i,
  /\.wordpress\.com$/i,
  /example\.(com|org)/i,
];

export function normalizeIndustryKey(industry: string | null, businessName?: string | null): string {
  return `${industry ?? ''} ${businessName ?? ''}`.toLowerCase();
}

export function isDeprioritizedIndustry(industry: string | null, businessName?: string | null): boolean {
  const key = normalizeIndustryKey(industry, businessName);
  return DEPRIORITIZE_KEYWORDS.some((w) => key.includes(w));
}

export function isJunkProspect(input: {
  website?: string | null;
  businessName?: string | null;
  industry?: string | null;
  httpValid?: boolean | null;
  dnsValid?: boolean | null;
}): boolean {
  if (isDeprioritizedIndustry(input.industry ?? null, input.businessName)) return true;
  const site = `${input.website ?? ''} ${input.businessName ?? ''}`;
  if (JUNK_WEBSITE_PATTERNS.some((p) => p.test(site))) return true;
  if (input.httpValid === false && input.dnsValid === false) return true;
  return false;
}

export function industryFitPoints(industry: string | null, businessName?: string | null): number {
  if (isDeprioritizedIndustry(industry, businessName)) return -25;
  const key = normalizeIndustryKey(industry, businessName);
  const hits = PRIORITY_INDUSTRY_KEYWORDS.filter((w) => key.includes(w)).length;
  if (hits >= 2) return 28;
  if (hits === 1) return 18;
  return 8;
}

export function contactAvailabilityPoints(signals: ContactSignals): number {
  let pts = 0;
  if (signals.contact_email_found) pts += 12;
  if (signals.contact_phone_found) pts += 8;
  if (signals.contact_page_found) pts += 6;
  if (signals.contact_linkedin_found) pts += 4;
  return Math.min(25, pts);
}

export function securityUrgencyPoints(
  scanScore: number | null,
  scanRiskLevel: string | null,
  leadScore: LeadScore | null,
): number {
  if (scanScore === null && !leadScore) return 0;
  let pts = 0;
  const risk = scanRiskLevel?.toLowerCase() ?? '';
  if (risk === 'critical' || risk === 'high') pts += 18;
  else if (risk === 'medium') pts += 12;
  else if (risk === 'low') pts += 4;

  if (scanScore !== null) {
    if (scanScore < 40) pts += 12;
    else if (scanScore < 60) pts += 8;
    else if (scanScore < 75) pts += 4;
  }

  if (leadScore === 'HOT') pts += 6;
  else if (leadScore === 'WARM') pts += 3;

  return Math.min(30, pts);
}

export interface OpportunityScoreInput {
  website?: string | null;
  industry: string | null;
  businessName?: string | null;
  scanScore: number | null;
  scanRiskLevel: string | null;
  leadScore: LeadScore | null;
  scanCompleted: boolean;
  httpValid?: boolean | null;
  dnsValid?: boolean | null;
  signals: ContactSignals;
  issueCount?: number;
  scanIssues?: string[];
}

export function computeOpportunityScore(input: OpportunityScoreInput): number {
  if (
    isJunkProspect({
      website: input.website,
      businessName: input.businessName,
      industry: input.industry,
      httpValid: input.httpValid,
      dnsValid: input.dnsValid,
    })
  ) {
    return Math.max(0, Math.min(25, industryFitPoints(input.industry, input.businessName) + 5));
  }

  if (isDeprioritizedIndustry(input.industry, input.businessName)) {
    return Math.max(0, Math.min(35, industryFitPoints(input.industry, input.businessName) + 10));
  }

  let score = industryFitPoints(input.industry, input.businessName);
  score += contactAvailabilityPoints(input.signals);

  if (input.scanCompleted) {
    score += securityUrgencyPoints(input.scanScore, input.scanRiskLevel, input.leadScore);
  } else if (input.httpValid && input.dnsValid) {
    score += 10;
  }

  if ((input.issueCount ?? 0) >= 3) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computePlanFit(
  input: OpportunityScoreInput,
  opportunityScore?: number,
): PlanFit | null {
  if (isDeprioritizedIndustry(input.industry, input.businessName)) return null;

  const opp = opportunityScore ?? computeOpportunityScore(input);
  if (!input.scanCompleted && opp < 25) return null;

  const key = normalizeIndustryKey(input.industry, input.businessName);
  const isAgency = key.includes('agency') || key.includes('agencies');
  const issues = input.issueCount ?? 0;

  if (isAgency || opp >= 75 || issues >= 6) return 299;
  if (opp >= 50 || issues >= 3) return 149;
  if (opp >= 25) return 79;
  return null;
}

export function planFitDisplayName(planFit: number | null): string | null {
  if (!planFit) return null;
  if (planFit === 79) return 'Starter ($79)';
  if (planFit === 149) return 'Growth ($149)';
  if (planFit === 299) return 'Agency ($299)';
  return `$${planFit}/mo`;
}

export function confidenceLabel(conversionLikelihood: number | null, opportunityScore: number | null): string {
  const score = conversionLikelihood ?? opportunityScore ?? 0;
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

export function contactStatusLabel(p: {
  contact_email?: string | null;
  contact_email_found?: boolean | null;
  contact_phone_found?: boolean | null;
  contact_page_found?: boolean | null;
}): { label: string; available: boolean; emailReady: boolean } {
  if (p.contact_email?.trim()) {
    return { label: 'Email ready', available: true, emailReady: true };
  }
  if (p.contact_phone_found) {
    return { label: 'Phone only — need email', available: false, emailReady: false };
  }
  if (p.contact_page_found) {
    return { label: 'Contact page — find email', available: false, emailReady: false };
  }
  if (p.contact_email_found) {
    return { label: 'Email flagged — re-run contact', available: false, emailReady: false };
  }
  return { label: 'No contact found', available: false, emailReady: false };
}

export function buildQualificationReasons(
  input: OpportunityScoreInput & { opportunityScore: number },
): string[] {
  const reasons: string[] = [];
  const key = normalizeIndustryKey(input.industry, input.businessName);

  if (isDeprioritizedIndustry(input.industry, input.businessName)) {
    reasons.push('Low-fit category — unlikely CyberShield customer');
    return reasons;
  }

  if (input.signals.contact_email_found) reasons.push('✉ Business email found — ready for outreach');
  if (input.signals.contact_phone_found) reasons.push('☎ Phone number found');
  if (!input.signals.contact_email_found && !input.signals.contact_phone_found) {
    reasons.push('✗ No direct contact — verify contact page');
  }
  if (input.signals.contact_page_found) reasons.push('Contact page found');
  if (input.signals.contact_linkedin_found) reasons.push('LinkedIn profile found');

  for (const issue of (input.scanIssues ?? []).slice(0, 3)) {
    reasons.push(issue);
  }

  for (const word of PRIORITY_INDUSTRY_KEYWORDS) {
    if (key.includes(word)) {
      reasons.push(`Priority industry: ${word}`);
      break;
    }
  }

  if (input.dnsValid && input.httpValid) reasons.push('Professional business website');

  if (input.scanCompleted && input.leadScore === 'HOT') {
    reasons.push('Elevated security risk — strong CyberShield fit');
  }

  return [...new Set(reasons)].slice(0, 8);
}

export function buildSelectionReason(input: OpportunityScoreInput & { opportunityScore: number }): string {
  if (isDeprioritizedIndustry(input.industry, input.businessName)) {
    return 'Discovered from public data but deprioritized — likely not an ideal CyberShield customer.';
  }

  const parts: string[] = [];
  if (input.industry) parts.push(`${input.industry} business`);
  else parts.push('Local business');

  if (input.scanCompleted && input.leadScore === 'HOT') {
    parts.push('with high-risk security findings');
  } else if (input.scanCompleted && input.leadScore === 'WARM') {
    parts.push('with actionable security gaps');
  } else {
    parts.push('with a validated web presence');
  }

  if (input.signals.contact_email_found) parts.push('and reachable contact info');

  return `CyberShield selected this ${parts.join(' ')}. Opportunity score ${input.opportunityScore}/100.`;
}

export function conversionLikelihoodFromScore(opportunityScore: number): number {
  return Math.max(5, Math.min(95, Math.round(opportunityScore * 0.85)));
}
