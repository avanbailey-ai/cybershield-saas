import type { FounderInboxItem } from './founderOsV5';
import type { OwnerProspect } from './types';
import { activeProspects } from './prospectFilters';
import {
  filterProspectsByKind,
  hasOutreachContact,
  resolveProspectList,
  type ProspectKindView,
} from './prospectDisplay';
import { computeRevenueIntelligence } from './revenueIntelligence';

export function countActiveProspectsByKind(prospects: OwnerProspect[]) {
  const list = activeProspects(resolveProspectList(prospects));
  return {
    smb: filterProspectsByKind(list, 'smb').length,
    agency: filterProspectsByKind(list, 'agency').length,
    all: list.length,
  };
}

function outreachInboxItem(inbox: FounderInboxItem[]): FounderInboxItem | undefined {
  return inbox.find((i) => i.type === 'outreach');
}

function matchProspectFromInbox(
  item: FounderInboxItem,
  prospects: OwnerProspect[],
  kind: ProspectKindView,
): OwnerProspect | null {
  const list =
    kind === 'all'
      ? activeProspects(resolveProspectList(prospects))
      : filterProspectsByKind(activeProspects(resolveProspectList(prospects)), kind);

  const prospectId = item.meta?.prospectId;
  if (typeof prospectId === 'string') {
    const byId = list.find((p) => p.id === prospectId);
    if (byId) return byId;
  }

  const titleMatch = item.title.match(/Approve outreach:\s*(.+)/i);
  if (titleMatch) {
    const name = titleMatch[1].trim();
    const byName = list.find((p) => p.business_name === name);
    if (byName) return byName;
  }

  return null;
}

/** Single source of truth for Home best-lead cards and recommended actions. */
export function resolveBestLeadForKind(
  prospects: OwnerProspect[],
  inbox: FounderInboxItem[],
  kind: Exclude<ProspectKindView, 'all'>,
): OwnerProspect | null {
  const fromRanking = computeRevenueIntelligence(prospects, kind).highestConfidenceLead;
  if (fromRanking) return fromRanking;

  const outreach = outreachInboxItem(inbox);
  if (!outreach) return null;

  const fromInbox = matchProspectFromInbox(outreach, prospects, kind);
  if (fromInbox) return fromInbox;

  const ranked = filterProspectsByKind(activeProspects(resolveProspectList(prospects)), kind)
    .filter((p) => hasOutreachContact(p) || (p.opportunity_score ?? 0) >= 25)
    .sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0));

  return ranked[0] ?? null;
}
