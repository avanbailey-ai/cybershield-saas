import type { DiscoveryParams } from '../provider';
import {
  failedDiagnostic,
  skippedDiagnostic,
  succeededDiagnostic,
  type DiscoveryProvider,
  type ProviderResult,
} from '../provider';
import type { RawDiscoveredBusiness } from '../types';
import { normalizeWebsiteUrl, nameFromWebsite } from '../normalize';

const FETCH_UA =
  'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com';

const BLOCKED_HOSTS = new Set([
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'google.com',
  'maps.google.com',
  'yelp.com',
  'bbb.org',
  'wikipedia.org',
  'openstreetmap.org',
]);

function hostBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  for (const blocked of BLOCKED_HOSTS) {
    if (h.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

/** Extract real external website links from a public directory HTML page. */
export async function discoverFromSeedDirectory(
  params: DiscoveryParams,
): Promise<ProviderResult> {
  const seedUrl = params.seedDirectoryUrl?.trim();
  if (!seedUrl) {
    return skippedDiagnostic('directory_seed', 'No seed directory URL configured');
  }

  let parsedSeed: URL;
  try {
    parsedSeed = new URL(seedUrl);
  } catch {
    return failedDiagnostic('directory_seed', 'Invalid seed directory URL');
  }

  const res = await fetch(seedUrl, {
    headers: { 'User-Agent': FETCH_UA, Accept: 'text/html' },
    redirect: 'follow',
  });

  const html = await res.text();
  const snippet = html.slice(0, 300);
  if (!res.ok) {
    return failedDiagnostic('directory_seed', `Directory fetch error: ${res.status}`, {
      statusCode: res.status,
      responseSnippet: snippet,
    });
  }

  const hrefRe = /href=["'](https?:\/\/[^"'#?\s]+)["']/gi;
  const results: RawDiscoveredBusiness[] = [];
  const seen = new Set<string>();
  const limit = Math.min(params.maxResults, 50);

  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null && results.length < limit) {
    const website = normalizeWebsiteUrl(match[1]);
    if (!website) continue;

    let host: string;
    try {
      host = new URL(website).hostname;
    } catch {
      continue;
    }

    if (hostBlocked(host)) continue;
    if (host === parsedSeed.hostname) continue;
    if (seen.has(website)) continue;
    seen.add(website);

    results.push({
      business_name: nameFromWebsite(website),
      website,
      industry: params.industry || 'General',
      city: null,
      state: null,
      country: 'US',
      discovery_source: 'directory_seed',
      discovery_source_url: seedUrl,
      confidence: 0.6,
    });
  }

  return succeededDiagnostic('directory_seed', results, {
    responseSnippet: `seed=${seedUrl} links_found=${results.length}`,
  });
}

export const directorySeedProvider: DiscoveryProvider = {
  name: 'directory_seed',
  enabled: true,
  discover: discoverFromSeedDirectory,
};
