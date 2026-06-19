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

const INDUSTRY_SEARCH_TERMS: Record<string, string> = {
  healthcare: 'clinic doctor dentist hospital pharmacy',
  dental: 'dentist dental',
  legal: 'lawyer attorney law firm',
  contractors: 'contractor electrician plumber',
  retail: 'shop store retail',
  hospitality: 'restaurant cafe',
  technology: 'software IT company',
  general: 'business',
  // ── Agency Prospect System search seeds (Founder OS agency discovery) ──
  web_agency: 'web design agency',
  web_design_agency: 'web design agency website developer',
  wordpress_agency: 'wordpress web design agency',
  shopify_agency: 'shopify ecommerce agency',
  ecommerce_agency: 'ecommerce web design agency online store',
  seo_agency: 'seo marketing agency',
  marketing_agency: 'digital marketing agency advertising',
  branding_agency: 'branding design agency studio',
  creative_agency: 'creative design studio agency',
  dev_agency: 'web development agency software studio',
  msp_agency: 'managed it services provider web agency',
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
  if (/software|it|tech/.test(lower)) return 'Technology';
  return 'General';
}

/** Fallback OSM discovery via Nominatim search (no Overpass). */
export async function discoverFromNominatimSearch(
  params: DiscoveryParams,
): Promise<ProviderResult> {
  const industryTerm =
    INDUSTRY_SEARCH_TERMS[params.industry.toLowerCase()] ?? INDUSTRY_SEARCH_TERMS.general;
  const q = `${industryTerm} ${params.location}`.trim();
  const limit = Math.min(params.maxResults, 50);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('extratags', '1');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' },
  });

  const text = await res.text();
  const snippet = text.slice(0, 300);
  if (!res.ok) {
    return failedDiagnostic('nominatim_search', `Nominatim error: ${res.status}`, {
      statusCode: res.status,
      responseSnippet: snippet,
    });
  }

  let rows: Array<{
    display_name?: string;
    type?: string;
    extratags?: Record<string, string>;
    address?: { city?: string; state?: string; country_code?: string };
  }>;

  try {
    rows = JSON.parse(text) as typeof rows;
  } catch {
    return failedDiagnostic('nominatim_search', 'Invalid Nominatim JSON', {
      responseSnippet: snippet,
    });
  }

  const results: RawDiscoveredBusiness[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
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

  return succeededDiagnostic('nominatim_search', results, {
    responseSnippet: `query=${q} hits=${rows.length} with_website=${results.length}`,
  });
}

export const nominatimSearchProvider: DiscoveryProvider = {
  name: 'nominatim_search',
  enabled: true,
  discover: discoverFromNominatimSearch,
};
