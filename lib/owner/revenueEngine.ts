import type { OwnerProspect } from './types';
import { websiteHostKey } from './discovery/normalize';
import { resolveContactReadiness } from './prospectVerdict';

export type RevenueSourceMode =
  | 'free_sources'
  | 'paste_urls'
  | 'csv'
  | 'existing_pipeline'
  | 'source_url';

export type RevenueTarget = 'smb' | 'agency' | 'both';

export type RevenueActionStatus =
  | 'draft_ready'
  | 'contact_form_ready'
  | 'needs_contact'
  | 'needs_scan'
  | 'existing_prospect'
  | 'not_urgent'
  | 'rejected'
  | 'failed_scan'
  | 'weak_score';

export type ContactPathType =
  | 'verified_public_email'
  | 'generic_public_email'
  | 'same_domain_email'
  | 'contact_form_ready'
  | 'contact_page_ready'
  | 'phone_only'
  | 'no_contact_found';

export interface RevenueEngineLimits {
  maxCandidates: number;
  maxScans: number;
  maxContactFetches: number;
}

export const DEFAULT_REVENUE_LIMITS: RevenueEngineLimits = {
  maxCandidates: 50,
  maxScans: 25,
  maxContactFetches: 25,
};

export interface RevenueActionCard {
  prospectId?: string;
  businessName: string;
  domain: string;
  scanScore: number | null;
  topFindings: string[];
  contactPath: ContactPathType;
  contactDetail: string | null;
  contactFormUrl: string | null;
  status: RevenueActionStatus;
  planFit: string | null;
  nextAction: string;
}

export interface RevenueEngineResult {
  websitesFound: number;
  websitesScanned: number;
  weakScoreLeads: number;
  contactPathsFound: number;
  draftsGenerated: number;
  alreadyInPipeline: number;
  notUrgent: number;
  failedScans: number;
  needsContact: number;
  rejected: number;
  summaryMessage: string;
  nextRecommendedAction: string;
  results: RevenueActionCard[];
}

export function isWeakScanScore(
  score: number | null | undefined,
  riskLevel: string | null | undefined,
): boolean {
  if (score == null) return false;
  if (score <= 70) return true;
  if (score <= 80 && (riskLevel === 'high' || riskLevel === 'critical')) return true;
  return false;
}

export function contactPathForProspect(p: Partial<OwnerProspect>): ContactPathType {
  const readiness = resolveContactReadiness(p as OwnerProspect);
  switch (readiness) {
    case 'verified_email':
      return 'verified_public_email';
    case 'public_email':
      return p.contact_confidence === 'generic_public_inbox' ? 'generic_public_email' : 'same_domain_email';
    case 'contact_form_ready':
      return 'contact_form_ready';
    case 'contact_page_ready':
      return 'contact_page_ready';
    case 'phone_only':
      return 'phone_only';
    default:
      return 'no_contact_found';
  }
}

export function contactFormUrlForWebsite(website: string): string {
  try {
    const base = website.startsWith('http') ? website : `https://${website}`;
    return new URL('/contact', base).toString();
  } catch {
    return website;
  }
}

export function topFindingsFromProspect(p: Partial<OwnerProspect>, limit = 3): string[] {
  const findings = p.scan_findings as { issues?: string[] } | null | undefined;
  const issues = findings?.issues ?? [];
  if (issues.length > 0) return issues.slice(0, limit);
  if (p.top_issue) return [p.top_issue];
  return [];
}

export function revenueStatusForProspect(
  p: Partial<OwnerProspect>,
  opts?: { isDuplicate?: boolean; hasDraft?: boolean },
): RevenueActionStatus {
  if (opts?.isDuplicate) return 'existing_prospect';
  if (p.scan_status === 'failed') return 'failed_scan';
  if (p.rejection_reason && p.quality_label === 'REJECTED') return 'rejected';
  if (p.scan_status !== 'completed') return 'needs_scan';
  if (opts?.hasDraft && p.contact_email) return 'draft_ready';
  const weak = isWeakScanScore(p.scan_score, p.scan_risk_level);
  const path = contactPathForProspect(p);
  if (path === 'contact_form_ready' || path === 'contact_page_ready') return 'contact_form_ready';
  if (path === 'phone_only' || path === 'no_contact_found') return 'needs_contact';
  if (opts?.hasDraft || (p.pipeline_state === 'outreach_ready' && p.contact_email)) return 'draft_ready';
  if (!weak && (p.scan_score ?? 100) > 80) return 'not_urgent';
  if (weak) return 'needs_contact';
  return 'not_urgent';
}

export function nextActionForStatus(status: RevenueActionStatus, p: Partial<OwnerProspect>): string {
  switch (status) {
    case 'draft_ready':
      return 'Review draft in inbox';
    case 'contact_form_ready':
      return 'Open contact form + copy message';
    case 'needs_contact':
      return 'Enrich contact';
    case 'needs_scan':
      return 'Run scan';
    case 'existing_prospect':
      return 'View existing prospect';
    case 'not_urgent':
      return 'Save for later or ignore';
    case 'failed_scan':
      return 'Rescan or remove';
    case 'rejected':
      return 'Ignore';
    case 'weak_score':
      return 'Review weak-score site';
    default:
      return 'Review in pipeline';
  }
}

export function buildRevenueActionCard(
  p: Partial<OwnerProspect> & { business_name: string; website: string },
  opts?: { isDuplicate?: boolean; hasDraft?: boolean },
): RevenueActionCard {
  const status = revenueStatusForProspect(p, opts);
  const path = contactPathForProspect(p);
  const domain = websiteHostKey(p.website);
  let planFit: string | null = null;
  if (p.estimated_plan_fit === 299 && p.prospect_kind === 'agency') planFit = 'Agency $299';
  else if (p.estimated_plan_fit === 149) planFit = 'Growth $149';
  else if (p.estimated_plan_fit === 79) planFit = 'Pro $79';
  else if (p.estimated_plan_fit) planFit = `$${p.estimated_plan_fit}/mo`;

  return {
    prospectId: p.id as string | undefined,
    businessName: p.business_name,
    domain,
    scanScore: p.scan_score ?? null,
    topFindings: topFindingsFromProspect(p),
    contactPath: path,
    contactDetail: p.contact_email ?? p.contact_phone ?? null,
    contactFormUrl:
      path === 'contact_form_ready' || path === 'contact_page_ready'
        ? contactFormUrlForWebsite(p.website)
        : null,
    status,
    planFit,
    nextAction: nextActionForStatus(status, p),
  };
}

export function formatRevenueEngineSummary(r: RevenueEngineResult): string {
  return [
    `${r.weakScoreLeads} weak-score websites`,
    `${r.contactPathsFound} contact paths`,
    `${r.draftsGenerated} drafts ready`,
    `${r.needsContact} need contact`,
    `${r.alreadyInPipeline} already in pipeline`,
    `${r.notUrgent} not urgent`,
    r.failedScans ? `${r.failedScans} failed scans` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function hasUsefulRevenueAction(r: RevenueEngineResult): boolean {
  return (
    r.weakScoreLeads > 0 ||
    r.contactPathsFound > 0 ||
    r.draftsGenerated > 0 ||
    r.needsContact > 0 ||
    r.alreadyInPipeline > 0
  );
}
