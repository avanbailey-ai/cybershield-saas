import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { canAccessEnterprise, normalizePlan } from "@/lib/auth/permissions";
import { getUserOrgRole } from "@/lib/auth/rbac";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from "@/lib/org/sessionContext";
import type { SessionSubscriptionClient } from "@/lib/billing/getSubscriptionAccess";
import { getActiveOrgId, getOrganization } from "@/lib/org/context";
import { getOrgDashboardSummary, RISK_BUCKET_DISPLAY, type OrgDashboardSummary } from "@/lib/enterprise/orgDashboardSummary";
import { getCanonicalOrgSecurityState } from "@/lib/enterprise/canonicalOrgSecurityState";
import { POSTURE_DISPLAY } from "@/lib/enterprise/postureState";
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
import { scoreToRiskBucket } from "@/lib/enterprise/enterpriseTypes";
import {
  countPriorityMonitoringUsed,
  getPriorityMonitoringSlots,
} from "@/lib/billing/priorityMonitoring";
import { getEffectivePlan } from "@/lib/auth/permissions";
import { getUserWithPlan } from "@/lib/billing/planService";
import EnterpriseExportPdfButton from "@/components/enterprise/EnterpriseExportPdfButton";
import ScanAllButton from "@/components/dashboard/ScanAllButton";
import {
  CollapsiblePanel,
  IntelligenceSignalsClient,
  LowerPriorityAlerts,
} from "@/components/enterprise/overview/EnterpriseOverviewPanels";

export const metadata: Metadata = {
  title: "Enterprise Overview — CyberShield",
};

