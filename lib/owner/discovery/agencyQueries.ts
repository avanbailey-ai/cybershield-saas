import type { AgencyType } from '../agency/agencyTypes';
import type { DiscoveryScope } from './settings';

/** Nominatim search seed terms per agency type (keys exist in nominatimSearch). */
export const AGENCY_SEARCH_SEEDS: Record<AgencyType, string> = {
  web_design: 'web_design_agency',
  wordpress: 'wordpress_agency',
  shopify: 'shopify_agency',
  ecommerce: 'ecommerce_agency',
  seo: 'seo_agency',
  marketing: 'marketing_agency',
  branding: 'branding_agency',
  creative_studio: 'creative_agency',
  dev_shop: 'dev_agency',
  msp: 'msp_agency',
  unknown: 'web_agency',
};

/** Bounded metro list for Nationwide agency discovery (not every US city). */
export const NATIONWIDE_AGENCY_METROS = [
  'Portland, OR',
  'Seattle, WA',
  'San Francisco, CA',
  'Los Angeles, CA',
  'San Diego, CA',
  'Phoenix, AZ',
  'Denver, CO',
  'Austin, TX',
  'Dallas, TX',
  'Chicago, IL',
  'Miami, FL',
  'Atlanta, GA',
  'New York, NY',
  'Boston, MA',
] as const;

/** Hard caps to avoid overloading public Overpass/Nominatim endpoints. */
export const NATIONWIDE_AGENCY_LIMITS = {
  maxMetrosPerRun: 6,
  maxQueriesPerMetro: 2,
  maxQueriesTotal: 12,
} as const;

/** High-intent terms for nationwide agency runs (small set, metro-scoped). */
export const NATIONWIDE_AGENCY_QUERY_TERMS = [
  'web design agency',
  'WordPress agency',
  'Shopify developer',
  'website maintenance',
  'SEO agency',
  'digital marketing agency',
  'website hosting',
  'web development agency',
] as const;

/** Nearby expansions for regional runs when primary city returns low hits. */
const EXPANSION_BY_CITY: Record<string, string[]> = {
  medford: ['Central Point OR', 'Ashland OR', 'Grants Pass OR', 'Rogue Valley OR', 'Southern Oregon'],
};

const AGENCY_QUERY_TERMS: Record<AgencyType, string[]> = {
  web_design: [
    'web design agency',
    'website design',
    'WordPress agency',
    'digital marketing agency',
    'SEO agency',
    'website maintenance',
    'Shopify developer',
    'web development agency',
    'website hosting',
    'business website design',
  ],
  wordpress: [
    'WordPress agency',
    'WordPress developer',
    'WordPress maintenance',
    'web design agency',
    'website design',
  ],
  shopify: [
    'Shopify developer',
    'Shopify agency',
    'ecommerce web design',
    'online store developer',
  ],
  ecommerce: [
    'ecommerce agency',
    'Shopify developer',
    'online store design',
    'woocommerce agency',
  ],
  seo: ['SEO agency', 'search engine optimization', 'digital marketing agency', 'SEO consultant'],
  marketing: [
    'digital marketing agency',
    'marketing agency',
    'advertising agency',
    'social media agency',
  ],
  branding: ['branding agency', 'creative agency', 'design studio'],
  creative_studio: ['creative agency', 'design studio', 'branding agency'],
  dev_shop: ['web development agency', 'software studio', 'web developer'],
  msp: ['managed IT services', 'MSP', 'IT support company', 'web hosting'],
  unknown: [
    'web design agency',
    'digital marketing agency',
    'website design',
    'WordPress agency',
  ],
};

export interface AgencySearchPlan {
  queries: string[];
  normalizedLocation: string;
  locationsUsed: string[];
  metrosSearched: string[];
  queriesByMetro: Record<string, string[]>;
  expansionNote: string | null;
  /** Nationwide only — bounded OSM metro sampling. */
  osmSearchHubs?: string[];
  nationwide: boolean;
  limits: typeof NATIONWIDE_AGENCY_LIMITS | null;
}

export function isNationwideAgencyScope(scope: DiscoveryScope | undefined): boolean {
  return scope === 'nationwide';
}

function normalizeLocationKey(location: string): string {
  return location.toLowerCase().split(',')[0]?.trim() ?? location.toLowerCase();
}

function expansionForLocation(location: string): string[] {
  const key = normalizeLocationKey(location);
  for (const [city, expansions] of Object.entries(EXPANSION_BY_CITY)) {
    if (key.includes(city)) return expansions;
  }
  return [];
}

