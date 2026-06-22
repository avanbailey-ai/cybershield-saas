import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getEffectiveMaxScansPerDay, getUserWithPlan } from '@/lib/billing/planService';
import { getTodayUtc, getUsage } from '@/lib/billing/usageService';
import { PLAN_LIMITS, formatScanFrequency, type Plan } from '@/lib/billing/plans';
import { fetchDomainDashboardSummary } from '@/lib/domain/fetchDomainDashboardSummary';
import { fetchSslDashboardSummary } from '@/lib/ssl/fetchSslDashboardSummary';
import { getWebsitesForUser } from '@/services/supabaseService';
import { formatRelativeScanTime } from '@/lib/websiteHealth/healthCenterCopy';
import {
  buildNeedsAttentionFromWebsites,
  buildOrgHealthSummary,
  buildSecurityWins,
  formatActivityFeed,
  getScoreBand,
  getWebsiteDisplayName,
  monitoringLabelForWebsite,
  prioritizeNeedsAttention,
  resolveAccountStatus,
  scoreToHealthCategory,
  shouldShowRetentionBanner,
  type CommandCenterData,
  type CommandCenterWebsite,
  type NeedsAttentionItem,
  type ValueSummaryMetrics,
} from './dashboardCommandCenter';
import {
  classifyAlertsForDashboard,
  overallStatusLabel,
} from './dashboardAlertClassification';
import {
  buildGroupedActivityFeed,
  buildProtectionStatusSummary,
  buildRecommendedNextStep,
  buildScanComparisonSummary,
  splitBaselineAndMeaningfulChanges,
} from './dashboardActivity';
import { isSupersededByLatestScan } from '@/lib/agency/scanFreshness';

type HeaderChecks = {
  csp?: boolean;
  hsts?: boolean;
  xFrame?: boolean;
  xContentType?: boolean;
  referrerPolicy?: boolean;
  permissionsPolicy?: boolean;
};

function headerCheckPassed(headers: HeaderChecks | null, key: string): boolean {
  if (!headers) return false;
  const map: Record<string, keyof HeaderChecks> = {
    'content-security-policy': 'csp',
    'strict-transport-security': 'hsts',
    'x-frame-options': 'xFrame',
    'x-content-type-options': 'xContentType',
    'referrer-policy': 'referrerPolicy',
    'permissions-policy': 'permissionsPolicy',
  };
  const prop = map[key];
  if (!prop) return false;
  return headers[prop] === true;
}

