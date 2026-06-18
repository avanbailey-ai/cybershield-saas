import { createHash } from 'crypto';
import type { DiscoveryParams } from '../provider';
import {
  failedDiagnostic,
  skippedDiagnostic,
  succeededDiagnostic,
  type DiscoveryProvider,
  type ProviderResult,
} from '../provider';
import type { RawDiscoveredBusiness } from '../types';
import { geocodeLocation } from '../geocode';
import { normalizeWebsiteUrl, nameFromWebsite } from '../normalize';

const OVERPASS_UA =
  'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const OSM_INDUSTRY_MAP: Record<string, string> = {
  dentist: 'Healthcare',
  doctors: 'Healthcare',
  clinic: 'Healthcare',
  hospital: 'Healthcare',
  pharmacy: 'Healthcare',
  lawyer: 'Legal',
  attorney: 'Legal',
  accounting: 'Professional Services',
  insurance: 'Insurance',
  bank: 'Finance',
  restaurant: 'Hospitality',
  cafe: 'Hospitality',
  shop: 'Retail',
  supermarket: 'Retail',
  it: 'Technology',
  software: 'Technology',
  electrician: 'Contractors',
  plumber: 'Contractors',
  carpenter: 'Contractors',
};

const INDUSTRY_OVERPASS_FILTERS: Record<string, string[]> = {
  healthcare: ['["amenity"~"^(dentist|doctors|clinic|hospital|pharmacy)$"]'],
  dental: ['["amenity"="dentist"]'],
  legal: ['["office"="lawyer"]', '["amenity"="lawyer"]'],
  contractors: ['["craft"]', '["building"]'],
  retail: ['["shop"]'],
  hospitality: ['["amenity"~"^(restaurant|cafe|fast_food)$"]'],
  technology: ['["office"="it"]', '["office"="software"]'],
  general: ['["website"]'],
};

function inferIndustry(tags: Record<string, string>): string {
  for (const key of ['healthcare', 'office', 'shop', 'amenity', 'craft']) {
    const val = tags[key];
    if (!val) continue;
    const mapped = OSM_INDUSTRY_MAP[val.toLowerCase()];
    if (mapped) return mapped;
  }
  if (tags.industry) return tags.industry;
  return 'General';
}

function extractWebsite(tags: Record<string, string>): string | null {
  const raw = tags.website || tags['contact:website'] || tags.url || tags['website:URL'];
  if (!raw) return null;
  return normalizeWebsiteUrl(raw);
}

function queryHash(query: string): string {
  return createHash('sha256').update(query).digest('hex').slice(0, 12);
}

function buildOverpassQuery(
  lat: number,
  lon: number,
  radiusMeters: number,
  industry: string,
  limit: number,
): string {
  const filters = INDUSTRY_OVERPASS_FILTERS[industry.toLowerCase()] ?? INDUSTRY_OVERPASS_FILTERS.general;
  const capped = Math.min(Math.max(limit, 1), 50);
  const filterBlocks = filters
    .map(
      (f) => `
      node["website"]${f}(around:${radiusMeters},${lat},${lon});
      way["website"]${f}(around:${radiusMeters},${lat},${lon});
    `,
    )
    .join('\n');

  return `[out:json][timeout:25];
(
${filterBlocks}
);
out center ${capped};`;
}

async function callOverpass(query: string): Promise<{
  ok: boolean;
  status: number;
  data?: { elements?: Array<{ tags?: Record<string, string> }> };
  snippet: string;
  endpoint: string;
}> {
  let lastStatus = 0;
  let lastSnippet = '';

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Accept: 'application/json',
        'User-Agent': OVERPASS_UA,
      },
      body: query,
    });

    const text = await res.text();
    lastStatus = res.status;
    lastSnippet = text.slice(0, 300);

    if (!res.ok) continue;

    try {
      const data = JSON.parse(text) as { elements?: Array<{ tags?: Record<string, string> }> };
      return { ok: true, status: res.status, data, snippet: lastSnippet, endpoint };
    } catch {
      lastSnippet = `Invalid JSON: ${lastSnippet}`;
    }
  }

  return { ok: false, status: lastStatus, snippet: lastSnippet, endpoint: OVERPASS_ENDPOINTS[0] };
}

function parseElements(
  elements: Array<{ tags?: Record<string, string> }> | undefined,
  maxResults: number,
): RawDiscoveredBusiness[] {
  const results: RawDiscoveredBusiness[] = [];
  const seen = new Set<string>();

  for (const el of elements ?? []) {
    if (results.length >= maxResults) break;
    const tags = el.tags ?? {};
    const website = extractWebsite(tags);
    if (!website || seen.has(website)) continue;
    seen.add(website);

    const name = tags.name || tags.brand || nameFromWebsite(website);
    results.push({
      business_name: name,
      website,
      industry: inferIndustry(tags),
      city: tags['addr:city'] ?? null,
      state: tags['addr:state'] ?? null,
      country: tags['addr:country'] ?? 'US',
      discovery_source: 'openstreetmap',
      discovery_source_url: 'https://www.openstreetmap.org',
      confidence: 0.85,
    });
  }

  return results;
}

export async function discoverFromOpenStreetMap(
  params: DiscoveryParams,
): Promise<ProviderResult> {
  const geo = await geocodeLocation(params.location);
  if (!geo) {
    return failedDiagnostic('openstreetmap', `Could not geocode location: ${params.location}`);
  }

  const limit = Math.min(params.maxResults, 50);
  const query = buildOverpassQuery(
    geo.lat,
    geo.lon,
    Math.min(params.radiusMeters, 25_000),
    params.industry,
    limit,
  );
  const hash = queryHash(query);

  const response = await callOverpass(query);
  if (!response.ok) {
    return failedDiagnostic('openstreetmap', `Overpass API error: ${response.status}`, {
      statusCode: response.status,
      responseSnippet: response.snippet,
      queryHash: hash,
    });
  }

  const results = parseElements(response.data?.elements, limit);
  return succeededDiagnostic('openstreetmap', results, {
    queryHash: hash,
    responseSnippet: `endpoint=${response.endpoint} elements=${response.data?.elements?.length ?? 0}`,
  });
}

export const openStreetMapProvider: DiscoveryProvider = {
  name: 'openstreetmap',
  enabled: true,
  discover: discoverFromOpenStreetMap,
};
