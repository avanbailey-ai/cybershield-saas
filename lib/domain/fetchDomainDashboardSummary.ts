import type { SupabaseClient } from '@supabase/supabase-js';
import { domainHealthFromDays } from './domainStatus';
import type { DomainWebsiteSummary } from './types';

export interface DomainDashboardSummary {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  sites: DomainWebsiteSummary[];
}

export async function fetchDomainDashboardSummary(
  supabase: SupabaseClient,
  websiteIds: string[],
): Promise<DomainDashboardSummary> {
  const empty: DomainDashboardSummary = {
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

  const { data: snapshotRows } = await supabase
    .from('domain_snapshots')
    .select('website_id, domain, registrar, expires_at, days_until_expiry, checked_at')
    .in('website_id', websiteIds)
    .order('checked_at', { ascending: false });

  const latestByWebsite = new Map<
    string,
    {
      domain: string;
      registrar: string | null;
      expires_at: string | null;
      days_until_expiry: number | null;
      checked_at: string;
    }
  >();

  for (const row of snapshotRows ?? []) {
    if (!latestByWebsite.has(row.website_id)) {
      latestByWebsite.set(row.website_id, row);
    }
  }

  const sites: DomainWebsiteSummary[] = websites.map((w) => {
    const snap = latestByWebsite.get(w.id);
    const days = snap?.days_until_expiry ?? null;
    const status = domainHealthFromDays(days);
    return {
      websiteId: w.id,
      url: w.url,
      label: w.label,
      status,
      domain: snap?.domain ?? null,
      daysUntilExpiry: days,
      expiresAt: snap?.expires_at ?? null,
      registrar: snap?.registrar ?? null,
      checkedAt: snap?.checked_at ?? null,
    };
  });

  sites.sort((a, b) => {
    const rank = (s: DomainWebsiteSummary) => {
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
