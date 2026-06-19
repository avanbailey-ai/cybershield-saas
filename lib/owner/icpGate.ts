/**
 * Buyer-fit / ICP gate — single source of truth for who may enter Send Queue,
 * Form Queue, or outreach drafts. Technology signals and weak scan scores alone
 * never make a public institution or national brand send-ready.
 */

import type { OwnerProspect } from './types';
import { isWeakScanScore } from './revenueEngine';
import { isDeprioritizedIndustry } from './salesIntelligence';
import { AGENCY_PLAN_PRICE } from './agency/agencyScore';

const OUTREACH_READY_CONTACT = ['verified_public_email', 'likely_business_email', 'generic_public_inbox'];

function isOutreachEmail(conf: string | null | undefined): boolean {
  return OUTREACH_READY_CONTACT.includes(conf ?? '');
}

export type IcpStatus =
  | 'ICP_READY'
  | 'ICP_NEEDS_CONTACT'
  | 'ICP_CONTACT_FORM_READY'
  | 'ICP_MANUAL_REVIEW'
  | 'ICP_NOT_FIT'
  | 'ICP_PUBLIC_INSTITUTION'
  | 'ICP_ENTERPRISE_NOT_TARGET'
  | 'ICP_SENSITIVE_SECTOR'
  | 'ICP_LOW_INTENT'
  | 'ICP_NOT_URGENT';

export type ContactQueueStatus =
  | 'EMAIL_READY'
  | 'CONTACT_FORM_READY'
  | 'CONTACT_PAGE_READY'
  | 'PHONE_ONLY'
  | 'NEEDS_CONTACT'
  | 'NO_CONTACT_FOUND';

export type RevenueQueue =
  | 'send_queue'
  | 'form_queue'
  | 'needs_contact'
  | 'manual_review'
  | 'rejected_not_icp'
  | 'not_urgent';

export type GatedQualityLabel = 'HOT' | 'WARM' | 'LOW' | 'REJECTED' | 'NEEDS REVIEW';

