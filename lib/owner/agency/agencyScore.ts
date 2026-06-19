/**
 * Agency opportunity scoring — SEPARATE from the SMB opportunity score in
 * salesIntelligence.ts. Scores how good a fit an agency is for CyberShield's
 * multi-site client monitoring (Agency plan), based on public signals only.
 *
 * Higher: maintenance/hosting/care plans, WordPress/Shopify, portfolio proof,
 * serves local businesses, manages multiple sites, public contact email,
 * testimonials, service packages, security/staleness signals on their own site.
 * Lower: no email, no portfolio proof, freelancer-only, no website services,
 * directory-only, gov/nonprofit/public.
 */

import type { AgencyLabel, AgencySignals, AgencyType } from './agencyTypes';
import { agencyTypeLabel } from './agencyTypes';
import { isDeprioritizedIndustry } from '../salesIntelligence';

/** Monthly price of the Agency plan used for revenue estimates. */
export const AGENCY_PLAN_PRICE = 299;

export interface AgencyScoreInput {
  businessName?: string | null;
  industry?: string | null;
  website?: string | null;
  signals: AgencySignals;
  agencyType?: AgencyType | null;
  /** Whether a public contact email was found through normal enrichment. */
  hasContactEmail?: boolean;
  httpValid?: boolean | null;
  dnsValid?: boolean | null;
}

export interface AgencyScoreResult {
  score: number;
  label: AgencyLabel;
  isAgency: boolean;
  estimatedSiteCount: number | null;
  managesClientSites: boolean | null;
  detectedServices: string[];
  whySelected: string;
  estimatedMrr: number;
  estimatedArr: number;
}

