import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import { PLAN_LIMITS, formatScanFrequency, type Plan } from '@/lib/billing/plans';
import { fetchDomainDashboardSummary } from '@/lib/domain/fetchDomainDashboardSummary';
import { fetchSslDashboardSummary } from '@/lib/ssl/fetchSslDashboardSummary';
import { getWebsitesForUser } from '@/services/supabaseService';
import { formatRelativeScanTime } from '@/lib/websiteHealth/healthCenterCopy';
import {
  buildNeedsAttentionFromAlerts,
  buildNeedsAttentionFromWebsites,
  buildOrgHealthSummary,
  buildSecurityWins,
  formatActivityFeed,
  getScoreBand,
  getWebsiteDisplayName,
  monitoringLabelForWebsite,
  resolveAccountStatus,
  scoreToHealthCategory,
  shouldShowRetentionBanner,
  type CommandCenterData,
  type CommandCenterWebsite,
} from './dashboardCommandCenter';

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
    .select('id, severity, title, message, website_id, is_read, websites(url, label)')
    .eq('user_id', userId)
    .eq('is_read', false)
    .in('severity', ['critical', 'high', 'medium'])
    .order('created_at', { ascending: false })
    .limit(10);

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
    };
  });
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

  const [sslSummary, domainSummary, changesByWebsite, latestScanIds, monthlyTrend, alerts] =
    await Promise.all([
      fetchSslDashboardSummary(supabase, websiteIds),
      fetchDomainDashboardSummary(supabase, websiteIds),
      fetchRecentChangesCount(supabase, websiteIds),
      fetchLatestScanIds(supabase, websiteIds, orgId, userId),
      fetchMonthlyScoreTrend(supabase, websiteIds, orgId, userId),
      fetchAlertsForAttention(supabase, userId),
    ]);

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

    return {
      id: w.id,
      displayName: getWebsiteDisplayName(w.label, w.url),
      url: w.url,
      score,
      scoreBand: getScoreBand(score),
      healthCategory: scoreToHealthCategory(score),
      monitoringLabel: monitoringLabelForWebsite(w.priority_monitoring, planHasPriority),
      lastScanLabel,
      lastScanAt: lastScanAt ? String(lastScanAt) : null,
      recentChangesCount: changesByWebsite.get(w.id) ?? 0,
      latestScanId: latestScanIds.get(w.id) ?? null,
    };
  });

  const orgHealth = buildOrgHealthSummary(
    websites.map((w) => ({ score: w.score })),
    monthlyTrend,
  );

  const checksCompleted = (allScans ?? []).filter((s) => s.status === 'completed').length;
  const totalChanges = [...changesByWebsite.values()].reduce((a, b) => a + b, 0);
  const lastActivityScan = allScans?.[0] ?? null;
  const lastActivityAt = lastActivityScan?.completed_at ?? lastActivityScan?.started_at ?? null;

  const activeMonitoring = {
    websitesMonitored: websites.length,
    checksCompleted,
    changesDetected: totalChanges,
    sslWarnings: sslSummary.warning + sslSummary.critical,
    domainWarnings: domainSummary.warning + domainSummary.critical,
    lastActivityLabel: lastActivityAt ? formatRelativeScanTime(lastActivityAt) : 'No activity yet',
    lastActivityAt,
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

  const alertItems = buildNeedsAttentionFromAlerts(alerts);
  const websiteItems = buildNeedsAttentionFromWebsites(websites, sslSummary, domainSummary);
  const seen = new Set<string>();
  const needsAttention = [...alertItems, ...websiteItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 8);

  const activityFeed = formatActivityFeed({
    scans: (allScans ?? []).map((s) => {
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
    changesDetected: totalChanges,
  });

  const accountStatus = resolveAccountStatus({
    websiteCount: websites.length,
    criticalCount: orgHealth.critical,
    needsAttentionCount: orgHealth.needsAttention,
  });

  return {
    userDisplayName: userDisplayNameFromEmail(userEmail),
    userEmail: userEmail ?? '',
    planLabel,
    planMonitoringLabel,
    accountStatus,
    lastActivityLabel: activeMonitoring.lastActivityLabel,
    lastActivityAt,
    orgHealth,
    websites,
    activeMonitoring,
    securityWins,
    needsAttention,
    activityFeed,
    showRetentionBanner: shouldShowRetentionBanner(orgHealth),
    isEmpty: websites.length === 0,
  };
}
