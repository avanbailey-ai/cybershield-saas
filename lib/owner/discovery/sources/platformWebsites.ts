import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawDiscoveredBusiness } from '../types';
import { normalizeWebsiteUrl, nameFromWebsite } from '../normalize';

/** Real URLs from platform websites table — not fabricated. */
export async function discoverFromPlatformWebsites(
  admin: SupabaseClient,
  limit = 20,
): Promise<RawDiscoveredBusiness[]> {
  const { data: websites } = await admin
    .from('websites')
    .select('url, name, industry')
    .not('url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  const { data: existing } = await admin
    .from('owner_prospects')
    .select('website')
    .is('deleted_at', null);

  const existingHosts = new Set(
    (existing ?? []).map((p) => p.website?.toLowerCase()),
  );

  const results: RawDiscoveredBusiness[] = [];
  const seen = new Set<string>();

  for (const row of websites ?? []) {
    const website = normalizeWebsiteUrl(row.url as string);
    if (!website || seen.has(website) || existingHosts.has(website.toLowerCase())) continue;
    seen.add(website);

    results.push({
      business_name: (row.name as string) || nameFromWebsite(website),
      website,
      industry: (row.industry as string) || 'General',
      city: null,
      state: null,
      country: null,
      discovery_source: 'platform_website',
      discovery_source_url: null,
    });

    if (results.length >= limit) break;
  }

  return results;
}
