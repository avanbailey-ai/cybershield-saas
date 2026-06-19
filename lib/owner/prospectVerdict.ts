/**
 * Founder OS prospect verdicts — separates opportunity fit from contact/outreach readiness.
 */

import type { OwnerProspect } from './types';
import { isAgencyKind, hasOutreachContact, isTrulyOutreachReady, resolveProspectScores } from './prospectDisplay';
import { evaluateBuyerFit, icpStatusLabel, allowedActionsForIcp, isEmailSendEligible } from './icpGate';
import { prospectNeedsSensitiveReview } from './sensitiveSectorCaution';
import { isEnterpriseProspect } from './enterpriseFit';
import type { AgencySignals } from './agency/agencyTypes';

export type ContactReadinessStatus =
  | 'verified_email'
  | 'public_email'
  | 'contact_form_ready'
  | 'contact_page_ready'
  | 'phone_only'
  | 'no_contact_found'
  | 'needs_contact';

export type ProspectVerdict =
  | 'Strong SMB lead'
  | 'SMB needs contact'
  | 'Contact form ready'
  | 'Draft ready'
  | 'Real agency lead'
  | 'Agency needs contact'
  | 'Sensitive sector manual review'
  | 'Enterprise/manual review'
  | 'Rejected non-fit'
  | 'Not urgent';

const TECH_ONLY_SERVICE_IDS = new Set([
  'wordpress',
  'woocommerce',
  'shopify',
  'webflow',
  'wix',
  'squarespace',
  'seo',
  'security',
  'hosting',
  'maintenance',
  'care_plan',
  'managed_sites',
  'digital_marketing',
  'branding',
  'ecommerce',
]);

function hasBusinessServiceList(services: string[]): boolean {
  return services.some((s) => !TECH_ONLY_SERVICE_IDS.has(s));
}

export function isRealAgencyLead(p: OwnerProspect): boolean {
  if (p.prospect_kind !== 'agency') return false;
  if (p.manages_client_sites !== true) return false;
  if (p.agency_label === 'NOT AGENCY FIT') return false;
  const services = Array.isArray(p.detected_services) ? p.detected_services : [];
  if (!hasBusinessServiceList(services)) return false;
  return services.length > 0 || (p.agency_opportunity_score ?? 0) >= 45;
}

export function resolveContactReadiness(p: OwnerProspect): ContactReadinessStatus {
  const conf = p.contact_confidence ?? 'no_contact';
  const hasEmail = Boolean(p.contact_email?.trim());

  if (hasEmail && conf === 'verified_public_email') return 'verified_email';
  if (hasEmail && ['verified_public_email', 'likely_business_email', 'generic_public_inbox'].includes(conf)) {
    return 'public_email';
  }
  if (p.contact_page_found && !hasEmail) return 'contact_page_ready';
  if ((p.contact_phone_found || p.contact_phone) && !hasEmail) return 'phone_only';
  if (p.pipeline_state === 'needs_contact' || (!hasEmail && p.scan_status === 'completed')) {
    return 'needs_contact';
  }
  return 'no_contact_found';
}

export function outreachReadinessLabel(p: OwnerProspect): 'Ready' | 'Not ready' | 'Manual review' {
  if (prospectNeedsSensitiveReview(p) || isEnterpriseProspect(p.business_name, p.industry)) {
    return 'Manual review';
  }
  if (isTrulyOutreachReady(p)) return 'Ready';
  return 'Not ready';
}

export function contactReadinessLabel(status: ContactReadinessStatus): string {
  const map: Record<ContactReadinessStatus, string> = {
    verified_email: 'Verified email',
    public_email: 'Public email',
    contact_form_ready: 'Contact form ready',
    contact_page_ready: 'Contact page ready',
    phone_only: 'Phone only',
    no_contact_found: 'No contact found',
    needs_contact: 'Needs contact',
  };
  return map[status];
}

