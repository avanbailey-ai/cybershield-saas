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

/** Unified risk bucket thresholds — backend + frontend SSOT */
export const RISK_BUCKET_DISPLAY = [
  { key: 'critical' as const, label: 'Critical (<50)', color: 'bg-red-500', text: 'text-red-400' },
  { key: 'high' as const, label: 'High (50–69)', color: 'bg-orange-500', text: 'text-orange-400' },
  { key: 'medium' as const, label: 'Medium (70–89)', color: 'bg-yellow-500', text: 'text-yellow-400' },
  { key: 'low' as const, label: 'Low (90+)', color: 'bg-green-500', text: 'text-green-400' },
  { key: 'unknown' as const, label: 'Not scanned', color: 'bg-gray-500', text: 'text-gray-400' },
];

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

type CompletedScanRow = {
  id: string;
  website_id: string;
  security_score: number | null;
  completed_at: string | null;
  issues: unknown;
  vulnerabilities_count: number | null;
};

/** Latest completed scan per website has open findings (no unresolved field on scans). */
function scanHasOpenFindings(scan: CompletedScanRow): boolean {
  if (Array.isArray(scan.issues) && scan.issues.length > 0) return true;
  return (scan.vulnerabilities_count ?? 0) > 0;
}

export async function getOrgDashboardSummary(orgId: string): Promise<OrgDashboardSummary> {
  const admin = createAdminClient();

  const websitesRes = await admin
    .from('websites')
    .select('id, client_group, is_active')
    .eq('org_id', orgId);

  if (websitesRes.error) {
    throw new Error(websitesRes.error.message);
  }

  const websites = websitesRes.data ?? [];
  const activeWebsites = websites.filter((w) => w.is_active !== false);

  const { data: completedScans, error: scansError } = await admin
    .from('scans')
    .select('id, website_id, security_score, completed_at, issues, vulnerabilities_count')
    .eq('org_id', orgId)
    .eq('status', 'completed');

  if (scansError) {
    throw new Error(scansError.message);
  }

  const scans = (completedScans ?? []) as CompletedScanRow[];
  const scoredScans = scans.filter((s) => s.security_score !== null);
  const excludedNullScore = scans.length - scoredScans.length;

  const avgScore =
    scoredScans.length > 0
      ? Math.round(
          scoredScans.reduce((sum, scan) => sum + (scan.security_score as number), 0) /
            scoredScans.length,
        )
      : null;

  const criticalAlertsCount = scoredScans.filter((s) => (s.security_score as number) < 50).length;

  const latestScanByWebsite = new Map<string, CompletedScanRow>();
  for (const scan of [...scans].sort(
    (a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime(),
  )) {
    if (!latestScanByWebsite.has(scan.website_id)) {
      latestScanByWebsite.set(scan.website_id, scan);
    }
  }

  let openAlertsCount = 0;
  for (const scan of latestScanByWebsite.values()) {
    if (scanHasOpenFindings(scan)) {
      openAlertsCount++;
    }
  }

  const riskDistribution = emptyDistribution();
  const websiteRisk = new Map<string, RiskBucket>();

  for (const site of activeWebsites) {
    const latest = latestScanByWebsite.get(site.id);
    const bucket = scoreToRiskBucket(latest?.security_score ?? null);
    riskDistribution[bucket]++;
    websiteRisk.set(site.id, bucket);
  }

  const websiteToGroup = new Map<string, string>();
  for (const site of activeWebsites) {
    websiteToGroup.set(site.id, site.client_group?.trim() || 'Unassigned');
  }

  const groupMap = new Map<string, typeof activeWebsites>();
  for (const site of activeWebsites) {
    const key = site.client_group?.trim() || 'Unassigned';
    const list = groupMap.get(key) ?? [];
    list.push(site);
    groupMap.set(key, list);
  }

  const scoreDistributionBreakdown = emptyDistribution();
  for (const scan of scoredScans) {
    scoreDistributionBreakdown[scoreToRiskBucket(scan.security_score)]++;
  }

  console.log('[orgDashboardSummary]', {
    orgId,
    totalCompletedScans: scans.length,
    excludedNullScore,
    scoredScans: scoredScans.length,
    scoreDistributionBreakdown,
    criticalAlertsCount,
    openAlertsCount,
    avgScore,
    latestPerWebsite: latestScanByWebsite.size,
  });

  const sitesByClientGroup = [...groupMap.entries()]
    .map(([clientGroup, sites]) => {
      const dist = emptyDistribution();
      let groupCriticalAlerts = 0;
      const siteIds = new Set(sites.map((s) => s.id));

      for (const site of sites) {
        const bucket = websiteRisk.get(site.id) ?? 'unknown';
        dist[bucket]++;
      }

      for (const scan of scoredScans) {
        if (siteIds.has(scan.website_id) && (scan.security_score as number) < 50) {
          groupCriticalAlerts++;
        }
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
    openAlertsCount,
    avgScore,
    sitesByClientGroup,
  };
}
