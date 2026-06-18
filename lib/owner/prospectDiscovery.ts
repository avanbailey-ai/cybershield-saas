export interface DiscoveredProspect {
  business_name: string;
  website: string;
  industry: string;
  city: string | null;
  state: string | null;
  country: string | null;
}

function normalizeWebsite(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function nameFromUrl(url: string): string {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

export function parseUrlBatch(text: string, industry?: string): DiscoveredProspect[] {
  const lines = text
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: DiscoveredProspect[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    let website = line;
    let business_name = nameFromUrl(line);
    let rowIndustry = industry ?? 'General';
    let city: string | null = null;
    let state: string | null = null;
    let country: string | null = null;

    if (line.includes('|')) {
      const parts = line.split('|').map((s) => s.trim());
      if (parts.length >= 2) {
        business_name = parts[0];
        website = parts[1];
      }
      if (parts.length >= 3 && parts[2]) rowIndustry = parts[2];
      if (parts.length >= 4 && parts[3]) city = parts[3];
      if (parts.length >= 5 && parts[4]) state = parts[4];
      if (parts.length >= 6 && parts[5]) country = parts[5];
    }

    website = normalizeWebsite(website);
    if (!website || seen.has(website)) continue;
    seen.add(website);

    results.push({
      business_name: business_name || nameFromUrl(website),
      website,
      industry: rowIndustry,
      city,
      state,
      country,
    });
  }

  return results;
}

/** Parse CSV with header row: website/url, name/business, industry, city, state, country */
export function parseCsvImport(text: string, defaultIndustry?: string): DiscoveredProspect[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const first = lines[0].toLowerCase();
  const looksLikeHeader =
    first.includes('website') ||
    first.includes('url') ||
    first.includes('domain') ||
    first.includes('business');

  if (!looksLikeHeader) {
    return parseUrlBatch(text, defaultIndustry);
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));

  const websiteIdx = idx(['website', 'url', 'domain']);
  const nameIdx = idx(['name', 'business', 'business_name', 'company']);
  const industryIdx = idx(['industry', 'vertical', 'sector']);
  const cityIdx = idx(['city']);
  const stateIdx = idx(['state', 'region']);
  const countryIdx = idx(['country']);

  if (websiteIdx < 0) {
    return parseUrlBatch(lines.slice(1).join('\n'), defaultIndustry);
  }

  const results: DiscoveredProspect[] = [];
  const seen = new Set<string>();

  for (const line of lines.slice(1)) {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const website = normalizeWebsite(cols[websiteIdx] ?? '');
    if (!website || seen.has(website)) continue;
    seen.add(website);

    results.push({
      business_name:
        (nameIdx >= 0 ? cols[nameIdx] : '') || nameFromUrl(website),
      website,
      industry:
        (industryIdx >= 0 ? cols[industryIdx] : '') || defaultIndustry || 'General',
      city: cityIdx >= 0 ? cols[cityIdx] || null : null,
      state: stateIdx >= 0 ? cols[stateIdx] || null : null,
      country: countryIdx >= 0 ? cols[countryIdx] || null : null,
    });
  }

  return results;
}
