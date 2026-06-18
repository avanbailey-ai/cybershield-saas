import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalOrgSecurityState } from './canonicalOrgSecurityState';
import { fetchDomainDashboardSummary } from '@/lib/domain/fetchDomainDashboardSummary';
import { fetchSslDashboardSummary } from '@/lib/ssl/fetchSslDashboardSummary';
import { extractTopRiskDrivers, groupIntelligenceSignals, splitAlertsByPriority } from './enterpriseOverviewHelpers';
import {
  buildEnterpriseActivityFeed,
  buildEnterpriseOrgSummary,
  buildEnterpriseWebsiteRows,
  buildNeedsAttentionClients,
  buildOrgInsights,
  buildProtectedWebsites,
  getScoreBand,
  type AdvancedMonitoringDiagnostics,
  type EnterpriseCommandCenterData,
  type EnterpriseValueMetrics,
  type EnterpriseWeekStats,
} from './enterpriseCommandCenter';

function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function fetchChangesByWebsite(
  admin: SupabaseClient,
  websiteIds: string[],
  sinceIso: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (websiteIds.length === 0) return counts;

  const { data: rows } = await admin
    .from('scan_changes')
    .select('website_id')
    .in('website_id', websiteIds)
    .gte('detected_at', sinceIso);

  for (const row of rows ?? []) {
    counts.set(row.website_id, (counts.get(row.website_id) ?? 0) + 1);
  }
  return counts;
}

async function fetchMonthlyScoreTrend(
  admin: SupabaseClient,
  orgId: string,
): Promise<number | null> {
  const { data: scans } = await admin
    .from('scans')
    .select('website_id, security_score, completed_at')
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .not('security_score', 'is', null)
    .gte('completed_at', startOfMonthIso())
    .order('completed_at', { ascending: true })
    .limit(500);

  if (!scans?.length) return null;

  const firstByWebsite = new Map<string, number>();
  const latestByWebsite = new Map<string, number>();

  for (const scan of scans) {
    if (scan.security_score === null) continue;
    if (!firstByWebsite.has(scan.website_id)) {
      firstByWebsite.set(scan.website_id, scan.security_score);
    }
    latestByWebsite.set(scan.website_id, scan.security_score);
  }

  let totalDelta = 0;
  let count = 0;
  for (const [websiteId, latest] of latestByWebsite) {
    const first = firstByWebsite.get(websiteId);
    if (first !== undefined) {
      totalDelta += latest - first;
      count++;
    }
  }

  return count > 0 ? Math.round(totalDelta / count) : null;
}

async function fetchWeekStats(admin: SupabaseClient, orgId: string): Promise<EnterpriseWeekStats> {
  const sinceWeek = startOfWeekIso();
  const since7d = sevenDaysAgoIso();

  const [checksRes, issuesRes, failedRes, sslRes] = await Promise.all([
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .gte('completed_at', sinceWeek),
    admin
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('resolved', false)
      .gte('created_at', since7d),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'failed')
      .gte('completed_at', since7d),
    admin
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('resolved', false)
      .in('severity', ['critical', 'high'])
      .ilike('title', '%ssl%'),
  ]);

  return {
    checksCompleted: checksRes.count ?? 0,
    issuesDetected: issuesRes.count ?? 0,
    outages: failedRes.count ?? 0,
    sslIssues: sslRes.count ?? 0,
  };
}

async function fetchValueMetrics(
  admin: SupabaseClient,
  orgId: string,
  websiteIds: string[],
  sslSummary: Awaited<ReturnType<typeof fetchSslDashboardSummary>>,
  domainSummary: Awaited<ReturnType<typeof fetchDomainDashboardSummary>>,
  websitesHealthy: number,
): Promise<EnterpriseValueMetrics> {
  const since7d = sevenDaysAgoIso();

  const [checksRes, changesMap, failedRes] = await Promise.all([
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .gte('completed_at', since7d),
    fetchChangesByWebsite(admin, websiteIds, since7d),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'failed')
      .gte('completed_at', since7d),
  ]);

  const changesDetected = [...changesMap.values()].reduce((a, b) => a + b, 0);
  const sslDomainIssues =
    sslSummary.warning +
    sslSummary.critical +
    domainSummary.warning +
    domainSummary.critical;

  return {
    checksCompleted: checksRes.count ?? 0,
    changesDetected,
    sslDomainIssues,
    downtimeEvents: failedRes.count ?? 0,
    sitesAllOnline: websitesHealthy,
    websitesMonitored: websiteIds.length,
  };
}

