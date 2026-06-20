import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { computeRollingRiskScore } from './rollingRiskScore';
import { scoreToPostureState } from './postureState';
import { generateOrgSecurityNarrative } from './orgNarrative';
import {
  diffScanFindings,
  normalizeIssues,
  type ScanFindingRow,
} from './scanDiff';
import {
  emptyRiskDistribution,
  scoreToRiskBucket,
  type CanonicalDashboardAggregates,
  type CanonicalLatestScan,
  type CanonicalOrgSecurityState,
  type CanonicalScanDiffEntry,
  type CanonicalScanResult,
  type OrgAnomalyFeedItem,
} from './enterpriseTypes';

const CACHE_TTL_MS = 30_000;

type CacheEntry = { state: CanonicalOrgSecurityState; expires: number };
const stateCache = new Map<string, CacheEntry>();

type CompletedScanRow = ScanFindingRow & {
  vulnerabilities_count: number | null;
  websites?: { url: string; label: string | null } | { url: string; label: string | null }[] | null;
};

type WebsiteRow = {
  id: string;
  client_group: string | null;
  is_active: boolean | null;
};

function scanHasOpenFindings(scan: CompletedScanRow): boolean {
  if (Array.isArray(scan.issues) && scan.issues.length > 0) return true;
  return (scan.vulnerabilities_count ?? 0) > 0;
}

function extractWebsiteMeta(
  websites: CompletedScanRow['websites'],
): { url: string | null; label: string | null } {
  const row = Array.isArray(websites) ? websites[0] : websites;
  return { url: row?.url ?? null, label: row?.label ?? null };
}

