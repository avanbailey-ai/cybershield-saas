import type { OwnerProspect } from './types';

export type ProspectFilterId =
  | 'all'
  | 'highest_opportunity'
  | 'highest_risk'
  | 'best_contact'
  | 'recent'
  | 'outreach_ready'
  | 'by_industry'
  | 'by_location'
  | 'by_plan_fit';

export const PROSPECT_FILTERS: { id: ProspectFilterId; label: string }[] = [
  { id: 'all', label: 'All in stage' },
  { id: 'highest_opportunity', label: 'Highest opportunity' },
  { id: 'highest_risk', label: 'Highest risk' },
  { id: 'best_contact', label: 'Best contact data' },
  { id: 'recent', label: 'Recently discovered' },
  { id: 'outreach_ready', label: 'Ready for outreach' },
  { id: 'by_industry', label: 'By industry' },
  { id: 'by_location', label: 'By location' },
  { id: 'by_plan_fit', label: 'By plan fit' },
];

function contactScore(p: OwnerProspect): number {
  let s = 0;
  if (p.contact_email_found) s += 3;
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
  let list = [...prospects];

  switch (filter) {
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
      return list.filter(
        (p) =>
          p.pipeline_state === 'outreach_ready' ||
          (p.lead_score === 'HOT' && p.scan_status === 'completed'),
      );
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