export async function fetchEnterpriseCommandCenterData(input: {
  admin: SupabaseClient;
  orgId: string | null;
  userEmail: string | null | undefined;
  orgName: string | null;
  planLabel: string;
  isAdmin: boolean;
  prioritySlotsUsed: number | null;
  prioritySlotsLimit: number | null;
}): Promise<EnterpriseCommandCenterData> {
  const empty: EnterpriseCommandCenterData = {
    userEmail: input.userEmail ?? 'User',
    orgName: input.orgName,
    orgId: input.orgId,
    planLabel: input.planLabel,
    isAdmin: input.isAdmin,
    isEmpty: true,
    orgSummary: {
      overallScore: null,
      overallBand: getScoreBand(null),
      orgStatus: 'Setup required',
      orgStatusLabel: 'Setup required',
      websitesProtected: 0,
      needsAttentionCount: 0,
      criticalCount: 0,
      weekStats: { checksCompleted: 0, issuesDetected: 0, outages: 0, sslIssues: 0 },
      summaryLine: 'Add client websites to start continuous protection and reporting.',
    },
    valueMetrics: {
      checksCompleted: 0,
      changesDetected: 0,
      sslDomainIssues: 0,
      downtimeEvents: 0,
      sitesAllOnline: 0,
      websitesMonitored: 0,
    },
    needsAttention: [],
    protectedWebsites: [],
    activityFeed: [],
    insights: [],
    advancedDiagnostics: {
      lastCronAt: null,
      scansLast24h: 0,
      failedLast24h: 0,
      queuedScans: 0,
      intelligenceSignalCount: 0,
      prioritySlotsUsed: input.prioritySlotsUsed,
      prioritySlotsLimit: input.prioritySlotsLimit,
    },
  };

  if (!input.orgId) return empty;

  const orgId = input.orgId;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = sevenDaysAgoIso();

  const [canonical, alertsRes, cronRes, scans24hRes, failed24hRes, queueRes, weekStats] =
    await Promise.all([
      getCanonicalOrgSecurityState(orgId),
      input.admin
        .from('alerts')
        .select('id, title, message, severity, website_id, created_at, websites(url, label)')
        .eq('org_id', orgId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50),
      input.admin
        .from('cron_monitoring_runs')
        .select('started_at')
        .order('started_at', { ascending: false })
        .limit(1),
      input.admin
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'completed')
        .gte('completed_at', since24h),
      input.admin
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'failed')
        .gte('completed_at', since24h),
      input.admin
        .from('scan_queue')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['pending', 'processing']),
      fetchWeekStats(input.admin, orgId),
    ]);

  const websiteIds = canonical.latest_scans.map((s) => s.website_id);
  const clientGroupByWebsite = new Map<string, string>();

  const { data: websiteRows } = await input.admin
    .from('websites')
    .select('id, client_group')
    .eq('org_id', orgId);

  for (const row of websiteRows ?? []) {
    clientGroupByWebsite.set(row.id, row.client_group?.trim() || 'Unassigned');
  }

  const [sslSummary, domainSummary, changesByWebsite, monthlyTrend, recentScansRes] =
    await Promise.all([
      fetchSslDashboardSummary(input.admin, websiteIds),
      fetchDomainDashboardSummary(input.admin, websiteIds),
      fetchChangesByWebsite(input.admin, websiteIds, since7d),
      fetchMonthlyScoreTrend(input.admin, orgId),
      input.admin
        .from('scans')
        .select(
          'id, website_id, security_score, status, completed_at, started_at, websites(url, label)',
        )
        .eq('org_id', orgId)
        .order('started_at', { ascending: false })
        .limit(40),
    ]);

  const issuesByWebsite = new Map<string, string[]>();
  for (const result of canonical.scan_results) {
    issuesByWebsite.set(result.website_id, result.issues);
  }

  const scanInputs = canonical.latest_scans.map((scan) => {
    const siteRaw = recentScansRes.data?.find((s) => s.website_id === scan.website_id)?.websites;
    const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as
      | { url: string; label: string | null }
      | null
      | undefined;

    return {
      websiteId: scan.website_id,
      url: scan.website_url ?? site?.url ?? '',
      label: scan.website_label ?? site?.label ?? null,
      clientGroup: clientGroupByWebsite.get(scan.website_id) ?? 'Unassigned',
      score: scan.security_score,
      scanId: scan.scan_id,
      completedAt: scan.completed_at,
      issues: issuesByWebsite.get(scan.website_id) ?? [],
    };
  });

  const websites = buildEnterpriseWebsiteRows({
    scans: scanInputs,
    sslSummary,
    domainSummary,
    changesByWebsite,
    monitoringLabel: 'Monitoring Active',
  });

  let needsAttentionCount = 0;
  let criticalCount = 0;
  for (const site of websites) {
    if (site.healthCategory === 'needs_attention') needsAttentionCount++;
    if (site.healthCategory === 'critical') criticalCount++;
  }

  const orgSummary = buildEnterpriseOrgSummary({
    websites,
    rollingScore: canonical.rollingRiskScore,
    criticalCount,
    needsAttentionCount,
    weekStats,
    orgName: input.orgName,
  });

  const valueMetrics = await fetchValueMetrics(
    input.admin,
    orgId,
    websiteIds,
    sslSummary,
    domainSummary,
    orgSummary.websitesProtected,
  );

  const orgAlerts = (alertsRes.data ?? []).map((row) => {
    const site = Array.isArray(row.websites) ? row.websites[0] : row.websites;
    const url = site?.url ?? 'Unknown site';
    let domain = url;
    try {
      domain = new URL(url).hostname;
    } catch {
      /* keep url */
    }
    return {
      id: row.id,
      title: row.title,
      message: row.message as string,
      severity: row.severity ?? 'medium',
      websiteId: row.website_id as string | null,
      siteLabel: site?.label ?? domain,
      createdAt: row.created_at,
    };
  });

  const { urgent: urgentAlerts } = splitAlertsByPriority(orgAlerts);

  const intelligenceGrouped = groupIntelligenceSignals(canonical.org_anomalies);
  const topDrivers = extractTopRiskDrivers(canonical.scan_results.map((s) => s.issues));

  const activityFeed = buildEnterpriseActivityFeed({
    scans: (recentScansRes.data ?? []).map((s) => {
      const siteRaw = s.websites as unknown;
      const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as
        | { url: string; label: string | null }
        | null;
      return {
        id: s.id,
        websiteLabel: site?.label ?? null,
        websiteUrl: site?.url ?? '',
        securityScore: s.security_score,
        status: s.status,
        completedAt: s.completed_at,
        startedAt: s.started_at,
      };
    }),
    changesDetected: valueMetrics.changesDetected,
    alerts: urgentAlerts.map((a) => ({
      id: a.id,
      title: a.title,
      siteLabel: a.siteLabel,
      severity: a.severity,
      createdAt: a.createdAt,
    })),
  });

  const advancedDiagnostics: AdvancedMonitoringDiagnostics = {
    lastCronAt: cronRes.data?.[0]?.started_at ?? null,
    scansLast24h: scans24hRes.count ?? 0,
    failedLast24h: failed24hRes.count ?? 0,
    queuedScans: queueRes.count ?? 0,
    intelligenceSignalCount: intelligenceGrouped.total,
    prioritySlotsUsed: input.prioritySlotsUsed,
    prioritySlotsLimit: input.prioritySlotsLimit,
  };

  return {
    userEmail: input.userEmail ?? 'User',
    orgName: input.orgName,
    orgId,
    planLabel: input.planLabel,
    isAdmin: input.isAdmin,
    isEmpty: websites.length === 0,
    orgSummary,
    valueMetrics,
    needsAttention: buildNeedsAttentionClients(websites),
    protectedWebsites: buildProtectedWebsites(websites),
    activityFeed,
    insights: buildOrgInsights({
      websites,
      topIssueCategories: topDrivers,
      monthlyTrend,
      postureState: canonical.postureState,
    }),
    advancedDiagnostics,
  };
}
