import type { RawDiscoveredBusiness } from './discovery/types';
import { websiteHostKey } from './discovery/normalize';
import { discoverFromOpenStreetMap } from './discovery/sources/openstreetmap';
import { discoverFromNominatimSearch } from './discovery/sources/nominatimSearch';
import { buildAgencySearchPlan, NATIONWIDE_AGENCY_LIMITS } from './discovery/agencyQueries';
import type { RevenueTarget } from './revenueEngine';

/** Bounded SMB metros — no user location required. */
const SMB_SAMPLE_METROS = ['Portland, OR', 'Austin, TX', 'Denver, CO', 'Chicago, IL'] as const;

const SMB_NOMINATIM_QUERIES = [
  'restaurant Portland OR',
  'contractor Austin TX',
  'law firm Denver CO',
  'real estate office Chicago IL',
  'salon Portland OR',
  'gym Austin TX',
];

function dedupeRaw(items: RawDiscoveredBusiness[], cap: number): RawDiscoveredBusiness[] {
  const seen = new Set<string>();
  const out: RawDiscoveredBusiness[] = [];
  for (const item of items) {
    const key = websiteHostKey(item.website);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= cap) break;
  }
  return out;
}

/** Free SMB websites from bounded OSM + Nominatim sampling. */
export async function discoverSmbSourcePack(maxResults: number): Promise<RawDiscoveredBusiness[]> {
  const perMetro = Math.max(3, Math.ceil(maxResults / SMB_SAMPLE_METROS.length));
  const raw: RawDiscoveredBusiness[] = [];

  for (const metro of SMB_SAMPLE_METROS) {
    const osm = await discoverFromOpenStreetMap({
      location: metro,
      industry: 'general',
      radiusMeters: 25_000,
      maxResults: perMetro,
    });
    raw.push(...osm.results);
  }

  const nom = await discoverFromNominatimSearch({
    location: 'United States',
    industry: 'general',
    radiusMeters: 40_000,
    maxResults: Math.min(8, maxResults),
    searchQueries: SMB_NOMINATIM_QUERIES.slice(0, 4),
  });
  raw.push(...nom.results);

  return dedupeRaw(raw, maxResults);
}

/** Free agency websites — nationwide metro pack, no location input. */
export async function discoverAgencySourcePack(maxResults: number): Promise<RawDiscoveredBusiness[]> {
  const plan = buildAgencySearchPlan('web_design', '', { discoveryScope: 'nationwide' });
  const raw: RawDiscoveredBusiness[] = [];

  const nom = await discoverFromNominatimSearch({
    location: 'United States',
    industry: 'web_design_agency',
    radiusMeters: 40_000,
    maxResults: Math.min(NATIONWIDE_AGENCY_LIMITS.maxQueriesTotal, maxResults),
    searchQueries: plan.queries.slice(0, 6),
  });
  raw.push(...nom.results);

  const osm = await discoverFromOpenStreetMap({
    location: 'United States',
    industry: 'web_design_agency',
    radiusMeters: 35_000,
    maxResults,
    searchLocations: plan.osmSearchHubs?.slice(0, NATIONWIDE_AGENCY_LIMITS.maxMetrosPerRun),
  });
  raw.push(...osm.results);

  return dedupeRaw(raw, maxResults);
}

export async function discoverFreeSourcePack(
  target: RevenueTarget,
  maxResults: number,
): Promise<RawDiscoveredBusiness[]> {
  if (target === 'agency') return discoverAgencySourcePack(maxResults);
  if (target === 'smb') return discoverSmbSourcePack(maxResults);
  const half = Math.ceil(maxResults / 2);
  const smb = await discoverSmbSourcePack(half);
  const agency = await discoverAgencySourcePack(half);
  return dedupeRaw([...smb, ...agency], maxResults);
}
