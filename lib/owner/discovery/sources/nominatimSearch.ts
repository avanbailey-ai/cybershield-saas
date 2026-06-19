import type { DiscoveryParams } from '../provider';
import {
  failedDiagnostic,
  succeededDiagnostic,
  type DiscoveryProvider,
  type ProviderResult,
} from '../provider';
import type { RawDiscoveredBusiness } from '../types';
import { normalizeWebsiteUrl, nameFromWebsite } from '../normalize';

const NOMINATIM_UA =
  'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com';

const NOMINATIM_DELAY_MS = 1100;

const INDUSTRY_SEARCH_TERMS: Record<string, string> = {
  healthcare: 'clinic doctor dentist hospital pharmacy',
  dental: 'dentist dental',
  legal: 'lawyer attorney law firm',
  contractors: 'contractor electrician plumber',
  retail: 'shop store retail',
  hospitality: 'restaurant cafe',
  technology: 'software IT company',
  general: 'business',
  web_agency: 'web design agency',
  web_design_agency: 'web design agency',
  wordpress_agency: 'wordpress web design agency',
  shopify_agency: 'shopify ecommerce agency',
  ecommerce_agency: 'ecommerce web design agency',
  seo_agency: 'seo marketing agency',
  marketing_agency: 'digital marketing agency',
  branding_agency: 'branding design agency',
  creative_agency: 'creative design studio agency',
  dev_agency: 'web development agency',
  msp_agency: 'managed it services provider',
};

function inferIndustryFromClass(
  type: string | undefined,
  extratags: Record<string, string> | undefined,
): string {
  const amenity = extratags?.amenity ?? extratags?.office ?? extratags?.shop ?? type ?? '';
  const lower = amenity.toLowerCase();
  if (/dent|doctor|clinic|hospital|pharm/.test(lower)) return 'Healthcare';
  if (/law|attorney/.test(lower)) return 'Legal';
  if (/contract|electric|plumb/.test(lower)) return 'Contractors';
  if (/restaurant|cafe|food/.test(lower)) return 'Hospitality';
  if (/shop|store|retail/.test(lower)) return 'Retail';
  if (/software|it|tech|marketing|design|advert/.test(lower)) return 'Technology';
  return 'General';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type NominatimRow = {
  display_name?: string;
  type?: string;
  extratags?: Record<string, string>;
  address?: { city?: string; state?: string; country_code?: string };
};

function rowsToBusinesses(rows: NominatimRow[], seen: Set<string>): {
  results: RawDiscoveredBusiness[];
  rawBeforeWebsiteFilter: number;
} {
  const results: RawDiscoveredBusiness[] = [];
  let rawBeforeWebsiteFilter = 0;

  for (const row of rows) {
    rawBeforeWebsiteFilter++;
    const raw =
      row.extratags?.website ??
      row.extratags?.['contact:website'] ??
      row.extratags?.url;
    if (!raw) continue;

    const website = normalizeWebsiteUrl(raw);
    if (!website || seen.has(website)) continue;
    seen.add(website);

    const name =
      row.extratags?.name ??
      row.display_name?.split(',')[0]?.trim() ??
      nameFromWebsite(website);

    results.push({
      business_name: name,
      website,
      industry: inferIndustryFromClass(row.type, row.extratags),
      city: row.address?.city ?? null,
      state: row.address?.state ?? null,
      country: row.address?.country_code?.toUpperCase() ?? 'US',
      discovery_source: 'nominatim_search',
      discovery_source_url: 'https://nominatim.openstreetmap.org',
      confidence: 0.75,
    });
  }

  return { results, rawBeforeWebsiteFilter };
}

async function fetchNominatimQuery(q: string, limit: number): Promise<{
  ok: boolean;
  status: number;
  rows: NominatimRow[];
  snippet: string;
}> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('extratags', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'us');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' },
  });

  const text = await res.text();
  const snippet = text.slice(0, 300);
  if (!res.ok) {
    return { ok: false, status: res.status, rows: [], snippet };
  }

  try {
    const rows = JSON.parse(text) as NominatimRow[];
    return { ok: true, status: res.status, rows, snippet };
  } catch {
    return { ok: false, status: res.status, rows: [], snippet: `Invalid JSON: ${snippet}` };
  }
}

/** Fallback OSM discovery via Nominatim search (no Overpass). Supports multi-query agency runs. */
export async function discoverFromNominatimSearch(
  params: DiscoveryParams,
): Promise<ProviderResult> {
  const industryTerm =
    INDUSTRY_SEARCH_TERMS[params.industry.toLowerCase()] ?? INDUSTRY_SEARCH_TERMS.general;

  const queries =
    params.searchQueries && params.searchQueries.length > 0
      ? params.searchQueries
      : [`${industryTerm} ${params.location}`.trim()];

  const limit = Math.min(params.maxResults, 50);
  const seen = new Set<string>();
  const allResults: RawDiscoveredBusiness[] = [];
  let rawResponseCount = 0;
  let rawBeforeWebsiteFilter = 0;
  let lastSnippet = '';
  let lastStatus = 200;
  const querySnippets: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(NOMINATIM_DELAY_MS);
    const q = queries[i]!;
    const response = await fetchNominatimQuery(q, limit);
    lastSnippet = response.snippet;
    lastStatus = response.status;

    if (!response.ok) {
      return failedDiagnostic('nominatim_search', `Nominatim error: ${response.status}`, {
        statusCode: response.status,
        responseSnippet: response.snippet,
        providerEnabled: true,
        providerCalled: true,
        providerError: `HTTP ${response.status}`,
        queriesAttempted: queries.slice(0, i + 1),
        rawResponseCount,
        rawBeforeWebsiteFilter,
        normalizedLocation: params.location,
      });
    }

    rawResponseCount += response.rows.length;
    const parsed = rowsToBusinesses(response.rows, seen);
    rawBeforeWebsiteFilter += parsed.rawBeforeWebsiteFilter;
    allResults.push(...parsed.results);
    querySnippets.push(`"${q}" → ${response.rows.length} hits, ${parsed.results.length} with website`);

    if (allResults.length >= limit) break;
  }

  const capped = allResults.slice(0, limit);

  return succeededDiagnostic('nominatim_search', capped, {
    providerEnabled: true,
    providerCalled: true,
    queriesAttempted: queries,
    rawResponseCount,
    rawBeforeWebsiteFilter,
    normalizedLocation: params.location,
    responseSnippet: querySnippets.join(' | '),
    statusCode: lastStatus,
  });
}

export const nominatimSearchProvider: DiscoveryProvider = {
  name: 'nominatim_search',
  enabled: true,
  discover: discoverFromNominatimSearch,
};
