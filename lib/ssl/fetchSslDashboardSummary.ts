import type { SupabaseClient } from '@supabase/supabase-js';
import { sslHealthFromDays } from './sslStatus';
import type { SslWebsiteSummary } from './types';

export interface SslDashboardSummary {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  sites: SslWebsiteSummary[];
}

export async function fetchSslDashboardSummary(
  supabase: SupabaseClient,
  websiteIds: string[],
): Promise<SslDashboardSummary> {
  const empty: SslDashboardSummary = {
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
    sites: [],
  };

  if (websiteIds.length === 0) return empty;

  const { data: websites } = await supabase
    .from('websites')
    .select('id, url, label')
    .in('id', websiteIds);

  if (!websites?.length) return empty;

  const { data: certRows } = await supabase
    .from('ssl_certificates')
    .select('website_id, issuer, expires_at, days_until_expiry, checked_at')
    .in('website_id', websiteIds)
    .order('checked_at', { ascending: false });

  const latestByWebsite = new Map<
    string,
    {
      issuer: string | null;
      expires_at: string;
      days_until_expiry: number;
      checked_at: string;
    }
  >();

  for (const row of certRows ?? []) {
    if (!latestByWebsite.has(row.website_id)) {
      latestByWebsite.set(row.website_id, row);
    }
  }

  const sites: SslWebsiteSummary[] = websites.map((w) => {
    const cert = latestByWebsite.get(w.id);
    const days = cert?.days_until_expiry ?? null;
    const status = sslHealthFromDays(days);
    return {
      websiteId: w.id,
      url: w.url,
      label: w.label,
      status,
      daysUntilExpiry: days,
      expiresAt: cert?.expires_at ?? null,
      issuer: cert?.issuer ?? null,
      checkedAt: cert?.checked_at ?? null,
    };
  });

  sites.sort((a, b) => {
    const rank = (s: SslWebsiteSummary) => {
      if (s.status === 'critical') return 0;
      if (s.status === 'warning') return 1;
      if (s.status === 'unknown') return 2;
      return 3;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999);
  });

  return {
    healthy: sites.filter((s) => s.status === 'healthy').length,
    warning: sites.filter((s) => s.status === 'warning').length,
    critical: sites.filter((s) => s.status === 'critical').length,
    unknown: sites.filter((s) => s.status === 'unknown').length,
    sites,
  };
}