const GOV_TLD = /\.(gov|edu|mil)(?:\/|$|[?#])/i;
const PUBLIC_HOST =
  /(?:^|\.)((?:cityof|townof|countyof)[a-z0-9-]+|denvergov|centennialco|hillsboro-oregon|tigard-or|cityofeaglepoint|cityofvancouver)\./i;
const PUBLIC_KEYWORDS =
  /\b(city hall|city of|county of|municipality|municipal|school district|public school|government|parks?\s*(?:&|and)\s*rec|recreation department|public institution)\b/i;

const CHURCH_KEYWORDS =
  /\b(church|ministry|ministries|temple|mosque|synagogue|assembly of god|nazarene|apostolic|faithweb|parish|congregation|baptist church|methodist church|church of christ|lutheran church)\b/i;

const SCHOOL_KEYWORDS =
  /\b(elementary school|middle school|high school|school district|public school|\.edu\b|redeemer.*school|jewett elementary|pps\.org)\b/i;

const HEALTHCARE_KEYWORDS =
  /\b(hospital|healthcare|health care|medical|clinic|dental|surgery center|hospice|stdavids|heart hospital|texan surgery)\b/i;

const NONPROFIT_MUSEUM =
  /\b(museum|nonprofit|non-profit|community association|neighborhood association|art center|community convergence|laguna gloria)\b/i;

const NATIONAL_BRANDS =
  /\b(mcdonald'?s?|mcdonalds|dollar general|dollar tree|phillips 66|walmart|target|starbucks|costco|home depot|lowe'?s|amazon\.com|google\.com|microsoft\.com|apple\.com|dsv|fedex|ups|maersk)\b/i;

const ENTERPRISE_KEYWORDS =
  /\b(fortune 500|global logistics|enterprise software|healthcare systems|national chain|multinational)\b/i;

const TECH_ONLY_SERVICE_IDS = new Set([
  'wordpress', 'woocommerce', 'shopify', 'webflow', 'wix', 'squarespace',
  'seo', 'security', 'hosting', 'maintenance', 'care_plan', 'managed_sites',
  'digital_marketing', 'branding', 'ecommerce',
]);

function isRealAgencyLeadInline(p: Partial<OwnerProspect>): boolean {
  if (p.prospect_kind !== 'agency') return false;
  if (p.manages_client_sites !== true) return false;
  if (p.agency_label === 'NOT AGENCY FIT') return false;
  const services = Array.isArray(p.detected_services) ? p.detected_services : [];
  if (!services.some((s) => !TECH_ONLY_SERVICE_IDS.has(s))) return false;
  return services.length > 0 || (p.agency_opportunity_score ?? 0) >= 45;
}

const MIN_BUYER_FIT_SCORE = 45;

export function icpStatusLabel(status: IcpStatus): string {
  const map: Record<IcpStatus, string> = {
    ICP_READY: 'ICP ready — email send eligible',
    ICP_NEEDS_CONTACT: 'ICP needs contact',
    ICP_CONTACT_FORM_READY: 'ICP contact form ready',
    ICP_MANUAL_REVIEW: 'ICP manual review',
    ICP_NOT_FIT: 'Not ICP fit',
    ICP_PUBLIC_INSTITUTION: 'Public institution',
    ICP_ENTERPRISE_NOT_TARGET: 'Enterprise — not target',
    ICP_SENSITIVE_SECTOR: 'Sensitive sector',
    ICP_LOW_INTENT: 'Low buyer intent',
    ICP_NOT_URGENT: 'Not urgent',
  };
  return map[status] ?? status;
}

export function contactQueueStatus(p: Partial<OwnerProspect>): ContactQueueStatus {
  const hasEmail = Boolean(p.contact_email?.trim());
  const conf = p.contact_confidence ?? 'no_contact';

  if (hasEmail && conf === 'verified_public_email') return 'EMAIL_READY';
  if (hasEmail && isOutreachEmail(conf)) return 'EMAIL_READY';
  if (p.contact_page_found && !hasEmail) {
    if (/form|wpcf7|contact-us|get-in-touch/i.test(`${p.website ?? ''}`)) return 'CONTACT_FORM_READY';
    return 'CONTACT_PAGE_READY';
  }
  if ((p.contact_phone_found || p.contact_phone) && !hasEmail) return 'PHONE_ONLY';
  if (p.pipeline_state === 'needs_contact' || (p.scan_status === 'completed' && !hasEmail)) {
    return 'NEEDS_CONTACT';
  }
  return 'NO_CONTACT_FOUND';
}

export function isPublicInstitutionProspect(p: Partial<OwnerProspect>): boolean {
  const website = (p.website ?? '').toLowerCase();
  const name = (p.business_name ?? '').toLowerCase();
  const industry = (p.industry ?? '').toLowerCase();
  const hay = `${name} ${website} ${industry}`;

  if (p.rejection_reason === 'public_institution') return true;
  if (GOV_TLD.test(website)) return true;
  if (PUBLIC_HOST.test(website)) return true;
  if (PUBLIC_KEYWORDS.test(hay)) return true;
  if (industry === 'government') return true;
  return false;
}

export function isChurchOrReligiousProspect(p: Partial<OwnerProspect>): boolean {
  const hay = `${p.business_name ?? ''} ${p.industry ?? ''} ${p.website ?? ''}`.toLowerCase();
  return CHURCH_KEYWORDS.test(hay);
}

export function isSchoolProspect(p: Partial<OwnerProspect>): boolean {
  const hay = `${p.business_name ?? ''} ${p.industry ?? ''} ${p.website ?? ''}`.toLowerCase();
  return SCHOOL_KEYWORDS.test(hay) || GOV_TLD.test(p.website ?? '');
}

export function isHealthcareProspect(p: Partial<OwnerProspect>): boolean {
  const hay = `${p.business_name ?? ''} ${p.industry ?? ''} ${p.website ?? ''}`.toLowerCase();
  return HEALTHCARE_KEYWORDS.test(hay) || p.rejection_reason === 'sensitive_sector_manual_review';
}

export function isNationalEnterpriseProspect(p: Partial<OwnerProspect>): boolean {
  const hay = `${p.business_name ?? ''} ${p.website ?? ''} ${p.industry ?? ''}`.toLowerCase();
  if (NATIONAL_BRANDS.test(hay)) return true;
  if (ENTERPRISE_KEYWORDS.test(hay)) return true;
  if (p.rejection_reason === 'enterprise_manual_review') return true;
  return false;
}

export function isNonprofitOrMuseumProspect(p: Partial<OwnerProspect>): boolean {
  const hay = `${p.business_name ?? ''} ${p.industry ?? ''}`.toLowerCase();
  return NONPROFIT_MUSEUM.test(hay) || /\bnonprofit\b/i.test(p.industry ?? '');
}

export function hasMeaningfulScanFinding(p: Partial<OwnerProspect>): boolean {
  const issues = (p.scan_findings as { issues?: string[] } | null)?.issues ?? [];
  if (issues.length >= 1) return true;
  return isWeakScanScore(p.scan_score, p.scan_risk_level);
}

export function buyerFitScore(p: Partial<OwnerProspect>): number {
  return p.opportunity_score ?? p.conversion_likelihood ?? 0;
}

export function isPrivateBusinessOrAgency(p: Partial<OwnerProspect>): boolean {
  if (isRealAgencyLeadInline(p as OwnerProspect)) return true;
  if (p.prospect_kind === 'agency') return false;
  if (isPublicInstitutionProspect(p)) return false;
  if (isChurchOrReligiousProspect(p)) return false;
  if (isSchoolProspect(p)) return false;
  if (isNationalEnterpriseProspect(p)) return false;
  if (isNonprofitOrMuseumProspect(p) && buyerFitScore(p) < 55) return false;
  return true;
}

export interface BuyerFitEvaluation {
  icpStatus: IcpStatus;
  revenueQueue: RevenueQueue;
  contactStatus: ContactQueueStatus;
  sendQueueEligible: boolean;
  formQueueEligible: boolean;
  emailDraftAllowed: boolean;
  qualityLabel: GatedQualityLabel;
  planFit: number | null;
  blockReason: string | null;
  buyerFitPassed: boolean;
}

function classifyIcpCategory(p: Partial<OwnerProspect>): IcpStatus {
  if (p.pipeline_state === 'bad_fit' || p.quality_label === 'REJECTED') {
    if (p.rejection_reason === 'public_institution') return 'ICP_PUBLIC_INSTITUTION';
    return 'ICP_NOT_FIT';
  }
  if (p.rejection_reason === 'public_institution' || isPublicInstitutionProspect(p)) {
    return 'ICP_PUBLIC_INSTITUTION';
  }
  if (isNationalEnterpriseProspect(p)) return 'ICP_ENTERPRISE_NOT_TARGET';
  if (isHealthcareProspect(p)) return 'ICP_SENSITIVE_SECTOR';
  if (isChurchOrReligiousProspect(p) || isSchoolProspect(p)) return 'ICP_LOW_INTENT';
  if (isNonprofitOrMuseumProspect(p)) return 'ICP_MANUAL_REVIEW';
  if (isDeprioritizedIndustry(p.industry ?? null, p.business_name)) return 'ICP_LOW_INTENT';
  if (p.scan_status === 'failed') return 'ICP_NOT_FIT';

  const contact = contactQueueStatus(p);
  const score = buyerFitScore(p);
  const weak = hasMeaningfulScanFinding(p);

  if (!weak && (p.scan_score ?? 100) > 80) return 'ICP_NOT_URGENT';
  if (score < MIN_BUYER_FIT_SCORE) return 'ICP_LOW_INTENT';

  if (contact === 'EMAIL_READY' && isPrivateBusinessOrAgency(p)) return 'ICP_READY';
  if (contact === 'CONTACT_FORM_READY' || contact === 'CONTACT_PAGE_READY') {
    return 'ICP_CONTACT_FORM_READY';
  }
  if (contact === 'PHONE_ONLY' || contact === 'NEEDS_CONTACT' || contact === 'NO_CONTACT_FOUND') {
    return 'ICP_NEEDS_CONTACT';
  }
  return 'ICP_NOT_URGENT';
}

export function evaluateBuyerFit(p: Partial<OwnerProspect>): BuyerFitEvaluation {
  const resolved = p as OwnerProspect;
  const icpStatus = classifyIcpCategory(resolved);
  const contactStatus = contactQueueStatus(resolved);
  const score = buyerFitScore(resolved);
  const weak = hasMeaningfulScanFinding(resolved);
  const privateBiz = isPrivateBusinessOrAgency(resolved);
  const realAgency = isRealAgencyLeadInline(resolved);

  const blockedCategories: IcpStatus[] = [
    'ICP_PUBLIC_INSTITUTION',
    'ICP_ENTERPRISE_NOT_TARGET',
    'ICP_SENSITIVE_SECTOR',
    'ICP_NOT_FIT',
    'ICP_LOW_INTENT',
  ];

  const manualCategories: IcpStatus[] = ['ICP_MANUAL_REVIEW', 'ICP_SENSITIVE_SECTOR'];

  const buyerFitPassed =
    privateBiz &&
    score >= MIN_BUYER_FIT_SCORE &&
    weak &&
    p.scan_status === 'completed' &&
    !blockedCategories.includes(icpStatus);

  const emailReady = contactStatus === 'EMAIL_READY';
  const formReady =
    contactStatus === 'CONTACT_FORM_READY' || contactStatus === 'CONTACT_PAGE_READY';

  const sendQueueEligible = buyerFitPassed && emailReady && !manualCategories.includes(icpStatus);
  const formQueueEligible = buyerFitPassed && formReady && !manualCategories.includes(icpStatus);
  const emailDraftAllowed = sendQueueEligible;

  let qualityLabel: GatedQualityLabel = 'LOW';
  if (blockedCategories.includes(icpStatus)) qualityLabel = 'REJECTED';
  else if (manualCategories.includes(icpStatus)) qualityLabel = 'NEEDS REVIEW';
  else if (icpStatus === 'ICP_NOT_URGENT') qualityLabel = 'LOW';
  else if (sendQueueEligible && score >= 60) qualityLabel = 'HOT';
  else if (sendQueueEligible || formQueueEligible || (buyerFitPassed && score >= 45)) {
    qualityLabel = emailReady ? 'WARM' : 'WARM';
  } else if (score < MIN_BUYER_FIT_SCORE) qualityLabel = 'LOW';

  if (blockedCategories.includes(icpStatus) || manualCategories.includes(icpStatus)) {
    qualityLabel =
      icpStatus === 'ICP_SENSITIVE_SECTOR' || icpStatus === 'ICP_MANUAL_REVIEW'
        ? 'NEEDS REVIEW'
        : 'REJECTED';
  }

  let revenueQueue: RevenueQueue = 'not_urgent';
  if (blockedCategories.includes(icpStatus)) revenueQueue = 'rejected_not_icp';
  else if (manualCategories.includes(icpStatus)) revenueQueue = 'manual_review';
  else if (sendQueueEligible) revenueQueue = 'send_queue';
  else if (formQueueEligible) revenueQueue = 'form_queue';
  else if (icpStatus === 'ICP_NEEDS_CONTACT' && buyerFitPassed) revenueQueue = 'needs_contact';
  else if (icpStatus === 'ICP_NOT_URGENT') revenueQueue = 'not_urgent';
  else if (score < MIN_BUYER_FIT_SCORE) revenueQueue = 'rejected_not_icp';
  else revenueQueue = 'needs_contact';

  let planFit: number | null = null;
  if (realAgency && buyerFitPassed) planFit = AGENCY_PLAN_PRICE;
  else if (buyerFitPassed && privateBiz && !blockedCategories.includes(icpStatus)) {
    if (score >= 55 || ((p.scan_findings as { issues?: string[] } | null)?.issues?.length ?? 0) >= 3) {
      planFit = 149;
    } else if (score >= MIN_BUYER_FIT_SCORE) planFit = 79;
  }

  let blockReason: string | null = null;
  if (!sendQueueEligible) {
    if (icpStatus === 'ICP_PUBLIC_INSTITUTION') blockReason = 'Public institution — not a paying customer target';
    else if (icpStatus === 'ICP_ENTERPRISE_NOT_TARGET') blockReason = 'Enterprise/national brand — manual review only';
    else if (icpStatus === 'ICP_SENSITIVE_SECTOR') blockReason = 'Healthcare/sensitive sector — manual review required';
    else if (icpStatus === 'ICP_LOW_INTENT') blockReason = 'Church, school, or low-intent organization';
    else if (icpStatus === 'ICP_NOT_FIT') blockReason = 'Rejected — not ICP fit';
    else if (!emailReady) blockReason = 'No verified/public email for send queue';
    else if (score < MIN_BUYER_FIT_SCORE) blockReason = `Buyer fit score ${score}/100 below ${MIN_BUYER_FIT_SCORE}`;
    else if (!weak) blockReason = 'Scan score not weak enough for outreach hook';
    else if (p.scan_status !== 'completed') blockReason = 'Scan not completed';
  }

  return {
    icpStatus,
    revenueQueue,
    contactStatus,
    sendQueueEligible,
    formQueueEligible,
    emailDraftAllowed,
    qualityLabel,
    planFit,
    blockReason,
    buyerFitPassed,
  };
}

export function isEmailSendEligible(p: OwnerProspect): boolean {
  return evaluateBuyerFit(p).sendQueueEligible;
}

export function isFormQueueEligible(p: OwnerProspect): boolean {
  return evaluateBuyerFit(p).formQueueEligible;
}

export function allowedActionsForIcp(p: OwnerProspect): {
  label: string;
  action: 'review' | 'archive' | 'contact' | 'contact_page' | 'scan' | 'ignore';
}[] {
  const fit = evaluateBuyerFit(p);
  const blocked = fit.revenueQueue === 'rejected_not_icp' || fit.revenueQueue === 'manual_review';

  if (blocked) {
    return [
      { label: 'Review manually', action: 'review' },
      { label: 'Archive', action: 'archive' },
      { label: 'Ignore forever', action: 'ignore' },
    ];
  }
  if (fit.sendQueueEligible) {
    return [{ label: 'Review draft in send queue', action: 'review' }];
  }
  if (fit.formQueueEligible) {
    return [{ label: 'Open contact page + copy message', action: 'contact_page' }];
  }
  if (fit.contactStatus === 'PHONE_ONLY') {
    return [{ label: 'Find email/contact form', action: 'contact' }];
  }
  if (fit.contactStatus === 'NEEDS_CONTACT' || fit.contactStatus === 'NO_CONTACT_FOUND') {
    return [{ label: 'Find contact on website', action: 'contact' }];
  }
  if (p.scan_status !== 'completed') {
    return [{ label: 'Run security scan', action: 'scan' }];
  }
  return [{ label: 'Review manually', action: 'review' }];
}

export interface IcpQueueSnapshot {
  sendQueue: number;
  formQueue: number;
  needsContact: number;
  manualReview: number;
  rejectedNotIcp: number;
  notUrgent: number;
  privateBusinessWithContact: number;
  summaryLine: string;
}

export function computeIcpQueueSnapshot(prospects: OwnerProspect[]): IcpQueueSnapshot {
  let sendQueue = 0;
  let formQueue = 0;
  let needsContact = 0;
  let manualReview = 0;
  let rejectedNotIcp = 0;
  let notUrgent = 0;
  let privateBusinessWithContact = 0;

  for (const p of prospects) {
    if (p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever') continue;
    const fit = evaluateBuyerFit(p);
    switch (fit.revenueQueue) {
      case 'send_queue':
        sendQueue++;
        break;
      case 'form_queue':
        formQueue++;
        break;
      case 'needs_contact':
        needsContact++;
        break;
      case 'manual_review':
        manualReview++;
        break;
      case 'rejected_not_icp':
        rejectedNotIcp++;
        break;
      default:
        notUrgent++;
    }
    if (fit.buyerFitPassed && (fit.contactStatus === 'EMAIL_READY' || fit.formQueueEligible)) {
      privateBusinessWithContact++;
    }
  }

  const summaryLine =
    privateBusinessWithContact > 0
      ? `${sendQueue} email-ready · ${formQueue} contact-form-ready · ${needsContact} need contact · ${manualReview} manual review · ${rejectedNotIcp} not ICP`
      : `Found weak websites, but most are not ideal buyers. Focus on the ${privateBusinessWithContact} private businesses with valid contact paths.`;

  return {
    sendQueue,
    formQueue,
    needsContact,
    manualReview,
    rejectedNotIcp,
    notUrgent,
    privateBusinessWithContact,
    summaryLine,
  };
}

/** Fixture helper for verification scripts. */
export function evaluateBuyerFitFixture(
  overrides: Partial<OwnerProspect>,
): BuyerFitEvaluation {
  return evaluateBuyerFit({
    id: 'fixture',
    business_name: 'Fixture',
    website: 'https://example.com',
    industry: null,
    scan_status: 'completed',
    scan_score: 55,
    opportunity_score: 50,
    pipeline_state: 'qualified',
    contact_confidence: 'no_contact',
    created_at: '',
    updated_at: '',
    ...overrides,
  } as OwnerProspect);
}
