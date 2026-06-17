import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessEnterprise, normalizePlan } from "@/lib/auth/permissions";
import { getUserOrgRole } from "@/lib/auth/rbac";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from "@/lib/org/sessionContext";
import type { SessionSubscriptionClient } from "@/lib/billing/getSubscriptionAccess";
import { getActiveOrgId, getOrganization } from "@/lib/org/context";
import { getOrgDashboardSummary, type OrgDashboardSummary } from "@/lib/enterprise/orgDashboardSummary";
import { getCanonicalOrgSecurityState } from "@/lib/enterprise/canonicalOrgSecurityState";
import {
  buildConciseRiskOverview,
  buildImmediateActions,
  extractTopRiskDrivers,
  groupIntelligenceSignals,
  latestScanPerWebsite,
  splitAlertsByPriority,
  type OrgAlertRow,
  type SiteAtRisk,
} from "@/lib/enterprise/enterpriseOverviewHelpers";
import {
  countPriorityMonitoringUsed,
  getPriorityMonitoringSlots,
} from "@/lib/billing/priorityMonitoring";
import { getEffectivePlan } from "@/lib/auth/permissions";
import { getUserWithPlan } from "@/lib/billing/planService";
import EnterpriseCommandCenter from "@/components/enterprise/overview/EnterpriseCommandCenter";

export const metadata: Metadata = {
  title: "Enterprise Overview — CyberShield",
};

