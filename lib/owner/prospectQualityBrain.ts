import type { LeadScore } from './types';
import type { ProspectPipelineState } from './discovery/types';
import type { DiscoveryBreakdownResult } from './discovery/types';

export type ContactConfidence =
  | 'verified_public_email'
  | 'likely_business_email'
  | 'generic_public_inbox'
  | 'personal_public_contact'
  | 'unverified_guess'
  | 'no_contact';

export type QualityLabel = 'HOT' | 'WARM' | 'LOW' | 'REJECTED' | 'NEEDS REVIEW';

export type QualityStage =
  | 'discovered'
  | 'verified_business'
  | 'qualified_fit'
  | 'contact_verified'
  | 'outreach_ready';

export type RejectionReason =
  | 'directory_result'
  | 'public_institution'
  | 'not_agency_fit'
  | 'duplicate'
  | 'invalid_website'
  | 'personal_site'
  | 'sensitive_sector_manual_review'
  | 'low_opportunity'
  | 'no_contact'
  | string
  | null;

/** Contact tiers that may reach Stage 5 outreach-ready. */
export const OUTREACH_READY_CONTACT: ContactConfidence[] = [
  'verified_public_email',
  'likely_business_email',
  'generic_public_inbox',
];

export function isOutreachReadyContact(confidence: ContactConfidence | string | null | undefined): boolean {
  return OUTREACH_READY_CONTACT.includes(confidence as ContactConfidence);
}

const GENERIC_LOCALS = /^(info|contact|hello|sales|support|office|admin|team|enquiries|inquiry)$/i;
const PLACEHOLDER_LOCAL = /^(example|test|yourname|email|placeholder|user|name|admin|demo)$/i;
const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'live.com',
]);

const DIRECTORY_HOSTS = [
  'yellowpages.com',
  'yelp.com',
  'facebook.com',
  'linkedin.com',
  'bbb.org',
  'manta.com',
  'superpages.com',
  'whitepages.com',
];

const GOV_TLD = /\.(gov|edu|mil)(?:\/|$)/i;
const GOV_KEYWORDS = /\b(city hall|county|school district|university|college|public school|government)\b/i;

const SENSITIVE_SECTORS = /\b(dental|dentist|medical|healthcare|clinic|hospital|legal|law firm|attorney|financial advisor|insurance)\b/i;

export function isPlaceholderEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  const [local, domain] = lower.split('@');
  if (!local || !domain) return true;
  if (domain.includes('example.com') || domain.includes('test.com')) return true;
  return PLACEHOLDER_LOCAL.test(local);
}

export function classifyContactConfidence(
  email: string,
  website: string,
  opts: { fromPublicPage?: boolean; guessed?: boolean } = {},
): ContactConfidence {
  const lower = email.toLowerCase().trim();
  if (!lower || isPlaceholderEmail(lower)) return 'no_contact';
  if (opts.guessed) return 'unverified_guess';

  const [local, domain] = lower.split('@');
  if (!local || !domain) return 'no_contact';

  let siteHost = '';
  try {
    siteHost = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(
      /^www\./,
      '',
    );
  } catch {
    siteHost = '';
  }

  const sameDomain = siteHost && (domain === siteHost || domain.endsWith(`.${siteHost}`));

  if (PERSONAL_DOMAINS.has(domain)) {
    return opts.fromPublicPage ? 'personal_public_contact' : 'unverified_guess';
  }

  if (sameDomain) {
    if (GENERIC_LOCALS.test(local)) return 'generic_public_inbox';
    if (local.includes('.') || local.length > 12) return 'verified_public_email';
    return 'likely_business_email';
  }

  if (opts.fromPublicPage) return 'likely_business_email';
  return 'unverified_guess';
}

export function isSensitiveSector(industry: string | null | undefined, businessName: string): boolean {
  const hay = `${industry ?? ''} ${businessName}`.toLowerCase();
  return SENSITIVE_SECTORS.test(hay);
}

export interface DiscoveryRejectInput {
  businessName: string;
  website: string;
  industry?: string | null;
  httpValid?: boolean | null;
  dnsValid?: boolean | null;
}

