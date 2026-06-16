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
import { getSeatLimitForPlan } from "@/lib/billing/orgPlans";
import { getOrgDashboardSummary, RISK_BUCKET_DISPLAY, type OrgDashboardSummary } from "@/lib/enterprise/orgDashboardSummary";
import { POSTURE_DISPLAY } from "@/lib/enterprise/postureState";
import EnterpriseExportPdfButton from "@/components/enterprise/EnterpriseExportPdfButton";

export const metadata: Metadata = {
  title: "Enterprise Dashboard",
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

  let memberCount = 0;
  let recentScans: Array<{
    id: string;
    security_score: number | null;
    status: string;
    completed_at: string | null;
    websites: { url: string; label: string | null } | null;
  }> = [];

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

  if (orgId) {
    const [membersRes, scansRes, orgSummary] = await Promise.all([
      admin
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId),
      admin
        .from("scans")
        .select("id, security_score, status, completed_at, websites(url, label)")
        .eq("org_id", orgId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20),
      getOrgDashboardSummary(orgId),
    ]);

    memberCount = membersRes.count ?? 0;
    summary = orgSummary;
    recentScans = (scansRes.data ?? []).map((s) => ({
      ...s,
      websites: Array.isArray(s.websites) ? s.websites[0] ?? null : s.websites,
    })) as typeof recentScans;
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
    orgSecurityNarrative,
    latestScanNarrative,
    latestScanNarrativeAt,
  } = summary;
  const postureMeta = postureState ? POSTURE_DISPLAY[postureState] : null;
  const scoreBuckets = riskDistribution;
  const displayNarrative = latestScanNarrative;
  const urgencyStyles: Record<string, string> = {
    critical: "border-red-500/40 bg-red-500/10 text-red-400",
    high: "border-orange-500/40 bg-orange-500/10 text-orange-400",
    medium: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    low: "border-green-500/40 bg-green-500/10 text-green-400",
  };

  const orgRole = orgCtx.role ?? (orgId ? await getUserOrgRole(user.id, orgId) : null);
  const resolvedPlan = normalizePlan(orgCtx.access.plan);
  const planLabel = PLAN_LIMITS[resolvedPlan]?.name ?? resolvedPlan;
  const roleLabel =
    orgRole === "owner" ? "Owner" : orgRole === "admin" ? "Admin" : orgRole === "member" ? "Member" : orgRole ?? null;
  const maxBucket = Math.max(...Object.values(scoreBuckets), 1);
  const seatLimit = getSeatLimitForPlan(resolvedPlan);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? "User"} title="Enterprise Overview" showPlanUsage={false} />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Enterprise Overview</h2>
            <p className="mt-1 text-sm text-gray-500">
              {org?.name ?? "Your Organization"}
              {roleLabel && (
                <>
                  {" "}
                  · <span className="text-indigo-400">{roleLabel}</span>
                </>
              )}
              {" "}
              · Plan:{" "}
              <span className="capitalize text-blue-400">{planLabel}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(orgRole === "owner" || orgRole === "admin") && orgId && (
              <EnterpriseExportPdfButton orgId={orgId} />
            )}
            <Link href="/enterprise/portal/users" className="rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white">
              Manage Team
            </Link>
            {(orgRole === "owner" || orgRole === "admin") && (
              <Link
                href="/app/settings"
                className="rounded-lg border border-indigo-700/50 bg-indigo-600/10 px-4 py-2 text-sm font-medium text-indigo-300 hover:text-white"
              >
                Billing & Settings
              </Link>
            )}
          </div>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          {postureMeta && postureState && (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${postureMeta.badgeClass} ${postureMeta.textClass}`}
            >
              Posture: {postureMeta.label}
            </span>
          )}
          {rollingRiskScore !== null && (
            <span className="text-sm text-gray-400">
              Rolling risk score (last 20 scans):{" "}
              <span className="font-semibold text-white">{rollingRiskScore}/100</span>
            </span>
          )}
        </div>

        {(orgSecurityNarrative || displayNarrative) && (
          <div className="mb-8 space-y-4">
            {orgSecurityNarrative && (
              <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Organization Risk Overview</h3>
                  {orgSecurityNarrative.trend_direction !== "stable" && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                        orgSecurityNarrative.trend_direction === "improving"
                          ? "border-green-500/40 text-green-400"
                          : "border-orange-500/40 text-orange-400"
                      }`}
                    >
                      {orgSecurityNarrative.trend_direction}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-gray-300">{orgSecurityNarrative.org_risk_overview}</p>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">{orgSecurityNarrative.trend_summary}</p>
                <p className="mt-3 text-xs text-gray-500">{orgSecurityNarrative.posture_explanation}</p>
                <p className="mt-2 text-xs text-orange-300/80">{orgSecurityNarrative.active_threats_summary}</p>
              </div>
            )}

            {displayNarrative && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 lg:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">Executive Summary</h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${urgencyStyles[displayNarrative.urgency_level] ?? urgencyStyles.low}`}
                    >
                      {displayNarrative.urgency_level} urgency
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-200">{displayNarrative.executive_summary}</p>
                  {latestScanNarrativeAt && (
                    <p className="mt-2 text-xs text-gray-500">
                      From latest scan · {new Date(latestScanNarrativeAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
                  <h3 className="mb-3 text-sm font-semibold text-white">Risk Story</h3>
                  <p className="text-sm leading-relaxed text-gray-300">{displayNarrative.risk_story}</p>
                  <p className="mt-4 text-sm leading-relaxed text-gray-400">{displayNarrative.business_impact}</p>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
                  <h3 className="mb-3 text-sm font-semibold text-white">Key Events</h3>
                  <ul className="space-y-2">
                    {displayNarrative.key_events.map((event) => (
                      <li key={event} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                        {event}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 lg:col-span-2">
                  <h3 className="mb-3 text-sm font-semibold text-white">Recommended Actions</h3>
                  {displayNarrative.recommended_actions.length === 0 ? (
                    <p className="text-sm text-gray-500">No remediation actions required at this time.</p>
                  ) : (
                    <ol className="list-decimal space-y-2 pl-5">
                      {displayNarrative.recommended_actions.map((action) => (
                        <li key={action} className="text-sm text-gray-300">
                          {action}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Sites Monitored</p>
            <p className="mt-2 text-3xl font-bold text-white">{totalSitesMonitored}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Critical Alerts</p>
            <p className="mt-2 text-3xl font-bold text-red-400">{criticalAlertsCount}</p>
          </div>
          <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/20 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">Rolling Risk Score</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {rollingRiskScore !== null ? `${rollingRiskScore}/100` : "—"}
            </p>
            {avgScore !== null && (
              <p className="mt-1 text-xs text-gray-500">Avg (all scans): {avgScore}/100</p>
            )}
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Open Alerts</p>
            <p className="mt-2 text-3xl font-bold text-orange-400">{openAlertsCount}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Team Members</p>
            <p className="mt-2 text-3xl font-bold text-white">{memberCount}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Seat Limit</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {seatLimit >= 999999 ? "∞" : seatLimit}
            </p>
          </div>
        </div>

        {anomalies.length > 0 && (
          <div className="mb-8 rounded-xl border border-orange-800/40 bg-orange-950/10 p-6">
            <h3 className="mb-1 text-sm font-semibold text-white">Intelligence Anomalies</h3>
            <p className="mb-4 text-xs text-gray-500">Unresolved signals from recent scan activity</p>
            <ul className="space-y-2">
              {anomalies.map((anomaly) => (
                <li
                  key={anomaly.id}
                  className="flex items-start justify-between gap-4 rounded-lg bg-gray-900/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-gray-200">{anomaly.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {anomaly.type.replace(/_/g, " ")} ·{" "}
                      {new Date(anomaly.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium capitalize ${
                      anomaly.severity === "critical"
                        ? "text-red-400"
                        : anomaly.severity === "high"
                          ? "text-orange-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {anomaly.severity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-1 text-sm font-semibold text-white">Risk Distribution</h3>
          <p className="mb-4 text-xs text-gray-500">Latest completed scan per monitored site</p>
          <div className="space-y-3">
            {RISK_BUCKET_DISPLAY.map(({ key, label, color, text }) => {
              const count = scoreBuckets[key];
              const pct = Math.round((count / maxBucket) * 100);
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className={`w-28 shrink-0 text-xs ${text}`}>{label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-gray-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {sitesByClientGroup.length > 0 && (
          <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-1 text-sm font-semibold text-white">Sites by Client</h3>
            <p className="mb-4 text-xs text-gray-500">Grouped by optional client_group on each website</p>
            <ul className="space-y-2">
              {sitesByClientGroup.map((group) => (
                <li
                  key={group.clientGroup}
                  className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-gray-200">{group.clientGroup}</p>
                    <p className="text-xs text-gray-500">
                      {group.siteCount} site{group.siteCount === 1 ? "" : "s"}
                      {group.criticalAlertsCount > 0 && (
                        <span className="ml-2 text-red-400">
                          · {group.criticalAlertsCount} critical alert
                          {group.criticalAlertsCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {group.riskDistribution.critical > 0 && (
                      <span className="text-red-400">{group.riskDistribution.critical} critical</span>
                    )}
                    {group.riskDistribution.high > 0 && (
                      <span className="text-orange-400">{group.riskDistribution.high} high</span>
                    )}
                    {group.riskDistribution.unknown > 0 && (
                      <span>{group.riskDistribution.unknown} unscanned</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Recent Org Scans</h3>
          {recentScans.length === 0 ? (
            <p className="text-sm text-gray-500">No org-scoped scans yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentScans.slice(0, 10).map((scan) => {
                const site = scan.websites as { url: string; label: string | null } | null;
                return (
                  <li
                    key={scan.id}
                    className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-gray-200">{site?.label ?? site?.url ?? "Unknown"}</p>
                      <p className="text-xs text-gray-500">
                        {scan.completed_at
                          ? new Date(scan.completed_at).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {scan.security_score !== null && (
                        <span className="text-sm font-medium text-blue-400">{scan.security_score}/100</span>
                      )}
                      <span className="text-xs capitalize text-gray-500">{scan.status}</span>
                      {scan.status === "completed" && (
                        <Link href={`/report/${scan.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                          Report →
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
