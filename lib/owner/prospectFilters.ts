import type { OwnerProspect } from './types';
import { evaluateBuyerFit, isEmailSendEligible } from './icpGate';
import { resolveProspectScores } from './prospectDisplay';

export type ProspectFilterId =
  | 'all'
  | 'highest_opportunity'
  | 'highest_risk'
  | 'best_contact'
  | 'recent'
  | 'outreach_ready'
  | 'by_industry'
  | 'by_location'
  | 'by_plan_fit'
  | 'hot'
  | 'warm'
  | 'low'
  | 'needs_contact'
  | 'needs_review'
  | 'rejected'
  | 'smb'
  | 'agency'
  | 'by_contact_confidence'
  | 'by_source';

export const PROSPECT_FILTERS: { id: ProspectFilterId; label: string }[] = [
  { id: 'all', label: 'All in stage' },
  { id: 'hot', label: 'HOT' },
  { id: 'warm', label: 'WARM' },
  { id: 'low', label: 'LOW' },
  { id: 'needs_contact', label: 'Needs contact' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'highest_opportunity', label: 'Highest opportunity' },
  { id: 'highest_risk', label: 'Highest risk' },
  { id: 'best_contact', label: 'Best contact data' },
  { id: 'recent', label: 'Recently discovered' },
  { id: 'outreach_ready', label: 'Ready for outreach' },
  { id: 'smb', label: 'SMB only' },
  { id: 'agency', label: 'Agency only' },
  { id: 'by_industry', label: 'By industry' },
  { id: 'by_location', label: 'By location' },
  { id: 'by_plan_fit', label: 'By plan fit' },
  { id: 'by_contact_confidence', label: 'By contact confidence' },
  { id: 'by_source', label: 'By source' },
];

function contactScore(p: OwnerProspect): number {
  let s = 0;
  if (p.contact_confidence === 'verified_public_email') s += 5;
  if (p.contact_confidence === 'generic_public_inbox') s += 4;
  if (p.contact_confidence === 'likely_business_email') s += 3;
  if (p.contact_email_found) s += 2;
  if (p.contact_phone_found) s += 2;
  if (p.contact_page_found) s += 1;
  if (p.contact_linkedin_found) s += 1;
  return s;
}

export function applyProspectFilter(
  prospects: OwnerProspect[],
  filter: ProspectFilterId,
  filterValue?: string,
): OwnerProspect[] {
  const list = [...prospects];

  switch (filter) {
    case 'hot':
      return list.filter((p) => evaluateBuyerFit(resolveProspectScores(p)).qualityLabel === 'HOT');
    case 'warm':
      return list.filter((p) => evaluateBuyerFit(resolveProspectScores(p)).qualityLabel === 'WARM');
    case 'low':
      return list.filter((p) => evaluateBuyerFit(resolveProspectScores(p)).qualityLabel === 'LOW');
    case 'needs_contact':
      return list.filter(
        (p) => evaluateBuyerFit(resolveProspectScores(p)).revenueQueue === 'needs_contact',
      );
    case 'needs_review':
      return list.filter(
        (p) => evaluateBuyerFit(resolveProspectScores(p)).revenueQueue === 'manual_review',
      );
    case 'rejected':
      return list.filter(
        (p) => evaluateBuyerFit(resolveProspectScores(p)).revenueQueue === 'rejected_not_icp',
      );
    case 'smb':
      return list.filter((p) => p.prospect_kind !== 'agency');
    case 'agency':
      return list.filter((p) => p.prospect_kind === 'agency');
    case 'highest_opportunity':
      return list.sort(
        (a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0),
      );
    case 'highest_risk':
      return list.sort((a, b) => {
        const aScore = a.scan_score ?? 100;
        const bScore = b.scan_score ?? 100;
        return aScore - bScore;
      });
    case 'best_contact':
      return list.sort((a, b) => contactScore(b) - contactScore(a));
    case 'recent':
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case 'outreach_ready':
      return list.filter((p) => isEmailSendEligible(resolveProspectScores(p)));
    case 'by_industry':
      if (!filterValue) return list;
      return list.filter((p) =>
        (p.industry ?? '').toLowerCase().includes(filterValue.toLowerCase()),
      );
    case 'by_location':
      if (!filterValue) return list;
      const v = filterValue.toLowerCase();
      return list.filter(
        (p) =>
          (p.city ?? '').toLowerCase().includes(v) ||
          (p.state ?? '').toLowerCase().includes(v),
      );
    case 'by_plan_fit':
      if (!filterValue) return list;
      return list.filter((p) => String(p.estimated_plan_fit) === filterValue);
    case 'by_contact_confidence':
      if (!filterValue) return list;
      return list.filter((p) => p.contact_confidence === filterValue);
    case 'by_source':
      if (!filterValue) return list;
      return list.filter((p) => (p.discovery_source ?? '').includes(filterValue));
    default:
      return list.sort(
        (a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0),
      );
  }
}

export function activeProspects(prospects: OwnerProspect[]): OwnerProspect[] {
  return prospects.filter(
    (p) =>
      !p.deleted_at &&
      p.pipeline_state !== 'archived' &&
      p.pipeline_state !== 'ignore_forever',
  );
}