export function evaluateDiscoveryRejection(input: DiscoveryRejectInput): {
  reject: boolean;
  reason: RejectionReason;
} {
  const website = input.website.toLowerCase();
  const name = input.businessName.toLowerCase();
  const industry = (input.industry ?? '').toLowerCase();

  if (GOV_TLD.test(website) || industry === 'government' || GOV_KEYWORDS.test(name)) {
    return { reject: true, reason: 'public_institution' };
  }

  for (const host of DIRECTORY_HOSTS) {
    if (website.includes(host)) {
      return { reject: true, reason: 'directory_result' };
    }
  }

  if (input.httpValid === false && input.dnsValid === false) {
    return { reject: true, reason: 'invalid_website' };
  }

  return { reject: false, reason: null };
}

const REJECTION_LABELS: Record<string, string> = {
  directory_result: 'Directory listing',
  public_institution: 'Public institution',
  not_agency_fit: 'Not agency fit',
  duplicate: 'Duplicate',
  invalid_website: 'Invalid website',
  personal_site: 'Personal site',
  sensitive_sector_manual_review: 'Sensitive sector — manual review',
  low_opportunity: 'Low opportunity',
  no_contact: 'No contact',
};

export function rejectionReasonLabel(reason: RejectionReason): string {
  if (!reason) return 'Unknown';
  return REJECTION_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

export function emptyDiscoveryBreakdown(): DiscoveryBreakdownResult {
  return {
    rawResults: 0,
    duplicatesSkipped: 0,
    rejectedLowFit: 0,
    missingContact: 0,
    qualified: 0,
    outreachReady: 0,
    needsReview: 0,
    inserted: 0,
    rejectedInserted: 0,
  };
}

export function formatDiscoverySummary(breakdown: DiscoveryBreakdownResult, inserted: number): string {
  const parts = [
    `${breakdown.rawResults} raw results`,
    `${breakdown.duplicatesSkipped} duplicates skipped`,
    `${breakdown.rejectedLowFit} rejected low-fit`,
    `${breakdown.missingContact} missing contact`,
    `${breakdown.qualified} qualified`,
    `${breakdown.outreachReady} outreach-ready`,
    `${inserted} inserted`,
  ];
  return parts.join(' · ');
}

export interface ContactSignalsInput {
  contact_page_found: boolean;
  contact_email_found: boolean;
  contact_phone_found: boolean;
  contact_linkedin_found: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
  contact_confidence: ContactConfidence;
}

export interface AssessProspectQualityInput {
  businessName: string;
  website: string;
  industry?: string | null;
  prospectKind: 'smb' | 'agency';
  scanStatus: string;
  scanCompleted: boolean;
  leadScore?: LeadScore | null;
  opportunityScore?: number | null;
  agencyScore?: number | null;
  agencyLabel?: string | null;
  signals: ContactSignalsInput;
  httpValid?: boolean | null;
  dnsValid?: boolean | null;
  scanIssues?: string[];
  scanRiskLevel?: string | null;
  planFit?: number | null;
  rejectionReason?: RejectionReason;
  agencyDiscoveryMode?: boolean;
}

export interface ProspectQualityAssessment {
  qualityLabel: QualityLabel;
  qualityStage: QualityStage;
  pipelineState: ProspectPipelineState;
  outreachReady: boolean;
  rejectionReason: RejectionReason;
  whySelected: string;
  buyingTrigger: string | null;
  whyNow: string | null;
  contactConfidence: ContactConfidence;
}

export function assessProspectQuality(input: AssessProspectQualityInput): ProspectQualityAssessment {
  const discoveryReject = evaluateDiscoveryRejection({
    businessName: input.businessName,
    website: input.website,
    industry: input.industry,
    httpValid: input.httpValid,
    dnsValid: input.dnsValid,
  });

  let rejectionReason: RejectionReason = input.rejectionReason ?? null;
  if (discoveryReject.reject) rejectionReason = discoveryReject.reason;

  if (rejectionReason === 'not_agency_fit' && input.agencyDiscoveryMode) {
    return {
      qualityLabel: 'REJECTED',
      qualityStage: 'discovered',
      pipelineState: 'bad_fit',
      outreachReady: false,
      rejectionReason,
      whySelected: 'Does not meet agency fit criteria',
      buyingTrigger: null,
      whyNow: null,
      contactConfidence: input.signals.contact_confidence,
    };
  }

  if (rejectionReason === 'directory_result' || discoveryReject.reason === 'directory_result') {
    return {
      qualityLabel: 'REJECTED',
      qualityStage: 'discovered',
      pipelineState: 'bad_fit',
      outreachReady: false,
      rejectionReason: 'directory_result',
      whySelected: 'Directory or aggregator listing — not a direct business site',
      buyingTrigger: null,
      whyNow: null,
      contactConfidence: input.signals.contact_confidence,
    };
  }

  if (
    rejectionReason === 'sensitive_sector_manual_review' ||
    (isSensitiveSector(input.industry, input.businessName) && !rejectionReason)
  ) {
    return {
      qualityLabel: 'NEEDS REVIEW',
      qualityStage: 'qualified_fit',
      pipelineState: 'needs_review',
      outreachReady: false,
      rejectionReason: rejectionReason ?? 'sensitive_sector_manual_review',
      whySelected: 'Sensitive sector — requires manual review before outreach',
      buyingTrigger: 'Compliance-sensitive industry',
      whyNow: 'Manual founder review required',
      contactConfidence: input.signals.contact_confidence,
    };
  }

  const score = input.opportunityScore ?? 0;
  const hasContact = Boolean(input.signals.contact_email?.trim());
  const contactOk = isOutreachReadyContact(input.signals.contact_confidence);
  const scanDone = input.scanCompleted && input.scanStatus === 'completed';
  const meaningfulFinding = score >= 25 || (input.scanIssues?.length ?? 0) >= 1;

  let qualityLabel: QualityLabel = 'LOW';
  if (input.leadScore === 'HOT' || score >= 60) qualityLabel = 'HOT';
  else if (input.leadScore === 'WARM' || score >= 40) qualityLabel = 'WARM';
  else if (score < 25) qualityLabel = 'LOW';

  let qualityStage: QualityStage = 'discovered';
  if (input.httpValid !== false && input.dnsValid !== false) qualityStage = 'verified_business';
  if (meaningfulFinding && scanDone) qualityStage = 'qualified_fit';
  if (hasContact && contactOk) qualityStage = 'contact_verified';

  let pipelineState: ProspectPipelineState = 'new_discovery';
  if (!scanDone) {
    pipelineState = 'new_discovery';
  } else if (!hasContact) {
    pipelineState = 'needs_contact';
  } else if (!meaningfulFinding || score < 25) {
    pipelineState = 'bad_fit';
    qualityLabel = 'LOW';
  } else if (meaningfulFinding && scanDone && (qualityLabel === 'HOT' || qualityLabel === 'WARM')) {
    qualityStage = 'outreach_ready';
    pipelineState = 'outreach_ready';
  } else if (scanDone && hasContact) {
    pipelineState = 'qualified';
  }

  const outreachReady =
    pipelineState === 'outreach_ready' &&
    scanDone &&
    contactOk &&
    (qualityLabel === 'HOT' || qualityLabel === 'WARM');

  const topIssue = input.scanIssues?.[0] ?? null;
  const buyingTrigger =
    topIssue ??
    (input.prospectKind === 'agency' ? 'Manages client websites' : 'Website security gaps found');

  return {
    qualityLabel,
    qualityStage,
    pipelineState,
    outreachReady,
    rejectionReason,
    whySelected: outreachReady
      ? `${input.businessName} — scan complete with public contact and ${qualityLabel} fit`
      : `${input.businessName} — ${pipelineState.replace(/_/g, ' ')}`,
    buyingTrigger,
    whyNow: outreachReady ? 'Scan findings provide a concrete reason to reach out now' : null,
    contactConfidence: input.signals.contact_confidence,
  };
}

export function qualityFieldsFromAssessment(assessment: ProspectQualityAssessment): {
  quality_label: QualityLabel;
  quality_stage: QualityStage;
  rejection_reason: RejectionReason;
  buying_trigger: string | null;
  why_now: string | null;
  contact_confidence: ContactConfidence;
} {
  return {
    quality_label: assessment.qualityLabel,
    quality_stage: assessment.qualityStage,
    rejection_reason: assessment.rejectionReason,
    buying_trigger: assessment.buyingTrigger,
    why_now: assessment.whyNow,
    contact_confidence: assessment.contactConfidence,
  };
}

export function canCreateOutreachDraft(prospect: {
  pipeline_state?: string | null;
  scan_status?: string | null;
  quality_label?: string | null;
  contact_confidence?: string | null;
  contact_email?: string | null;
}): boolean {
  if (prospect.pipeline_state !== 'outreach_ready') return false;
  if (prospect.scan_status !== 'completed') return false;
  if (prospect.quality_label !== 'HOT' && prospect.quality_label !== 'WARM') return false;
  if (!prospect.contact_email?.trim()) return false;
  if (!isOutreachReadyContact(prospect.contact_confidence)) return false;
  return true;
}
