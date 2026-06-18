import type { RawDiscoveredBusiness } from '../types';
import { normalizeWebsiteUrl, nameFromWebsite } from '../normalize';

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
  ecommerce: 'E-commerce',
  it: 'Technology',
  software: 'Technology',
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

/** Discover real businesses with public websites via OpenStreetMap Overpass API. */
export async function discoverFromOpenStreetMap(options?: {
  south?: number;
  west?: number;
  north?: number;
  east?: number;
  limit?: number;
}): Promise<RawDiscoveredBusiness[]> {
  const south = options?.south ?? 30.0;
  const west = options?.west ?? -97.9;
  const north = options?.north ?? 30.5;
  const east = options?.east ?? -97.5;
  const limit = Math.min(options?.limit ?? 30, 50);

  const query = `
    [out:json][timeout:25];
    (
      node["website"](${south},${west},${north},${east});
      way["website"](${south},${west},${north},${east});
    );
    out center ${limit};
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    elements?: Array<{
      tags?: Record<string, string>;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    }>;
  };

  const results: RawDiscoveredBusiness[] = [];
  const seen = new Set<string>();

  for (const el of data.elements ?? []) {
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
    });
  }

  return results;
}
