import { createAdminClient } from '@/lib/supabase/admin';

export type RiskBucket = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type RiskDistribution = Record<RiskBucket, number>;

export interface ClientGroupSummary {
  clientGroup: string;
  siteCount: number;
  riskDistribution: RiskDistribution;
  criticalAlertsCount: number;
}

export interface OrgDashboardSummary {
  orgId: string;
  totalSitesMonitored: number;
  riskDistribution: RiskDistribution;
  criticalAlertsCount: number;
  openAlertsCount: number;
  avgScore: number | null;
  sitesByClientGroup: ClientGroupSummary[];
}

function emptyDistribution(): RiskDistribution {
  return { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
}

export function scoreToRiskBucket(score: number | null | undefined): RiskBucket {
  if (score === null || score === undefined) return 'unknown';
  if (score < 50) return 'critical';
  if (score < 70) return 'high';
  if (score < 90) return 'medium';
  return 'low';
}

export async function getOrgDashboardSummary(orgId: string): Promise<OrgDashboardSummary> {
  const admin = createAdminClient();

  const [websitesRes, alertsRes, criticalAlertsRes] = await Promise.all([
    admin
      .from('websites')
      .select('id, client_group, is_active')
      .eq('org_id', orgId),
    admin
      .from('alerts')
      .select('id, website_id, severity')
      .eq('org_id', orgId)
      .eq('resolved', false),
    admin
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('resolved', false)
      .eq('severity', 'critical'),
  ]);

  if (websitesRes.error) {
    throw new Error(websitesRes.error.message);
  }

  const websites = websitesRes.data ?? [];
  const activeWebsites = websites.filter((w) => w.is_active !== false);
  const websiteIds = activeWebsites.map((w) => w.id);

  const latestScoreByWebsite = new Map<string, number>();
  if (websiteIds.length > 0) {
    const { data: scans, error: scansError } = await admin
      .from('scans')
      .select('website_id, security_score, completed_at')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .in('website_id', websiteIds)
      .order('completed_at', { ascending: false });

    if (scansError) {
      throw new Error(scansError.message);
    }

    for (const scan of scans ?? []) {
      if (!latestScoreByWebsite.has(scan.website_id) && scan.security_score !== null) {
        latestScoreByWebsite.set(scan.website_id, scan.security_score);
      }
    }
  }

  const riskDistribution = emptyDistribution();
  const websiteRisk = new Map<string, RiskBucket>();

  for (const site of activeWebsites) {
    const bucket = scoreToRiskBucket(latestScoreByWebsite.get(site.id) ?? null);
    riskDistribution[bucket]++;
    websiteRisk.set(site.id, bucket);
  }

  const openAlerts = alertsRes.data ?? [];
  const criticalAlertsCount = criticalAlertsRes.count ?? 0;

  const scores = [...latestScoreByWebsite.values()];
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;

  const criticalAlertsByWebsite = new Map<string, number>();
  for (const alert of openAlerts) {
    if (alert.severity === 'critical' && alert.website_id) {
      criticalAlertsByWebsite.set(
        alert.website_id,
        (criticalAlertsByWebsite.get(alert.website_id) ?? 0) + 1,
      );
    }
  }

  const groupMap = new Map<string, typeof activeWebsites>();
  for (const site of activeWebsites) {
    const key = site.client_group?.trim() || 'Unassigned';
    const list = groupMap.get(key) ?? [];
    list.push(site);
    groupMap.set(key, list);
  }

  const sitesByClientGroup = [...groupMap.entries()]
    .map(([clientGroup, sites]) => {
      const dist = emptyDistribution();
      let groupCriticalAlerts = 0;
      for (const site of sites) {
        const bucket = websiteRisk.get(site.id) ?? 'unknown';
        dist[bucket]++;
        groupCriticalAlerts += criticalAlertsByWebsite.get(site.id) ?? 0;
      }
      return {
        clientGroup,
        siteCount: sites.length,
        riskDistribution: dist,
        criticalAlertsCount: groupCriticalAlerts,
      };
    })
    .sort((a, b) => b.siteCount - a.siteCount);

  return {
    orgId,
    totalSitesMonitored: activeWebsites.length,
    riskDistribution,
    criticalAlertsCount,
    openAlertsCount: openAlerts.length,
    avgScore,
    sitesByClientGroup,
  };
}