function buildNationwidePlan(agencyType: AgencyType): AgencySearchPlan {
  const { maxMetrosPerRun, maxQueriesPerMetro, maxQueriesTotal } = NATIONWIDE_AGENCY_LIMITS;
  const metros = [...NATIONWIDE_AGENCY_METROS].slice(0, maxMetrosPerRun);
  const terms =
    agencyType === 'web_design' || agencyType === 'unknown'
      ? [...NATIONWIDE_AGENCY_QUERY_TERMS]
      : (AGENCY_QUERY_TERMS[agencyType] ?? AGENCY_QUERY_TERMS.unknown).slice(0, maxQueriesPerMetro);

  const queries: string[] = [];
  const queriesByMetro: Record<string, string[]> = {};
  const seen = new Set<string>();

  for (const metro of metros) {
    const metroQueries: string[] = [];
    for (const term of terms.slice(0, maxQueriesPerMetro)) {
      const q = `${term} ${metro}`.trim();
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      queries.push(q);
      metroQueries.push(q);
      if (queries.length >= maxQueriesTotal) break;
    }
    if (metroQueries.length > 0) queriesByMetro[metro] = metroQueries;
    if (queries.length >= maxQueriesTotal) break;
  }

  return {
    queries,
    normalizedLocation: 'United States (nationwide metros)',
    locationsUsed: metros,
    metrosSearched: metros,
    queriesByMetro,
    osmSearchHubs: metros,
    expansionNote: `Nationwide agency discovery — bounded sampling of ${metros.length} US metros (${metros.join(', ')}). Max ${maxQueriesPerMetro} queries/metro, ${maxQueriesTotal} total.`,
    nationwide: true,
    limits: NATIONWIDE_AGENCY_LIMITS,
  };
}

/** Build multi-query agency search strings for Nominatim (deduped, capped). */
export function buildAgencySearchPlan(
  agencyType: AgencyType,
  location: string,
  options?: {
    includeExpansion?: boolean;
    maxQueries?: number;
    discoveryScope?: DiscoveryScope;
  },
): AgencySearchPlan {
  if (isNationwideAgencyScope(options?.discoveryScope)) {
    return buildNationwidePlan(agencyType);
  }

  const maxQueries = options?.maxQueries ?? 12;
  const trimmed = location.trim() || 'Medford, OR';
  const terms = AGENCY_QUERY_TERMS[agencyType] ?? AGENCY_QUERY_TERMS.unknown;
  const scope = options?.discoveryScope ?? 'regional';
  const includeExpansion =
    options?.includeExpansion !== false &&
    scope !== 'local' &&
    scope !== 'statewide' &&
    scope !== 'nationwide';

  const locationsUsed = [trimmed];
  const expansions = includeExpansion ? expansionForLocation(trimmed) : [];
  if (expansions.length > 0) locationsUsed.push(...expansions.slice(0, 3));

  const queries: string[] = [];
  const queriesByMetro: Record<string, string[]> = { [trimmed]: [] };
  const seen = new Set<string>();

  for (const loc of locationsUsed) {
    if (!queriesByMetro[loc]) queriesByMetro[loc] = [];
    for (const term of terms) {
      const q = `${term} ${loc}`.trim();
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      queries.push(q);
      queriesByMetro[loc]!.push(q);
      if (queries.length >= maxQueries) break;
    }
    if (queries.length >= maxQueries) break;
  }

  const expansionNote =
    expansions.length > 0 && locationsUsed.length > 1
      ? `Expanded from ${trimmed} to ${locationsUsed.slice(1).join(', ')} for broader regional coverage (not nationwide).`
      : null;

  return {
    queries,
    normalizedLocation: trimmed,
    locationsUsed,
    metrosSearched: locationsUsed,
    queriesByMetro,
    expansionNote,
    nationwide: false,
    limits: null,
  };
}

export function isAgencyDiscoveryIndustry(industry: string): boolean {
  const lower = industry.toLowerCase();
  return lower.endsWith('_agency') || lower === 'web_agency' || lower === 'msp_agency';
}

/** Suggestion when local/regional agency run returns zero raw results. */
export function localZeroRawSuggestion(location: string): string {
  const key = normalizeLocationKey(location);
  if (key.includes('medford')) {
    return 'Medford returned limited agency candidates. Try Rogue Valley, Oregon, or Nationwide Agency Discovery.';
  }
  return 'No local raw candidates returned. Try Regional or Nationwide Agency Discovery.';
}
