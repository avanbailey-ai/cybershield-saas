import { BANNED_DEMO_PATTERNS } from './founderNav';
import type { FounderInboxItem } from './founderOsV5';
import type { OwnerProspect } from './types';

export function matchesBannedDemoPattern(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const normalized = text.toLowerCase();
  return BANNED_DEMO_PATTERNS.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

export function isBannedDemoProspect(
  p: Pick<OwnerProspect, 'business_name' | 'website'>,
): boolean {
  return (
    matchesBannedDemoPattern(p.business_name) || matchesBannedDemoPattern(p.website)
  );
}

export function filterBannedDemoProspects<T extends Pick<OwnerProspect, 'business_name' | 'website'>>(
  prospects: T[],
): T[] {
  return prospects.filter((p) => !isBannedDemoProspect(p));
}

export function filterBannedDemoInboxItems(items: FounderInboxItem[]): FounderInboxItem[] {
  return items.filter(
    (item) =>
      !matchesBannedDemoPattern(item.title) && !matchesBannedDemoPattern(item.description),
  );
}
