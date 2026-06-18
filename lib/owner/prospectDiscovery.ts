export interface DiscoverySearch {
  industry: string;
  city?: string;
  state?: string;
  country?: string;
  limit?: number;
}

export interface DiscoveredProspect {
  business_name: string;
  website: string;
  industry: string;
  city: string | null;
  state: string | null;
  country: string | null;
}

const INDUSTRY_TEMPLATES: Record<string, { prefixes: string[]; suffixes: string[]; tlds: string[] }> = {
  healthcare: {
    prefixes: ['Summit', 'Valley', 'Premier', 'Community', 'Regional'],
    suffixes: ['Medical Group', 'Health Center', 'Family Practice', 'Dental', 'Urgent Care'],
    tlds: ['com', 'org'],
  },
  legal: {
    prefixes: ['Smith &', 'Johnson', 'Baker', 'Coastal', 'Metro'],
    suffixes: ['Law Firm', 'Attorneys', 'Legal Group', 'Law Office', 'Counsel'],
    tlds: ['com'],
  },
  ecommerce: {
    prefixes: ['Urban', 'Prime', 'Nova', 'Swift', 'Blue'],
    suffixes: ['Shop', 'Goods', 'Market', 'Supply Co', 'Boutique'],
    tlds: ['com', 'shop'],
  },
  restaurant: {
    prefixes: ['Golden', 'Harbor', 'Fire', 'Garden', 'Coastal'],
    suffixes: ['Grill', 'Kitchen', 'Bistro', 'Cafe', 'Eatery'],
    tlds: ['com'],
  },
  agency: {
    prefixes: ['Pixel', 'Bright', 'North', 'Spark', 'Digital'],
    suffixes: ['Marketing', 'Creative', 'Media', 'Design Studio', 'Agency'],
    tlds: ['com', 'io'],
  },
  finance: {
    prefixes: ['First', 'Liberty', 'Pacific', 'Heritage', 'Capital'],
    suffixes: ['Advisors', 'Wealth', 'Financial', 'Accounting', 'CPA'],
    tlds: ['com'],
  },
  default: {
    prefixes: ['Main Street', 'City', 'Local', 'Premier', 'Trusted'],
    suffixes: ['Services', 'Solutions', 'Group', 'Co', 'Partners'],
    tlds: ['com'],
  },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function generateProspectList(search: DiscoverySearch): DiscoveredProspect[] {
  const industryKey = search.industry.toLowerCase().trim();
  const template =
    INDUSTRY_TEMPLATES[industryKey] ??
    Object.entries(INDUSTRY_TEMPLATES).find(([k]) => industryKey.includes(k))?.[1] ??
    INDUSTRY_TEMPLATES.default;

  const limit = Math.min(search.limit ?? 8, 15);
  const city = search.city?.trim() || null;
  const state = search.state?.trim() || null;
  const country = search.country?.trim() || 'US';
  const results: DiscoveredProspect[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < limit * 2 && results.length < limit; i++) {
    const prefix = pick(template.prefixes, i);
    const suffix = pick(template.suffixes, i + 3);
    const name = city ? `${prefix} ${city} ${suffix}` : `${prefix} ${suffix}`;
    const domain = `${slugify(prefix)}${slugify(suffix)}${city ? slugify(city) : ''}${i}.example-${industryKey.slice(0, 6) || 'biz'}.${pick(template.tlds, i)}`;

    if (seen.has(domain)) continue;
    seen.add(domain);

    results.push({
      business_name: name,
      website: domain,
      industry: search.industry,
      city,
      state,
      country,
    });
  }

  return results;
}

export function parseUrlBatch(text: string, industry?: string): DiscoveredProspect[] {
  const lines = text
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line) => {
    let website = line;
    let business_name = line.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (line.includes('|')) {
      const [name, url] = line.split('|').map((s) => s.trim());
      business_name = name;
      website = url;
    }
    return {
      business_name,
      website,
      industry: industry ?? 'General',
      city: null,
      state: null,
      country: null,
    };
  });
}