export function prospectVerdict(p: OwnerProspect): ProspectVerdict {
  const resolved = resolveProspectScores(p);

  if (prospectNeedsSensitiveReview(resolved)) return 'Sensitive sector manual review';
  if (isEnterpriseProspect(resolved.business_name, resolved.industry)) return 'Enterprise/manual review';

  if (
    resolved.pipeline_state === 'bad_fit' ||
    resolved.quality_label === 'REJECTED' ||
    (resolved.rejection_reason &&
      resolved.rejection_reason !== 'enterprise_manual_review' &&
      resolved.rejection_reason !== 'sensitive_sector_manual_review')
  ) {
    if (resolved.rejection_reason === 'not_agency_fit') return 'Rejected non-fit';
    if (resolved.rejection_reason) return 'Rejected non-fit';
  }

  const contact = resolveContactReadiness(resolved);
  const realAgency = isRealAgencyLead(resolved);

  if (isTrulyOutreachReady(resolved) && evaluateBuyerFit(resolved).sendQueueEligible) return 'Draft ready';

  if (realAgency) {
    if (contact === 'contact_form_ready' || contact === 'contact_page_ready') return 'Contact form ready';
    if (hasOutreachContact(resolved)) return 'Real agency lead';
    return 'Agency needs contact';
  }

  if (isAgencyKind(resolved) && !realAgency) {
    return contact === 'needs_contact' || contact === 'no_contact_found' ? 'SMB needs contact' : 'Not urgent';
  }

  if (contact === 'contact_form_ready' || contact === 'contact_page_ready') {
    return 'Contact form ready';
  }

  if ((resolved.opportunity_score ?? 0) < 25 && resolved.scan_status === 'completed') {
    return 'Not urgent';
  }

  if (hasOutreachContact(resolved) && (resolved.quality_label === 'HOT' || resolved.quality_label === 'WARM')) {
    return 'Strong SMB lead';
  }

  if (contact === 'needs_contact' || contact === 'no_contact_found' || contact === 'phone_only') {
    return 'SMB needs contact';
  }

  return 'Not urgent';
}

export function recommendedOutreachAction(p: OwnerProspect): { label: string; action: string } {
  const resolved = resolveProspectScores(p);
  const fit = evaluateBuyerFit(resolved);
  const allowed = allowedActionsForIcp(resolved);

  if (fit.revenueQueue === 'rejected_not_icp') {
    return { label: allowed[0]?.label ?? 'Archive non-fit', action: allowed[0]?.action ?? 'archive' };
  }
  if (fit.revenueQueue === 'manual_review') {
    return { label: 'Manual review', action: 'review' };
  }
  if (fit.sendQueueEligible && isEmailSendEligible(resolved)) {
    return { label: 'Approve & send outreach', action: 'outreach' };
  }
  if (fit.formQueueEligible) {
    return { label: 'Open contact page + copy message', action: 'contact_page' };
  }
  return { label: allowed[0]?.label ?? 'Review manually', action: allowed[0]?.action ?? 'review' };
}

export function prospectNextStepLabel(p: OwnerProspect): string {
  const resolved = resolveProspectScores(p);
  const verdict = prospectVerdict(resolved);
  const contact = resolveContactReadiness(resolved);

  if (verdict === 'Sensitive sector manual review') return 'Manual review before any outreach';
  if (verdict === 'Enterprise/manual review') return 'Review enterprise fit — not routine SMB outreach';
  if (verdict === 'Draft ready') return 'Review draft in inbox';
  if (contact === 'contact_form_ready' || contact === 'contact_page_ready') {
    return 'Open contact page + copy prepared message';
  }
  if (contact === 'phone_only') return 'Find email or contact form before email outreach';
  if (contact === 'needs_contact' || contact === 'no_contact_found') {
    return 'Find contact on website';
  }
  if (isTrulyOutreachReady(resolved)) return 'Approve outreach draft';
  if (resolved.scan_status === 'completed') return 'Review scan and qualify';
  if (resolved.scan_status === 'failed') return 'Retry scan';
  return 'Run security scan';
}

export function agencySignalsFromProspect(p: OwnerProspect): AgencySignals {
  const services = Array.isArray(p.detected_services) ? p.detected_services : [];
  return {
    websiteTechnologySignals: [],
    businessServiceSignals: services,
    hasClientWebsiteServiceEvidence: services.length > 0 && p.manages_client_sites === true,
    detectedServices: services,
    managesClientSites: p.manages_client_sites ?? null,
    hasPortfolio: false,
    hasTestimonials: false,
    hasServicePackages: false,
    mentionsMaintenanceOrCarePlans: false,
    mentionsHosting: false,
    servesLocalBusinesses: false,
    publicContactEmail: false,
    freelancerOnly: false,
    estimatedSiteCount: null,
    ownSiteSecuritySignals: false,
  };
}

export function shouldShowHotLabel(p: OwnerProspect): boolean {
  const fit = evaluateBuyerFit(p);
  return fit.sendQueueEligible && fit.qualityLabel === 'HOT';
}

export function icpStatusForProspect(p: OwnerProspect): string {
  return icpStatusLabel(evaluateBuyerFit(p).icpStatus);
}

export function buyerFitLabel(p: OwnerProspect): string {
  const score = p.opportunity_score ?? p.agency_opportunity_score ?? 0;
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

export function securityFitLabel(p: OwnerProspect): string {
  if (p.scan_score == null) return 'Unknown';
  if (p.scan_score <= 60) return 'High';
  if (p.scan_score <= 80) return 'Medium';
  return 'Low';
}