function severityBadgeClass(severity: string): string {
  if (severity === "critical") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (severity === "high") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  if (severity === "medium") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return "bg-gray-800 text-gray-400 border-gray-700";
}

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
  let memberCount = 0;
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

    const [membersRes, orgSummary, canonical, alertsRes, cronRes, scans24hRes, failed24hRes, queueRes] =
      await Promise.all([
        admin.from("organization_members").select("*", { count: "exact", head: true }).eq("org_id", orgId),
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

    memberCount = membersRes.count ?? 0;
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

  const postureMeta = postureState ? POSTURE_DISPLAY[postureState] : null;
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
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? "User"} title="Enterprise Overview" showPlanUsage={false} />

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {/* Hero */}
        <section className="mb-8 rounded-2xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/40 to-gray-900/60 p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-white">{org?.name ?? "Your Organization"}</h2>
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                  {planLabel}
                </span>
                {postureMeta && postureState && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${postureMeta.badgeClass} ${postureMeta.textClass}`}
                  >
                    {postureMeta.label} posture
                  </span>
                )}
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-gray-300">{riskOverview.summary}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                {rollingRiskScore !== null && (
                  <span>
                    Rolling score:{" "}
                    <strong className="text-white">{rollingRiskScore}/100</strong>
                  </span>
                )}
                {lastScanTime && (
                  <span>
                    Last scan: <strong className="text-gray-200">{lastScanTime}</strong>
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && orgId && (
                <>
                  <ScanAllButton />
                  <Link
                    href="/enterprise/portal/websites"
                    className="rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800"
                  >
                    Manage websites
                  </Link>
                  <EnterpriseExportPdfButton orgId={orgId} />
                </>
              )}
              <Link
                href="/dashboard/reports"
                className="rounded-lg border border-indigo-700/50 bg-indigo-600/10 px-4 py-2 text-sm font-medium text-indigo-300 hover:text-white"
              >
                View reports
              </Link>
            </div>
          </div>
        </section>

        {totalSitesMonitored === 0 && (
          <div className="mb-8 rounded-xl border border-dashed border-indigo-700/40 bg-indigo-950/20 px-5 py-6 text-center">
            <p className="text-sm font-medium text-indigo-200">No monitored sites yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Add websites and run scans to populate your security command center.
            </p>
            <Link
              href="/enterprise/portal/websites"
              className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Add websites
            </Link>
          </div>
        )}

        {/* Metric cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Sites monitored", value: totalSitesMonitored, tone: "text-white" },
            { label: "Critical sites", value: criticalAlertsCount, tone: "text-red-400" },
            { label: "Open high/critical alerts", value: urgentAlerts.length, tone: "text-orange-400" },
            { label: "Average score", value: avgScore !== null ? `${avgScore}/100` : "—", tone: "text-white" },
            {
              label: "Last monitoring run",
              value: monitoringHealth.lastCronAt
                ? new Date(monitoringHealth.lastCronAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "—",
              tone: "text-white",
            },
            {
              label: "Priority slots",
              value:
                prioritySlotsLimit !== null && prioritySlotsUsed !== null
                  ? `${prioritySlotsUsed} / ${prioritySlotsLimit}`
                  : "—",
              tone: "text-indigo-300",
            },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </section>

        {/* Immediate Actions */}
        <section className="mb-8">
          <h3 className="mb-1 text-sm font-semibold text-white">Immediate Actions</h3>
          <p className="mb-4 text-xs text-gray-500">Top priorities based on current posture and alerts</p>
          {immediateActions.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-6 text-sm text-gray-500">
              All monitored sites are stable. No urgent actions right now.
            </div>
          ) : (
            <ul className="space-y-3">
              {immediateActions.map((action) => (
                <li
                  key={action.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">{action.site}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs capitalize ${severityBadgeClass(action.severity)}`}
                      >
                        {action.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{action.reason}</p>
                  </div>
                  {action.ctaHref === "#export-pdf" ? (
                    orgId && isAdmin ? (
                      <EnterpriseExportPdfButton orgId={orgId} />
                    ) : null
                  ) : (
                    <Link
                      href={action.ctaHref}
                      className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      {action.ctaLabel}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Security Posture */}
          <section className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-6">
            <h3 className="mb-1 text-sm font-semibold text-white">Security Posture</h3>
            <p className="mb-4 text-xs text-gray-500">Executive summary for your organization</p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Primary risk driver</dt>
                <dd className="mt-1 text-gray-200">{riskOverview.primaryDriver}</dd>
              </div>
              {riskOverview.affectedSite && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Most affected site</dt>
                  <dd className="mt-1 text-gray-200">{riskOverview.affectedSite}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Recommended next step</dt>
                <dd className="mt-1 text-gray-300">{riskOverview.nextStep}</dd>
              </div>
            </dl>
            {topDrivers.length > 0 && (
              <div className="mt-5 border-t border-indigo-800/30 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Top risk drivers</p>
                <ul className="flex flex-wrap gap-2">
                  {topDrivers.map((driver) => (
                    <li key={driver} className="rounded-full bg-gray-900/60 px-3 py-1 text-xs text-gray-300">
                      {driver}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Monitoring Health */}
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-1 text-sm font-semibold text-white">Monitoring Health</h3>
            <p className="mb-4 text-xs text-gray-500">Automated monitoring status</p>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Last cron run</dt>
                <dd className="mt-1 font-medium text-white">
                  {monitoringHealth.lastCronAt
                    ? new Date(monitoringHealth.lastCronAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Scans (24h)</dt>
                <dd className="mt-1 font-medium text-white">{monitoringHealth.scansLast24h}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Failed (24h)</dt>
                <dd className="mt-1 font-medium text-white">{monitoringHealth.failedLast24h}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Queued scans</dt>
                <dd className="mt-1 font-medium text-white">{monitoringHealth.queuedScans}</dd>
              </div>
            </dl>
            {prioritySlotsLimit !== null && (
              <p className="mt-4 text-xs text-gray-500">
                Priority monitoring: {prioritySlotsUsed ?? 0} / {prioritySlotsLimit} slots used.{" "}
                <Link href="/enterprise/portal/websites" className="text-indigo-400 hover:text-indigo-300">
                  Manage websites
                </Link>
              </p>
            )}
          </section>
        </div>

        {/* Sites at Risk */}
        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-1 text-sm font-semibold text-white">Sites at Risk</h3>
          <p className="mb-4 text-xs text-gray-500">Lowest-scoring monitored properties</p>
          {sitesAtRisk.length === 0 ? (
            <p className="text-sm text-gray-500">No sites currently flagged as high or critical risk.</p>
          ) : (
            <ul className="space-y-2">
              {sitesAtRisk.slice(0, 5).map((site) => (
                <li
                  key={site.websiteId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-800/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-200">{site.label ?? site.domain}</p>
                    <p className="text-xs text-gray-500">{site.domain}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${scoreToRiskBucket(site.score) === "critical" ? "text-red-400" : "text-orange-400"}`}>
                      {site.score}/100
                    </span>
                    {site.scanId && (
                      <Link href={`/report/${site.scanId}`} className="text-xs text-indigo-400 hover:text-indigo-300">
                        View report
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Alerts */}
        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
              <p className="text-xs text-gray-500">Critical and high issues requiring attention</p>
            </div>
            <Link href="/dashboard/alerts" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
              View all alerts
            </Link>
          </div>
          {urgentAlerts.length === 0 ? (
            <p className="text-sm text-gray-500">No critical alerts right now.</p>
          ) : (
            <ul className="space-y-2">
              {urgentAlerts.slice(0, 5).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-gray-800 bg-gray-950/30 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-200">{alert.title}</p>
                      <p className="text-xs text-gray-500">
                        {alert.siteLabel} · {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${severityBadgeClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <LowerPriorityAlerts alerts={lowerAlerts} />
        </section>

        {/* Trends & Intelligence */}
        <section className="mb-8">
          <CollapsiblePanel
            title="Trends & Intelligence"
            subtitle="Grouped monitoring signals — deduplicated for clarity"
            badge={intelligenceGrouped.total > 0 ? String(intelligenceGrouped.total) : undefined}
            defaultOpen={intelligenceGrouped.total > 0 && intelligenceGrouped.total <= 3}
          >
            <IntelligenceSignalsClient
              signals={intelligenceGrouped.items}
              total={intelligenceGrouped.total}
              hasMore={intelligenceGrouped.hasMore}
            />
          </CollapsiblePanel>
        </section>

        {/* Risk Distribution + Client groups */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-1 text-sm font-semibold text-white">Risk Distribution</h3>
            <p className="mb-4 text-xs text-gray-500">Latest completed scan per site</p>
            <div className="space-y-3">
              {RISK_BUCKET_DISPLAY.map(({ key, label, color, text }) => {
                const count = riskDistribution[key];
                const pct = Math.round((count / maxBucket) * 100);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`w-28 shrink-0 text-xs ${text}`}>{label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs text-gray-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {sitesByClientGroup.length > 0 && (
            <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
              <h3 className="mb-1 text-sm font-semibold text-white">Sites by Client</h3>
              <ul className="space-y-2">
                {sitesByClientGroup.map((group) => (
                  <li key={group.clientGroup} className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3 text-sm">
                    <span className="text-gray-200">{group.clientGroup}</span>
                    <span className="text-xs text-gray-500">{group.siteCount} sites</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Recent Scans — latest per site */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Monitoring Activity</h3>
              <p className="text-xs text-gray-500">Latest scan per website</p>
            </div>
            {isAdmin && (
              <Link href="/enterprise/portal/websites" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                Full scan history
              </Link>
            )}
          </div>
          {latestScansPerSite.length === 0 ? (
            <p className="text-sm text-gray-500">No completed scans yet.</p>
          ) : (
            <ul className="space-y-2">
              {latestScansPerSite.map((scan) => (
                <li
                  key={scan.websiteId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-800/40 px-4 py-3"
                >
                    <div>
                      <p className="text-sm font-medium text-gray-200">{scan.label ?? scan.domain}</p>
                      <p className="text-xs text-gray-500">
                        {scan.completedAt ? new Date(scan.completedAt).toLocaleString() : "—"} · {scan.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {scan.score !== null && (
                        <span className="text-sm font-semibold text-white">{scan.score}/100</span>
                      )}
                      <Link href={`/report/${scan.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">
                        View report
                      </Link>
                    </div>
                  </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reports footer */}
        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Reports</h3>
            <p className="text-xs text-gray-500">Export posture data for stakeholders or open detailed reports.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/reports" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:text-white">
              View reports
            </Link>
            {isAdmin && orgId && <EnterpriseExportPdfButton orgId={orgId} />}
          </div>
        </section>
      </main>
    </div>
  );
}