function buildDashboardAggregates(
  activeWebsites: WebsiteRow[],
  latestScanByWebsite: Map<string, CompletedScanRow>,
  scoredScans: CompletedScanRow[],
): CanonicalDashboardAggregates {
  const riskDistribution = emptyRiskDistribution();
  const websiteRisk = new Map<string, ReturnType<typeof scoreToRiskBucket>>();

  for (const site of activeWebsites) {
    const latest = latestScanByWebsite.get(site.id);
    const bucket = scoreToRiskBucket(latest?.security_score ?? null);
    riskDistribution[bucket]++;
    websiteRisk.set(site.id, bucket);
  }

  let criticalAlertsCount = 0;
  let openAlertsCount = 0;
  const latestScored: CompletedScanRow[] = [];

  for (const scan of latestScanByWebsite.values()) {
    if (scan.security_score !== null) {
      latestScored.push(scan);
      if ((scan.security_score as number) < 50) criticalAlertsCount++;
    }
    if (scanHasOpenFindings(scan)) openAlertsCount++;
  }

  const avgScore =
    latestScored.length > 0
      ? Math.round(
          latestScored.reduce((sum, scan) => sum + (scan.security_score as number), 0) /
            latestScored.length,
        )
      : null;

  const groupMap = new Map<string, WebsiteRow[]>();
  for (const site of activeWebsites) {
    const key = site.client_group?.trim() || 'Unassigned';
    const list = groupMap.get(key) ?? [];
    list.push(site);
    groupMap.set(key, list);
  }

  const sitesByClientGroup = [...groupMap.entries()]
    .map(([clientGroup, sites]) => {
      const dist = emptyRiskDistribution();
      let groupCriticalAlerts = 0;

      for (const site of sites) {
        const bucket = websiteRisk.get(site.id) ?? 'unknown';
        dist[bucket]++;
      }

      for (const site of sites) {
        const latest = latestScanByWebsite.get(site.id);
        if (
          latest &&
          latest.security_score !== null &&
          (latest.security_score as number) < 50
        ) {
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
    totalSitesMonitored: activeWebsites.length,
    riskDistribution,
    criticalAlertsCount,
    openAlertsCount,
    avgScore,
    sitesByClientGroup,
  };
}

function buildScanDiffs(scans: CompletedScanRow[]): CanonicalScanDiffEntry[] {
  const scansByWebsite = new Map<string, CompletedScanRow[]>();
  for (const scan of [...scans].sort(
    (a, b) => new Date(a.completed_at ?? 0).getTime() - new Date(b.completed_at ?? 0).getTime(),
  )) {
    const list = scansByWebsite.get(scan.website_id) ?? [];
    list.push(scan);
    scansByWebsite.set(scan.website_id, list);
  }

  const diffs: CanonicalScanDiffEntry[] = [];
  for (const websiteScans of scansByWebsite.values()) {
    for (let i = 0; i < websiteScans.length; i++) {
      const current = websiteScans[i];
      const previous = i > 0 ? websiteScans[i - 1] : null;
      diffs.push({
        scan_id: current.id,
        website_id: current.website_id,
        completed_at: current.completed_at,
        diff: diffScanFindings(previous, current),
      });
    }
  }

  return diffs.sort(
    (a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime(),
  );
}

/** Build canonical org security state from DB — SSOT for dashboard, portal, PDF, API. */
export async function buildCanonicalOrgSecurityState(
  orgId: string,
): Promise<CanonicalOrgSecurityState> {
  const admin = createAdminClient();
  const computed_at = new Date().toISOString();

  const [orgIntelRes, websitesRes, scansRes, anomalyRowsRes] = await Promise.all([
    admin
      .from('organizations')
      .select('rolling_risk_score, posture_state, intelligence_updated_at')
      .eq('id', orgId)
      .single(),
    admin.from('websites').select('id, client_group, is_active').eq('org_id', orgId),
    admin
      .from('scans')
      .select(
        'id, website_id, security_score, completed_at, issues, vulnerabilities_count, websites(url, label)',
      )
      .eq('org_id', orgId)
      .eq('status', 'completed'),
    admin
      .from('org_anomalies')
      .select('id, type, severity, message, website_id, created_at, resolved')
      .eq('org_id', orgId)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (websitesRes.error) throw new Error(websitesRes.error.message);
  if (scansRes.error) throw new Error(scansRes.error.message);
  if (anomalyRowsRes.error) throw new Error(anomalyRowsRes.error.message);

  const websites = (websitesRes.data ?? []) as WebsiteRow[];
  const activeWebsites = websites.filter((w) => w.is_active !== false);
  const scans = (scansRes.data ?? []) as CompletedScanRow[];
  const scoredScans = scans.filter((s) => s.security_score !== null);

  const computedRolling = computeRollingRiskScore(scans);
  const storedRolling = orgIntelRes.data?.rolling_risk_score ?? null;
  const rollingRiskScore = computedRolling ?? storedRolling;
  const postureState = scoreToPostureState(rollingRiskScore);

  const org_anomalies: OrgAnomalyFeedItem[] = (anomalyRowsRes.data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    websiteId: row.website_id,
    createdAt: row.created_at,
    resolved: row.resolved,
  }));

  const latestScanByWebsite = new Map<string, CompletedScanRow>();
  for (const scan of [...scans].sort(
    (a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime(),
  )) {
    if (!latestScanByWebsite.has(scan.website_id)) {
      latestScanByWebsite.set(scan.website_id, scan);
    }
  }

  const latest_scans: CanonicalLatestScan[] = [...latestScanByWebsite.values()].map((scan) => {
    const meta = extractWebsiteMeta(scan.websites);
    return {
      scan_id: scan.id,
      website_id: scan.website_id,
      security_score: scan.security_score,
      completed_at: scan.completed_at,
      vulnerabilities_count: scan.vulnerabilities_count,
      website_url: meta.url,
      website_label: meta.label,
    };
  });

  const scan_results: CanonicalScanResult[] = scans.map((scan) => ({
    scan_id: scan.id,
    website_id: scan.website_id,
    security_score: scan.security_score,
    completed_at: scan.completed_at,
    issues: normalizeIssues(scan.issues),
    vulnerabilities_count: scan.vulnerabilities_count,
    has_open_findings: scanHasOpenFindings(scan),
  }));

  const scan_diff = buildScanDiffs(scans);
  const dashboard = buildDashboardAggregates(activeWebsites, latestScanByWebsite, scoredScans);

  const orgSecurityNarrative = generateOrgSecurityNarrative({
    orgId,
    rollingRiskScore,
    postureState,
    scans,
    anomalies: org_anomalies,
    totalSitesMonitored: dashboard.totalSitesMonitored,
    criticalAlertsCount: dashboard.criticalAlertsCount,
  });

  let latestScanNarrative = null;
  let latestScanNarrativeAt: string | null = null;
  // Runtime-only narratives: org overview is generated above; scan-level narratives are not read from DB here.

  const state: CanonicalOrgSecurityState = {
    org_id: orgId,
    rollingRiskScore,
    postureState,
    latest_scans,
    scan_results,
    scan_diff,
    org_anomalies,
    security_narratives: {
      org: orgSecurityNarrative,
      latestScan: latestScanNarrative,
      latestScanAt: latestScanNarrativeAt,
    },
    dashboard,
    computed_at,
  };

  console.log('[canonical_state_built]', {
    orgId,
    computed_at,
    rollingRiskScore,
    postureState,
    latestScanCount: latest_scans.length,
    scanResultCount: scan_results.length,
    anomalyCount: org_anomalies.length,
    totalSitesMonitored: dashboard.totalSitesMonitored,
  });

  return state;
}

export function invalidateCanonicalOrgSecurityState(orgId: string): void {
  stateCache.delete(orgId);
}

/** Cached read — rebuilds on miss or expiry. */
export async function getCanonicalOrgSecurityState(
  orgId: string,
  options?: { forceRefresh?: boolean },
): Promise<CanonicalOrgSecurityState> {
  if (!options?.forceRefresh) {
    const cached = stateCache.get(orgId);
    if (cached && cached.expires > Date.now()) {
      return cached.state;
    }
  }

  const state = await buildCanonicalOrgSecurityState(orgId);
  stateCache.set(orgId, { state, expires: Date.now() + CACHE_TTL_MS });
  return state;
}

/** Validate canonical state against persisted org intelligence before PDF export. */
export async function validateCanonicalState(
  orgId: string,
  state: CanonicalOrgSecurityState,
): Promise<void> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from('organizations')
    .select('rolling_risk_score, posture_state')
    .eq('id', orgId)
    .single();

  const storedRolling = org?.rolling_risk_score ?? null;
  const storedPosture = (org?.posture_state as CanonicalOrgSecurityState['postureState']) ?? null;

  const scoreRows = state.scan_results.map((s) => ({
    id: s.scan_id,
    website_id: s.website_id,
    security_score: s.security_score,
    completed_at: s.completed_at,
  }));
  const recomputedRolling = computeRollingRiskScore(scoreRows);

  if (recomputedRolling !== null && recomputedRolling !== state.rollingRiskScore) {
    console.log('[canonical_state_mismatch_detected]', {
      orgId,
      mismatches: [
        `rollingRiskScore recomputed=${recomputedRolling} canonical=${state.rollingRiskScore}`,
      ],
    });
    state.rollingRiskScore = recomputedRolling;
    await admin
      .from('organizations')
      .update({
        rolling_risk_score: recomputedRolling,
        posture_state: state.postureState,
        intelligence_updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);
    console.log('[pdf_validation_healed_rolling_score]', { orgId, rollingRiskScore: recomputedRolling });
  }

  if (
    storedRolling !== state.rollingRiskScore ||
    storedPosture !== state.postureState
  ) {
    await admin
      .from('organizations')
      .update({
        rolling_risk_score: state.rollingRiskScore,
        posture_state: state.postureState,
        intelligence_updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);
    console.log('[pdf_validation_healed_stored_intelligence]', { orgId });
  }

  console.log('[pdf_validation_passed]', { orgId, computed_at: state.computed_at });
}