function userDisplayNameFromEmail(email: string | null | undefined): string {
  if (!email) return 'there';
  const local = email.split('@')[0] ?? 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchChangesWithScansSince(
  supabase: SupabaseClient,
  websiteIds: string[],
  sinceIso: string,
): Promise<Array<{ scan_id: string; type: string; website_id: string }>> {
  if (websiteIds.length === 0) return [];

  const { data } = await supabase
    .from('scan_changes')
    .select('scan_id, type, website_id')
    .in('website_id', websiteIds)
    .gte('detected_at', sinceIso);

  return (data ?? []) as Array<{ scan_id: string; type: string; website_id: string }>;
}

async function fetchFirstCompletedScanIdByWebsite(
  supabase: SupabaseClient,
  websiteIds: string[],
  orgId: string | null,
  userId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (websiteIds.length === 0) return result;

  let query = supabase
    .from('scans')
    .select('id, website_id, completed_at')
    .in('website_id', websiteIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  if (orgId) query = query.eq('org_id', orgId);
  else query = query.eq('user_id', userId);

  const { data: scans } = await query.limit(websiteIds.length * 3);
  for (const scan of scans ?? []) {
    if (!result.has(scan.website_id)) {
      result.set(scan.website_id, scan.id);
    }
  }
  return result;
}

async function fetchLatestTwoScansPerWebsite(
  supabase: SupabaseClient,
  websiteIds: string[],
  orgId: string | null,
  userId: string,
): Promise<
  Map<
    string,
    {
      current: { id: string; score: number | null; completedAt: string | null };
      previous: { id: string; score: number | null } | null;
    }
  >
> {
  const result = new Map<
    string,
    {
      current: { id: string; score: number | null; completedAt: string | null };
      previous: { id: string; score: number | null } | null;
    }
  >();
  if (websiteIds.length === 0) return result;

  let query = supabase
    .from('scans')
    .select('id, website_id, security_score, completed_at')
    .in('website_id', websiteIds)
    .eq('status', 'completed')
    .not('security_score', 'is', null)
    .order('completed_at', { ascending: false });

  if (orgId) query = query.eq('org_id', orgId);
  else query = query.eq('user_id', userId);

  const { data: scans } = await query.limit(websiteIds.length * 4);
  const byWebsite = new Map<string, Array<{ id: string; score: number | null; completedAt: string | null }>>();

  for (const scan of scans ?? []) {
    const list = byWebsite.get(scan.website_id) ?? [];
    if (list.length < 2) {
      list.push({
        id: scan.id,
        score: scan.security_score,
        completedAt: scan.completed_at,
      });
      byWebsite.set(scan.website_id, list);
    }
  }

  for (const [websiteId, list] of byWebsite) {
    result.set(websiteId, {
      current: list[0]!,
      previous: list[1] ?? null,
    });
  }

  return result;
}

async function fetchMeaningfulChangesByWebsite(
  supabase: SupabaseClient,
  websiteIds: string[],
  sinceIso: string,
  orgId: string | null,
  userId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (websiteIds.length === 0) return counts;

  const [changes, firstScanIds] = await Promise.all([
    fetchChangesWithScansSince(supabase, websiteIds, sinceIso),
    fetchFirstCompletedScanIdByWebsite(supabase, websiteIds, orgId, userId),
  ]);

  const websiteIdByScanId = new Map<string, string>();
  for (const change of changes) {
    websiteIdByScanId.set(change.scan_id, change.website_id);
  }

  const split = splitBaselineAndMeaningfulChanges(changes, firstScanIds, websiteIdByScanId);

  for (const change of changes) {
    const firstScanId = firstScanIds.get(change.website_id);
    const isBaseline = firstScanId === change.scan_id;
    if (!isBaseline) {
      counts.set(change.website_id, (counts.get(change.website_id) ?? 0) + 1);
    }
  }

  return counts;
}

async function fetchChangesCountSince(
  supabase: SupabaseClient,
  websiteIds: string[],
  sinceIso: string,
): Promise<number> {
  if (websiteIds.length === 0) return 0;

  const { count } = await supabase
    .from('scan_changes')
    .select('id', { count: 'exact', head: true })
    .in('website_id', websiteIds)
    .gte('detected_at', sinceIso);

  return count ?? 0;
}

async function fetchValueSummary30d(
  supabase: SupabaseClient,
  websiteIds: string[],
  orgId: string | null,
  userId: string,
  sslSummary: Awaited<ReturnType<typeof fetchSslDashboardSummary>>,
  domainSummary: Awaited<ReturnType<typeof fetchDomainDashboardSummary>>,
  sitesAllOnline: number,
  meaningfulChanges: number,
  baselineDataPoints: number,
  lastSuccessfulCheckLabel: string,
): Promise<ValueSummaryMetrics> {
  const since30d = thirtyDaysAgoIso();

  let checksQuery = supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', since30d);

  let failedQuery = supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('completed_at', since30d);

  if (orgId) {
    checksQuery = checksQuery.eq('org_id', orgId);
    failedQuery = failedQuery.eq('org_id', orgId);
  } else {
    checksQuery = checksQuery.eq('user_id', userId);
    failedQuery = failedQuery.eq('user_id', userId);
  }

  const [checksRes, failedRes, totalChanges] = await Promise.all([
    checksQuery,
    failedQuery,
    fetchChangesCountSince(supabase, websiteIds, since30d),
  ]);

  return {
    checksCompleted: checksRes.count ?? 0,
    changesDetected: totalChanges,
    meaningfulChanges,
    baselineDataPoints,
    sslDomainIssues:
      sslSummary.warning + sslSummary.critical + domainSummary.warning + domainSummary.critical,
    sslCertificatesProtected: sslSummary.healthy,
    domainRisksFlagged: domainSummary.warning + domainSummary.critical,
    downtimeEvents: failedRes.count ?? 0,
    sitesAllOnline,
    websitesMonitored: websiteIds.length,
    failedChecks: failedRes.count ?? 0,
    lastSuccessfulCheckLabel,
  };
}

async function fetchMonthlyScoreTrend(
  supabase: SupabaseClient,
  websiteIds: string[],
  orgId: string | null,
  userId: string,
): Promise<number | null> {
  if (websiteIds.length === 0) return null;

  const monthStart = startOfMonthIso();
  let query = supabase
    .from('scans')
    .select('website_id, security_score, completed_at')
    .eq('status', 'completed')
    .not('security_score', 'is', null)
    .gte('completed_at', monthStart)
    .order('completed_at', { ascending: true });

  if (orgId) {
    query = query.eq('org_id', orgId);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data: scans } = await query.limit(500);
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

async function fetchRecentChangesCount(
  supabase: SupabaseClient,
  websiteIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (websiteIds.length === 0) return counts;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from('scan_changes')
    .select('website_id')
    .in('website_id', websiteIds)
    .gte('detected_at', thirtyDaysAgo);

  for (const row of rows ?? []) {
    counts.set(row.website_id, (counts.get(row.website_id) ?? 0) + 1);
  }

  return counts;
}

async function fetchLatestScanIds(
  supabase: SupabaseClient,
  websiteIds: string[],
  orgId: string | null,
  userId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (websiteIds.length === 0) return result;

  let query = supabase
    .from('scans')
    .select('id, website_id, completed_at')
    .in('website_id', websiteIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (orgId) {
    query = query.eq('org_id', orgId);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data: scans } = await query.limit(websiteIds.length * 2);
  for (const scan of scans ?? []) {
    if (!result.has(scan.website_id)) {
      result.set(scan.website_id, scan.id);
    }
  }
  return result;
}

async function fetchAlertsForAttention(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('alerts')
    .select('id, severity, title, message, website_id, is_read, created_at, scan_id, type, websites(url, label)')
    .eq('user_id', userId)
    .eq('is_read', false)
    .in('severity', ['critical', 'high', 'medium', 'low'])
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => {
    const siteRaw = row.websites as unknown;
    const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as {
      url: string;
      label: string | null;
    } | null;
    return {
      id: row.id,
      severity: row.severity,
      title: row.title,
      message: row.message as string | null,
      websiteId: row.website_id as string | null,
      websiteUrl: site?.url ?? null,
      websiteLabel: site?.label ?? null,
      createdAt: row.created_at as string | null,
      scanId: row.scan_id as string | null,
      type: row.type as string | null,
    };
  });
}

function classifiedToNeedsAttention(
  classified: ReturnType<typeof classifyAlertsForDashboard>,
): NeedsAttentionItem[] {
  return classified.map((item) => ({
    id: item.id,
    severity:
      item.priority === 'critical'
        ? 'critical'
        : item.priority === 'high'
          ? 'high'
          : item.priority === 'review'
            ? 'medium'
            : 'low',
    priority: item.priority,
    title: item.title,
    websiteName: item.websiteName,
    whyItMatters: item.message ?? 'Review this item in your report or health center.',
    actionLabel: item.actionLabel,
    actionHref: item.actionHref,
  }));
}

export async function fetchCommandCenterData(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null | undefined,
  orgId: string | null,
): Promise<CommandCenterData> {
  const userWithPlan = await getUserWithPlan(userId, orgId);
  const plan = getEffectivePlan(userWithPlan) as Plan;
  const planLabel = PLAN_LIMITS[plan]?.name ?? 'Free';
  const planMonitoringLabel = formatScanFrequency(PLAN_LIMITS[plan]?.scanFrequency ?? 'manual');
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const planHasPriority =
    'priorityMonitoringSlots' in planLimits && (planLimits.priorityMonitoringSlots ?? 0) > 0;

  const { websites: rawWebsites } = await getWebsitesForUser(supabase, userId, orgId);
  const websiteIds = rawWebsites.map((w) => w.id);

  const since30d = thirtyDaysAgoIso();
  const [sslSummary, domainSummary, latestScanIds, monthlyTrend, alerts, firstScanIds, latestTwoScans, usage, scansLimit] =
    await Promise.all([
      fetchSslDashboardSummary(supabase, websiteIds),
      fetchDomainDashboardSummary(supabase, websiteIds),
      fetchLatestScanIds(supabase, websiteIds, orgId, userId),
      fetchMonthlyScoreTrend(supabase, websiteIds, orgId, userId),
      fetchAlertsForAttention(supabase, userId),
      fetchFirstCompletedScanIdByWebsite(supabase, websiteIds, orgId, userId),
      fetchLatestTwoScansPerWebsite(supabase, websiteIds, orgId, userId),
      getUsage(userId, getTodayUtc()),
      getEffectiveMaxScansPerDay(userId, orgId),
    ]);

  const changesRows = await fetchChangesWithScansSince(supabase, websiteIds, since30d);
  const websiteIdByScanId = new Map(changesRows.map((c) => [c.scan_id, c.website_id]));
  const { meaningful: meaningfulChangesTotal, baseline: baselineDataPointsTotal } =
    splitBaselineAndMeaningfulChanges(changesRows, firstScanIds, websiteIdByScanId);

  const meaningfulByWebsite = await fetchMeaningfulChangesByWebsite(
    supabase,
    websiteIds,
    since30d,
    orgId,
    userId,
  );

  let scansQuery = supabase
    .from('scans')
    .select(
      'id, website_id, security_score, status, completed_at, started_at, headers, websites(url, label)',
    )
    .order('started_at', { ascending: false })
    .limit(50);

  if (orgId) {
    scansQuery = scansQuery.eq('org_id', orgId);
  } else {
    scansQuery = scansQuery.eq('user_id', userId);
  }

  const { data: allScans } = await scansQuery;

  const latestScoreByWebsite = new Map<string, number>();
  for (const scan of allScans ?? []) {
    if (scan.status === 'completed' && scan.security_score !== null && !latestScoreByWebsite.has(scan.website_id)) {
      latestScoreByWebsite.set(scan.website_id, scan.security_score);
    }
  }

  const websites: CommandCenterWebsite[] = rawWebsites.map((w) => {
    const score =
      w.recentScores[0] ??
      latestScoreByWebsite.get(w.id) ??
      (typeof w.latestQueueJob?.result === 'object' &&
      w.latestQueueJob?.result !== null &&
      'score' in (w.latestQueueJob.result as object)
        ? ((w.latestQueueJob.result as { score?: number }).score ?? null)
        : null);

    const lastScanAt = w.last_scanned_at ?? w.latestQueueJob?.completed_at ?? null;
    const lastScanLabel = lastScanAt
      ? formatRelativeScanTime(String(lastScanAt))
      : 'Not scanned yet';

    const meaningfulChangesCount = meaningfulByWebsite.get(w.id) ?? 0;

    return {
      id: w.id,
      displayName: getWebsiteDisplayName(w.label, w.url),
      url: w.url,
      score,
      scoreBand: getScoreBand(score),
      healthCategory: scoreToHealthCategory(score),
      monitoringLabel: monitoringLabelForWebsite(
        w.priority_monitoring,
        planHasPriority,
        planLimits.scanFrequency,
      ),
      lastScanLabel,
      lastScanAt: lastScanAt ? String(lastScanAt) : null,
      meaningfulChangesCount,
      actionCount: 0,
      latestScanId: latestScanIds.get(w.id) ?? null,
    };
  });

  const orgHealth = buildOrgHealthSummary(
    websites.map((w) => ({ score: w.score })),
    monthlyTrend,
  );

  const checksCompleted = (allScans ?? []).filter((s) => s.status === 'completed').length;
  const failedChecks = (allScans ?? []).filter((s) => s.status === 'failed').length;
  const lastSuccessfulScan = (allScans ?? []).find((s) => s.status === 'completed');
  const lastActivityScan = allScans?.[0] ?? null;
  const lastActivityAt = lastActivityScan?.completed_at ?? lastActivityScan?.started_at ?? null;
  const lastSuccessfulCheckLabel = lastSuccessfulScan?.completed_at
    ? formatRelativeScanTime(lastSuccessfulScan.completed_at)
    : 'No successful check yet';

  const valueSummary = await fetchValueSummary30d(
    supabase,
    websiteIds,
    orgId,
    userId,
    sslSummary,
    domainSummary,
    orgHealth.healthy,
    meaningfulChangesTotal,
    baselineDataPointsTotal,
    lastSuccessfulCheckLabel,
  );

  const activeMonitoring = {
    websitesMonitored: websites.length,
    checksCompleted,
    meaningfulChanges: meaningfulChangesTotal,
    baselineDataPoints: baselineDataPointsTotal,
    sslWarnings: sslSummary.warning + sslSummary.critical,
    domainWarnings: domainSummary.warning + domainSummary.critical,
    failedChecks,
    lastActivityLabel: lastActivityAt ? formatRelativeScanTime(lastActivityAt) : 'No activity yet',
    lastActivityAt,
    lastSuccessfulCheckLabel,
    monitoringCadence: planMonitoringLabel,
  };

  const headerKeys = [
    'content-security-policy',
    'strict-transport-security',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
  ];
  let headerPass = 0;
  let headerTotal = 0;
  type ScanRow = NonNullable<typeof allScans>[number];
  const latestPerWebsite = new Map<string, ScanRow>();
  for (const scan of allScans ?? []) {
    if (scan.status === 'completed' && !latestPerWebsite.has(scan.website_id)) {
      latestPerWebsite.set(scan.website_id, scan);
    }
  }
  for (const scan of latestPerWebsite.values()) {
    const headers = scan.headers as HeaderChecks | null;
    for (const key of headerKeys) {
      headerTotal++;
      if (headerCheckPassed(headers, key)) headerPass++;
    }
  }

  const securityWins = buildSecurityWins({
    avgScore: orgHealth.overallScore,
    sslSummary,
    domainSummary,
    criticalAlerts: orgHealth.critical,
    websitesMonitored: websites.length,
    checksCompleted,
    headerPassRate: headerTotal > 0 ? headerPass / headerTotal : null,
  });

  const latestCompletedAtByWebsite = new Map<string, string>();
  for (const scan of allScans ?? []) {
    if (
      scan.status === 'completed' &&
      scan.completed_at &&
      !latestCompletedAtByWebsite.has(scan.website_id)
    ) {
      latestCompletedAtByWebsite.set(scan.website_id, scan.completed_at);
    }
  }

  const filteredAlerts = alerts.filter((alert) => {
    if (!alert.websiteId) return true;
    const site = websites.find((w) => w.id === alert.websiteId);
    return !isSupersededByLatestScan({
      itemCreatedAt: alert.createdAt,
      latestCompletedAt: site?.lastScanAt ?? latestCompletedAtByWebsite.get(alert.websiteId) ?? null,
      latestScore: site?.score ?? latestScoreByWebsite.get(alert.websiteId) ?? null,
    });
  });

  const classifiedAlerts = classifyAlertsForDashboard(
    filteredAlerts,
    websites.map((w) => ({
      id: w.id,
      score: w.score,
      displayName: w.displayName,
      latestScanId: w.latestScanId,
    })),
    getWebsiteDisplayName,
  );

  const alertAttentionItems = classifiedToNeedsAttention(classifiedAlerts);
  const websiteItems = buildNeedsAttentionFromWebsites(websites, sslSummary, domainSummary);

  const seen = new Set<string>();
  const allAttention = [...alertAttentionItems, ...websiteItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const needsAttention = prioritizeNeedsAttention(
    allAttention.filter((item) => item.priority === 'critical' || item.priority === 'high' || item.priority === 'review'),
  ).slice(0, 6);

  const monitoringActivity = prioritizeNeedsAttention(
    allAttention.filter((item) => item.priority === 'info'),
  ).slice(0, 4);

  for (const site of websites) {
    site.actionCount = needsAttention.filter((n) => n.websiteName === site.displayName).length;
  }

  const reviewItemsCount = needsAttention.filter((n) => n.priority === 'review').length;

  const scanComparison = buildScanComparisonSummary({
    websites: websites.map((w) => ({
      id: w.id,
      displayName: w.displayName,
      url: w.url,
      score: w.score,
      latestScanId: w.latestScanId,
    })),
    latestTwoScans,
    meaningfulChangesCount: meaningfulChangesTotal,
    baselineDataPointsCount: baselineDataPointsTotal,
    reviewItemsCount,
  });

  const recommendedNextStep = buildRecommendedNextStep({
    recommendedActions: needsAttention.map((n) => ({
      title: n.title,
      priority: n.priority,
      actionHref: n.actionHref,
    })),
    reviewItemsCount,
    primaryReportHref: scanComparison.reportHref,
    primaryWebsiteId: websites[0]?.id ?? null,
  });

  const groupedActivity = buildGroupedActivityFeed({
    scans: (allScans ?? []).map((s) => {
      const siteRaw = s.websites as unknown;
      const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as {
        url: string;
        label: string | null;
      } | null;
      return {
        id: s.id,
        websiteId: s.website_id,
        websiteLabel: site?.label ?? null,
        websiteUrl: site?.url ?? '',
        securityScore: s.security_score,
        status: s.status,
        completedAt: s.completed_at,
        startedAt: s.started_at,
      };
    }),
    classifiedAlerts: classifiedAlerts.map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      createdAt: a.createdAt,
      priority: a.priority,
      actionHref: a.actionHref,
    })),
    meaningfulChanges: meaningfulChangesTotal,
  });

  const activityFeed = formatActivityFeed({
    scans: (allScans ?? []).slice(0, 8).map((s) => {
      const siteRaw = s.websites as unknown;
      const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as {
        url: string;
        label: string | null;
      } | null;
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
    changesDetected: meaningfulChangesTotal,
  });

  const overallStatus = overallStatusLabel(orgHealth.overallScore);
  const protectionSummary = buildProtectionStatusSummary({
    websites: websites.map((w) => ({
      displayName: w.displayName,
      score: w.score,
      scoreBandLabel: w.scoreBand.label,
    })),
    reviewItemsCount,
    criticalCount: needsAttention.filter((n) => n.priority === 'critical' || n.priority === 'high').length,
    monitoringCadence: planMonitoringLabel,
    lastCheckLabel: lastSuccessfulCheckLabel,
  });

  const websiteLimit = planLimits.websites === Infinity ? null : planLimits.websites;
  const manualScansRemaining =
    scansLimit === Infinity ? null : Math.max(0, scansLimit - usage.scans_used);

  const planUsage = {
    planLabel,
    websitesUsed: websites.length,
    websiteLimit,
    manualScansRemaining,
    manualScansLimit: scansLimit === Infinity ? null : scansLimit,
    isAgency: plan === 'agency',
  };

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const agencyOverview =
    plan === 'agency'
      ? {
          clientReadyReports: websites.filter((w) => w.latestScanId).length,
          sitesNeedingAttention: websites.filter(
            (w) => w.healthCategory === 'critical' || w.healthCategory === 'needs_attention',
          ).length,
          sitesWithoutRecentScans: websites.filter((w) => {
            if (!w.lastScanAt) return true;
            return new Date(w.lastScanAt).getTime() < sevenDaysAgo;
          }).length,
          sitesWithMeaningfulChanges: websites.filter((w) => w.meaningfulChangesCount > 0).length,
        }
      : null;

  const accountStatus = resolveAccountStatus({
    websiteCount: websites.length,
    criticalCount: orgHealth.critical,
    needsAttentionCount: needsAttention.some((n) => n.priority === 'critical' || n.priority === 'high')
      ? orgHealth.needsAttention
      : 0,
  });

  return {
    userDisplayName: userDisplayNameFromEmail(userEmail),
    userEmail: userEmail ?? '',
    planLabel,
    planMonitoringLabel,
    accountStatus,
    overallStatusLabel: overallStatus,
    protectionSummary,
    lastActivityLabel: activeMonitoring.lastActivityLabel,
    lastActivityAt,
    orgHealth,
    websites,
    activeMonitoring,
    valueSummary,
    securityWins,
    needsAttention,
    monitoringActivity,
    recommendedNextStep,
    scanComparison,
    groupedActivity,
    planUsage,
    agencyOverview,
    activityFeed,
    showRetentionBanner: shouldShowRetentionBanner(orgHealth),
    isEmpty: websites.length === 0,
  };
}