export function computeAgencyOpportunityScore(input: AgencyScoreInput): number {
  const s = input.signals;

  // Hard deprioritize gov/nonprofit/school/etc. — never a good agency fit.
  if (isDeprioritizedIndustry(input.industry ?? null, input.businessName)) {
    return Math.max(0, Math.min(20, s.detectedServices.length * 3));
  }

  let score = 0;

  // Core: do they manage client sites? (biggest positive)
  if (s.managesClientSites === true) score += 24;
  else if (s.managesClientSites === false) score -= 20;

  if (s.hasPortfolio) score += 14;
  if (s.hasTestimonials) score += 6;
  if (s.hasServicePackages) score += 8;

  // Recurring-revenue / managed-service signals are the strongest buying intent.
  if (s.mentionsMaintenanceOrCarePlans) score += 16;
  if (s.mentionsHosting) score += 8;

  // Platform breadth (WordPress/Shopify/etc.) — capped so it can't dominate.
  const platformServices = s.detectedServices.filter((x) =>
    ['wordpress', 'shopify', 'webflow', 'wix', 'squarespace', 'woocommerce', 'ecommerce'].includes(x),
  ).length;
  score += Math.min(12, platformServices * 4);

  const otherServices = s.detectedServices.filter((x) =>
    ['seo', 'security', 'managed_sites', 'digital_marketing', 'maintenance', 'care_plan'].includes(x),
  ).length;
  score += Math.min(8, otherServices * 2);

  if (s.servesLocalBusinesses) score += 6;
  if (input.hasContactEmail || s.publicContactEmail) score += 12;
  else score -= 10; // no way to reach them = low actionable fit

  // Multiple managed sites => stronger multi-site monitoring fit.
  if (s.estimatedSiteCount !== null) {
    if (s.estimatedSiteCount >= 20) score += 10;
    else if (s.estimatedSiteCount >= 5) score += 6;
    else score += 2;
  }

  // Security/staleness on their OWN site = a natural conversation starter.
  if (s.ownSiteSecuritySignals) score += 4;

  // Freelancer-only shops are lower fit for a multi-site product.
  if (s.freelancerOnly) score -= 12;

  if (input.httpValid === false && input.dnsValid === false) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function agencyLabelFromScore(score: number, signals: AgencySignals): AgencyLabel {
  // Anything with no evidence at all of managing/building sites is not a fit.
  const noEvidence =
    signals.managesClientSites === false ||
    (!signals.hasPortfolio &&
      signals.detectedServices.length === 0 &&
      signals.managesClientSites !== true);

  if (noEvidence && score < 30) return 'NOT AGENCY FIT';
  if (score >= 70) return 'AGENCY HOT';
  if (score >= 45) return 'AGENCY WARM';
  if (score >= 25) return 'AGENCY LOW';
  return 'NOT AGENCY FIT';
}

export function isAgencyFit(label: AgencyLabel): boolean {
  return label !== 'NOT AGENCY FIT';
}

/** Minimal shape decideProspectKind needs from a scored agency result. */
export interface ProspectKindDecisionInput {
  label: AgencyLabel;
  managesClientSites: boolean | null;
}

/**
 * Pure decision for which segment a scored prospect belongs to. This is the
 * single source of truth that keeps NOT-AGENCY-FIT (and weak) prospects OUT of
 * the agency pipeline so they don't pollute the agency segment.
 *
 * Conservative rule:
 *   - AGENCY HOT  / AGENCY WARM            -> 'agency'
 *   - AGENCY LOW                           -> 'agency' ONLY when there is real
 *                                             evidence it manages client sites
 *                                             (managesClientSites === true),
 *                                             otherwise stays 'smb'
 *   - NOT AGENCY FIT (and anything else)   -> 'smb'
 *
 * Agency scoring details may still be stored on an 'smb' row; the agency
 * views/filters key off prospect_kind === 'agency' (see lib/owner/prospectDisplay.ts
 * isAgencyKind, lib/owner/agency/agencyDraft.ts isAgencyProspect), so storing
 * details on an smb row never surfaces it in the agency segment.
 */
export function decideProspectKind(input: ProspectKindDecisionInput): 'agency' | 'smb' {
  switch (input.label) {
    case 'AGENCY HOT':
    case 'AGENCY WARM':
      return 'agency';
    case 'AGENCY LOW':
      return input.managesClientSites === true ? 'agency' : 'smb';
    case 'NOT AGENCY FIT':
    default:
      return 'smb';
  }
}

export function buildAgencyWhySelected(
  input: AgencyScoreInput,
  score: number,
  label: AgencyLabel,
): string {
  const s = input.signals;
  const reasons: string[] = [];

  if (s.managesClientSites === true) reasons.push('manages/builds client websites');
  if (s.mentionsMaintenanceOrCarePlans) reasons.push('offers maintenance / care plans');
  if (s.mentionsHosting) reasons.push('offers hosting');
  if (s.hasPortfolio) reasons.push('public portfolio of client work');
  const platforms = s.detectedServices.filter((x) =>
    ['wordpress', 'shopify', 'webflow', 'wix', 'squarespace', 'woocommerce'].includes(x),
  );
  if (platforms.length) reasons.push(`builds on ${platforms.join(', ')}`);
  if (s.servesLocalBusinesses) reasons.push('serves local businesses');
  if (input.hasContactEmail || s.publicContactEmail) reasons.push('public contact email available');
  if (s.estimatedSiteCount !== null) reasons.push(`~${s.estimatedSiteCount} client sites referenced`);

  if (reasons.length === 0) {
    return `Discovered as a possible ${agencyTypeLabel(input.agencyType)} but limited public evidence of managing client sites. Agency score ${score}/100 (${label}).`;
  }

  return `Selected as a ${agencyTypeLabel(input.agencyType)} because it ${reasons.join(
    ', ',
  )}. Agency score ${score}/100 (${label}).`;
}

export function scoreAgency(input: AgencyScoreInput): AgencyScoreResult {
  const score = computeAgencyOpportunityScore(input);
  const label = agencyLabelFromScore(score, input.signals);
  const whySelected = buildAgencyWhySelected(input, score, label);

  return {
    score,
    label,
    isAgency: isAgencyFit(label),
    estimatedSiteCount: input.signals.estimatedSiteCount,
    managesClientSites: input.signals.managesClientSites,
    detectedServices: input.signals.detectedServices,
    whySelected,
    estimatedMrr: AGENCY_PLAN_PRICE,
    estimatedArr: AGENCY_PLAN_PRICE * 12,
  };
}