export default async function EnterpriseDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/enterprise/login?redirectTo=/enterprise/portal");

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_CONTEXT_COOKIE)?.value ?? null;

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
    cookieOrgId,
  );

  if (
    !canAccessEnterprise(
      {
        email: user.email,
        plan: orgCtx.access.plan,
        subscription_status: orgCtx.access.status,
      },
      orgCtx.role,
    )
  ) {
    redirect("/app");
  }

  const orgId = orgCtx.orgId ?? (await getActiveOrgId(user.id));
  const org = orgId ? await getOrganization(orgId) : null;
  const admin = createAdminClient();

  const emptySummary: OrgDashboardSummary = {
    orgId: "",
    totalSitesMonitored: 0,
    riskDistribution: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
    criticalAlertsCount: 0,
    openAlertsCount: 0,
    avgScore: null,
    rollingRiskScore: null,
    postureState: null,
    anomalies: [],
    sitesByClientGroup: [],
    orgSecurityNarrative: null,
    latestScanNarrative: null,
    latestScanNarrativeAt: null,
  };

  let summary: OrgDashboardSummary = emptySummary;
  let orgAlerts: OrgAlertRow[] = [];
  let prioritySlotsUsed: number | null = null;
  let prioritySlotsLimit: number | null = null;
  let monitoringHealth: {
    lastCronAt: string | null;
    scansLast24h: number;
    failedLast24h: number;
    queuedScans: number;
  } = { lastCronAt: null, scansLast24h: 0, failedLast24h: 0, queuedScans: 0 };

  let latestScansPerSite: ReturnType<typeof latestScanPerWebsite> = [];
  let sitesAtRisk: SiteAtRisk[] = [];
  let scanIssuesForDrivers: string[][] = [];

  if (orgId) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const userWithPlan = await getUserWithPlan(user.id, orgId);
    const effectivePlan = getEffectivePlan(userWithPlan);
    prioritySlotsLimit = getPriorityMonitoringSlots(effectivePlan) || null;
    if (prioritySlotsLimit) {
      prioritySlotsUsed = await countPriorityMonitoringUsed(admin, orgId, user.id);
    }

    const [orgSummary, canonical, alertsRes, cronRes, scans24hRes, failed24hRes, queueRes] =
      await Promise.all([
        getOrgDashboardSummary(orgId),
        getCanonicalOrgSecurityState(orgId),
        admin
          .from("alerts")
          .select("id, title, message, severity, website_id, created_at, websites(url, label)")
          .eq("org_id", orgId)
          .eq("resolved", false)
          .order("created_at", { ascending: false })
          .limit(50),
        admin
          .from("cron_monitoring_runs")
          .select("started_at")
          .order("started_at", { ascending: false })
          .limit(1),
        admin
          .from("scans")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "completed")
          .gte("completed_at", since24h),
        admin
          .from("scans")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "failed")
          .gte("completed_at", since24h),
        admin
          .from("scan_queue")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .in("status", ["pending", "processing"]),
      ]);

    summary = orgSummary;
    scanIssuesForDrivers = canonical.scan_results.map((s) => s.issues);

    orgAlerts = (alertsRes.data ?? []).map((row) => {
      const site = Array.isArray(row.websites) ? row.websites[0] : row.websites;
      const url = site?.url ?? "Unknown site";
      let domain = url;
      try {
        domain = new URL(url).hostname;
      } catch {
        /* keep url */
      }
      return {
        id: row.id,
        title: row.title,
        message: row.message,
        severity: row.severity ?? "medium",
        websiteId: row.website_id,
        siteLabel: site?.label ?? domain,
        createdAt: row.created_at,
      };
    });

    monitoringHealth = {
      lastCronAt: cronRes.data?.[0]?.started_at ?? null,
      scansLast24h: scans24hRes.count ?? 0,
      failedLast24h: failed24hRes.count ?? 0,
      queuedScans: queueRes.count ?? 0,
    };

    const scanRows = canonical.latest_scans.map((scan) => ({
      id: scan.scan_id,
      websiteId: scan.website_id,
      domain: scan.website_url ?? "Unknown",
      label: scan.website_label,
      score: scan.security_score,
      status: "completed",
      completedAt: scan.completed_at,
    }));

    latestScansPerSite = latestScanPerWebsite(scanRows);

    sitesAtRisk = latestScansPerSite
      .filter((s) => s.score !== null && s.score < 70)
      .map((s) => ({
        websiteId: s.websiteId,
        domain: s.domain,
        label: s.label,
        score: s.score,
        bucket: s.bucket,
        scanId: s.id,
        completedAt: s.completedAt,
      }));
  }

  const {
    totalSitesMonitored,
    riskDistribution,
    criticalAlertsCount,
    openAlertsCount,
    avgScore,
    rollingRiskScore,
    postureState,
    anomalies,
    sitesByClientGroup,
  } = summary;

  const orgRole = orgCtx.role ?? (orgId ? await getUserOrgRole(user.id, orgId) : null);
  const resolvedPlan = normalizePlan(orgCtx.access.plan);
  const planLabel = PLAN_LIMITS[resolvedPlan]?.name ?? resolvedPlan;
  const maxBucket = Math.max(...Object.values(riskDistribution), 1);

  const intelligenceGrouped = groupIntelligenceSignals(anomalies);
  const { urgent: urgentAlerts, lower: lowerAlerts } = splitAlertsByPriority(orgAlerts);
  const topDrivers = extractTopRiskDrivers(scanIssuesForDrivers);

  const riskOverview = buildConciseRiskOverview({
    postureState,
    rollingRiskScore,
    totalSites: totalSitesMonitored,
    criticalSites: criticalAlertsCount,
    sitesAtRisk,
    topIssueCategories: topDrivers,
  });

  const immediateActions = buildImmediateActions({
    sitesAtRisk,
    alerts: orgAlerts,
    intelligence: intelligenceGrouped.items,
    totalSites: totalSitesMonitored,
    prioritySlotsUsed,
    prioritySlotsLimit,
    orgId: orgId ?? "",
  });

  const lastScanTime = latestScansPerSite[0]?.completedAt
    ? new Date(latestScansPerSite[0].completedAt).toLocaleString()
    : null;

  const isAdmin = orgRole === "owner" || orgRole === "admin";

  return (
    <EnterpriseCommandCenter
      userEmail={user.email ?? "User"}
      orgName={org?.name ?? null}
      orgId={orgId}
      planLabel={planLabel}
      isAdmin={isAdmin}
      totalSitesMonitored={totalSitesMonitored}
      criticalAlertsCount={criticalAlertsCount}
      openAlertsCount={openAlertsCount}
      avgScore={avgScore}
      rollingRiskScore={rollingRiskScore}
      postureState={postureState}
      riskOverview={riskOverview}
      topDrivers={topDrivers}
      immediateActions={immediateActions}
      sitesAtRisk={sitesAtRisk}
      monitoringHealth={monitoringHealth}
      prioritySlotsUsed={prioritySlotsUsed}
      prioritySlotsLimit={prioritySlotsLimit}
      urgentAlerts={urgentAlerts}
      lowerAlerts={lowerAlerts}
      intelligenceGrouped={intelligenceGrouped}
      riskDistribution={riskDistribution}
      maxBucket={maxBucket}
      sitesByClientGroup={sitesByClientGroup}
      latestScansPerSite={latestScansPerSite}
      lastScanTime={lastScanTime}
    />
  );
}
