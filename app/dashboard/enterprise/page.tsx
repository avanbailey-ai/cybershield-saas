import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { canAccessEnterprise } from "@/lib/auth/permissions";
import { getEffectivePlan } from "@/lib/auth/permissions";
import { getUserOrgRole } from "@/lib/auth/rbac";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { resolveOrgSessionContextFromSession } from "@/lib/org/sessionContext";
import type { SessionSubscriptionClient } from "@/lib/billing/getSubscriptionAccess";
import { getActiveOrgId, getOrganization } from "@/lib/org/context";
import { getSeatLimitForPlan } from "@/lib/billing/orgPlans";

export const metadata: Metadata = {
  title: "Enterprise Dashboard",
};

function scoreBucket(score: number): "critical" | "high" | "medium" | "low" {
  if (score < 50) return "critical";
  if (score < 70) return "high";
  if (score < 90) return "medium";
  return "low";
}

export default async function EnterpriseDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/enterprise/login?redirectTo=/enterprise/portal");

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
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
  let avgScore: number | null = null;
  let openAlerts = 0;
  let recentScans: Array<{
    id: string;
    security_score: number | null;
    status: string;
    started_at: string;
    websites: { url: string; label: string | null } | null;
  }> = [];
  const scoreBuckets = { critical: 0, high: 0, medium: 0, low: 0 };

  if (orgId) {
    const [membersRes, scansRes, alertsRes] = await Promise.all([
      admin
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId),
      admin
        .from("scans")
        .select("id, security_score, status, started_at, websites(url, label)")
        .eq("org_id", orgId)
        .order("started_at", { ascending: false })
        .limit(20),
      admin
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("resolved", false),
    ]);

    memberCount = membersRes.count ?? 0;
    openAlerts = alertsRes.count ?? 0;
    recentScans = (scansRes.data ?? []).map((s) => ({
      ...s,
      websites: Array.isArray(s.websites) ? s.websites[0] ?? null : s.websites,
    })) as typeof recentScans;

    const completed = recentScans.filter(
      (s) => s.status === "completed" && s.security_score !== null,
    );
    if (completed.length > 0) {
      avgScore = Math.round(
        completed.reduce((sum, s) => sum + (s.security_score ?? 0), 0) / completed.length,
      );
      for (const s of completed) {
        const bucket = scoreBucket(s.security_score ?? 0);
        scoreBuckets[bucket]++;
      }
    }
  }

  const orgRole = orgId ? await getUserOrgRole(user.id, orgId) : null;
  const effectivePlan = getEffectivePlan({
    email: user.email,
    plan: orgCtx.access.plan,
    subscription_status: orgCtx.access.status,
  });
  const planLabel = PLAN_LIMITS[effectivePlan]?.name ?? effectivePlan;
  const roleLabel =
    orgRole === "owner" ? "Owner" : orgRole === "admin" ? "Admin" : orgRole === "member" ? "Member" : orgRole ?? null;
  const maxBucket = Math.max(...Object.values(scoreBuckets), 1);
  const seatLimit = getSeatLimitForPlan(effectivePlan);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? "User"} title="Enterprise Overview" showPlanUsage={false} />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-8 flex items-center justify-between">
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

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Avg Score</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {avgScore !== null ? `${avgScore}/100` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Open Alerts</p>
            <p className="mt-2 text-3xl font-bold text-orange-400">{openAlerts}</p>
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

        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Risk Distribution</h3>
          <div className="space-y-3">
            {(
              [
                { key: "critical", label: "Critical (<50)", color: "bg-red-500", text: "text-red-400" },
                { key: "high", label: "High (50–69)", color: "bg-orange-500", text: "text-orange-400" },
                { key: "medium", label: "Medium (70–89)", color: "bg-yellow-500", text: "text-yellow-400" },
                { key: "low", label: "Low (90+)", color: "bg-green-500", text: "text-green-400" },
              ] as const
            ).map(({ key, label, color, text }) => {
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
                      <p className="text-xs text-gray-500">{new Date(scan.started_at).toLocaleString()}</p>
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
