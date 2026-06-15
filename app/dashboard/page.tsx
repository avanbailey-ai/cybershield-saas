import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import StatCard from "@/components/dashboard/StatCard";
import type { DashboardStats, HeaderChecks, RiskLevel } from "@/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

function scoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-green-500/10 text-green-400 border-green-500/20";
  if (score >= 70) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  if (score >= 50) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  return "bg-red-500/10 text-red-400 border-red-500/20";
}

function riskBadgeClass(level: RiskLevel | null): string {
  switch (level) {
    case 'critical': return "bg-red-500/10 text-red-400 border-red-500/20";
    case 'high': return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case 'medium': return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case 'low': return "bg-green-500/10 text-green-400 border-green-500/20";
    default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function headerCheckPassed(headers: HeaderChecks | null, key: string): boolean {
  if (!headers) return false;
  const map: Record<string, keyof HeaderChecks> = {
    "content-security-policy": "csp",
    "strict-transport-security": "hsts",
    "x-frame-options": "xFrame",
    "x-content-type-options": "xContentType",
    "referrer-policy": "referrerPolicy",
    "permissions-policy": "permissionsPolicy",
  };
  const prop = map[key];
  if (!prop) return false;
  return headers[prop] === true;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [websitesRes, scansRes] = await Promise.all([
    supabase.from("websites").select("id").eq("user_id", user.id),
    supabase
      .from("scans")
      .select("id, website_id, security_score, risk_score, risk_level, status, completed_at, started_at, headers, explanation, websites(url, label)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  const websiteCount = websitesRes.data?.length ?? 0;
  const allScans = scansRes.data ?? [];

  // Additional metrics queries
  const [allCompletedScansRes, criticalAlertsRes] = await Promise.all([
    supabase
      .from("scans")
      .select("security_score")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("security_score", "is", null)
      .order("completed_at", { ascending: false })
      .limit(100),
    supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("severity", "critical")
      .eq("is_read", false),
  ]);

  const completedScansAll = allCompletedScansRes.data ?? [];
  const avgScore =
    completedScansAll.length > 0
      ? Math.round(
          completedScansAll.reduce((sum, s) => sum + (s.security_score ?? 0), 0) /
            completedScansAll.length
        )
      : null;
  const criticalAlertCount = criticalAlertsRes.count ?? 0;
  const totalScansRun = completedScansAll.length;

  // Latest completed scan per website
  const latestScanPerWebsite = new Map<string, typeof allScans[number]>();
  for (const scan of allScans) {
    if (scan.status === "completed" && !latestScanPerWebsite.has(scan.website_id)) {
      latestScanPerWebsite.set(scan.website_id, scan);
    }
  }

  const latestScan = allScans[0] ?? null;
  const latestSiteRaw = latestScan?.websites as unknown;
  const latestSite = (Array.isArray(latestSiteRaw) ? latestSiteRaw[0] : latestSiteRaw) as {
    url: string;
    label: string | null;
  } | null;

  const lastScanSummary = latestScan
    ? {
        websiteLabel: latestSite?.label ?? latestSite?.url ?? "Website",
        status: latestScan.status,
        score: latestScan.security_score,
        completedAt: latestScan.completed_at,
        scanId: latestScan.id,
      }
    : null;

  const recentScans = allScans.slice(0, 5).map((s) => {
    const siteRaw = s.websites as unknown;
    const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as { url: string; label: string | null } | null;
    return {
      id: s.id,
      website_url: site?.url ?? "",
      website_label: site?.label ?? null,
      security_score: s.security_score,
      risk_score: s.risk_score as number | null,
      risk_level: s.risk_level as RiskLevel | null,
      status: s.status,
      completed_at: s.completed_at,
      started_at: s.started_at,
      explanation: s.explanation as string | null,
    };
  });

  const headerCheckDefs: DashboardStats["securityOverview"] = [
    { key: "content-security-policy", label: "Content-Security-Policy", pass: 0, fail: 0, total: 0 },
    { key: "strict-transport-security", label: "Strict-Transport-Security (HSTS)", pass: 0, fail: 0, total: 0 },
    { key: "x-frame-options", label: "X-Frame-Options", pass: 0, fail: 0, total: 0 },
    { key: "x-content-type-options", label: "X-Content-Type-Options", pass: 0, fail: 0, total: 0 },
    { key: "referrer-policy", label: "Referrer-Policy", pass: 0, fail: 0, total: 0 },
    { key: "permissions-policy", label: "Permissions-Policy", pass: 0, fail: 0, total: 0 },
  ];

  for (const scan of latestScanPerWebsite.values()) {
    const headers = scan.headers as HeaderChecks | null;
    for (const item of headerCheckDefs) {
      item.total++;
      if (headerCheckPassed(headers, item.key)) item.pass++;
      else item.fail++;
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? "User"} />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">
            Welcome back,{" "}
            <span className="text-blue-400">{user.email?.split("@")[0] ?? "User"}</span>
          </h2>
        </div>

        <DashboardOverview
          websiteCount={websiteCount}
          lastScan={lastScanSummary}
          criticalAlertCount={criticalAlertCount}
        />

        {totalScansRun > 0 && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatCard
              title="Avg Security Score"
              value={avgScore !== null ? `${avgScore}/100` : "—"}
              description={`Across ${totalScansRun} completed scan${totalScansRun !== 1 ? "s" : ""}`}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
            />
            <StatCard
              title="Websites Monitored"
              value={String(websiteCount)}
              description={`${websiteCount} site${websiteCount !== 1 ? "s" : ""} tracked`}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        )}

        {/* Bottom panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
              {recentScans.length > 0 && (
                <Link href="/app/scans" className="text-xs text-blue-400 hover:text-blue-300">
                  View all
                </Link>
              )}
            </div>

            {recentScans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-800 bg-gray-800/60 text-gray-500">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-300">No activity yet</p>
                <p className="mt-1 text-xs text-gray-500">Add your first website to start monitoring.</p>
                <Link
                  href="/app/websites"
                  className="mt-5 inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
                >
                  Add Website
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentScans.map((scan) => (
                  <li
                    key={scan.id}
                    className="flex items-start justify-between rounded-lg bg-gray-800/40 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-200">
                        {scan.website_label ?? scan.website_url}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {scan.explanation
                          ? scan.explanation.length > 150
                            ? scan.explanation.slice(0, 150) + "..."
                            : scan.explanation
                          : scan.security_score !== null
                          ? `Score of ${scan.security_score}/100 — view report for details`
                          : null}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-gray-600">
                          {scan.completed_at ? timeAgo(scan.completed_at) : scan.status}
                        </p>
                        {scan.status === "completed" && (
                          <Link href={`/report/${scan.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                            View Report →
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 mt-0.5 flex shrink-0 flex-col items-end gap-1">
                      {scan.risk_level ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${riskBadgeClass(scan.risk_level)}`}>
                          {scan.risk_level}
                        </span>
                      ) : scan.security_score !== null ? (
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${scoreBadgeClass(scan.security_score)}`}>
                          {scan.security_score}/100
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 capitalize">{scan.status}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Security Overview */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-white">Security Headers Overview</h3>
            </div>

            {headerCheckDefs[0].total === 0 ? (
              <>
                <ul className="mb-5 space-y-3">
                  {headerCheckDefs.map((check) => (
                    <li key={check.key} className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3">
                      <span className="text-sm text-gray-300">{check.label}</span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                        Not checked
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-center text-xs text-gray-600">Run your first scan to see header analysis.</p>
              </>
            ) : (
              <ul className="space-y-3">
                {headerCheckDefs.map((check) => {
                  const allPass = check.pass === check.total;
                  const nonePass = check.pass === 0;
                  return (
                    <li key={check.key} className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3">
                      <span className="text-sm text-gray-300">{check.label}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${allPass ? "text-green-400" : nonePass ? "text-red-400" : "text-yellow-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${allPass ? "bg-green-400" : nonePass ? "bg-red-400" : "bg-yellow-400"}`} />
                        {check.pass}/{check.total} pass
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
