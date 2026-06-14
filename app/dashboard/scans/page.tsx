import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export const metadata: Metadata = {
  title: "Scans — CyberShield",
};

function scoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-green-500/10 text-green-400 border border-green-500/20";
  if (score >= 70) return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
  if (score >= 50) return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
  return "bg-red-500/10 text-red-400 border border-red-500/20";
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed": return "bg-green-500/10 text-green-400 border border-green-500/20";
    case "running":   return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    case "failed":    return "bg-red-500/10 text-red-400 border border-red-500/20";
    default:          return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ScanRow {
  id: string;
  website_id: string;
  started_at: string;
  completed_at: string | null;
  security_score: number | null;
  ssl_valid: boolean | null;
  status: string;
  error_message: string | null;
  explanation: string | null;
  issues: string[] | null;
  passed: string[] | null;
  vulnerabilities_count: number | null;
  websites: { url: string; label: string | null } | null;
}

export default async function ScansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: scans } = await supabase
    .from("scans")
    .select(`
      id, website_id, started_at, completed_at, security_score, ssl_valid, status,
      error_message, explanation, issues, passed, vulnerabilities_count,
      websites(url, label)
    `)
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  const rows = (scans ?? []) as unknown as ScanRow[];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? "User"} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Scans</h2>
          <p className="mt-1 text-sm text-gray-500">
            History of all security scans across your monitored websites.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-300">No scans yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Go to Websites and click &quot;Scan Now&quot; to run your first scan.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((scan) => {
              const site = scan.websites;
              const issues = scan.issues ?? [];
              const passed = scan.passed ?? [];

              return (
                <div key={scan.id} className="rounded-xl border border-gray-800 bg-gray-900/20 p-5 transition-colors hover:bg-gray-800/30">
                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        {site?.label ?? (site?.url ? (() => { try { return new URL(site.url).hostname } catch { return site.url } })() : "Unknown")}
                      </p>
                      {site?.label && site?.url && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{site.url}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {scan.security_score !== null ? (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(scan.security_score)}`}>
                          {scan.security_score}/100
                        </span>
                      ) : null}
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(scan.status)}`}>
                        {scan.status}
                      </span>
                      {scan.ssl_valid !== null && (
                        <span className={`text-xs ${scan.ssl_valid ? "text-green-400" : "text-red-400"}`}>
                          {scan.ssl_valid ? "✓ SSL" : "✗ SSL"}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {scan.completed_at ? timeAgo(scan.completed_at) : timeAgo(scan.started_at)}
                      </span>
                    </div>
                  </div>

                  {/* Explanation */}
                  {scan.explanation && (
                    <p className="mt-2 text-sm text-gray-400">{scan.explanation}</p>
                  )}

                  {/* Stats */}
                  {(issues.length > 0 || passed.length > 0 || scan.vulnerabilities_count !== null) && (
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      {passed.length > 0 && (
                        <span>
                          <span className="font-medium text-green-400">{passed.length}</span> passed
                        </span>
                      )}
                      {issues.length > 0 && (
                        <span>
                          <span className="font-medium text-red-400">{issues.length}</span> issues
                        </span>
                      )}
                      {(scan.vulnerabilities_count ?? 0) > 0 && (
                        <span>
                          <span className="font-medium text-orange-400">{scan.vulnerabilities_count}</span> vulns
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expandable issues */}
                  {issues.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-red-400 hover:text-red-300">
                        Show {issues.length} issue{issues.length !== 1 ? "s" : ""}
                      </summary>
                      <ul className="mt-2 space-y-1 pl-1">
                        {issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                            <span className="mt-0.5 shrink-0 text-red-500">✗</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Expandable passed */}
                  {passed.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-green-400 hover:text-green-300">
                        Show {passed.length} passed check{passed.length !== 1 ? "s" : ""}
                      </summary>
                      <ul className="mt-2 space-y-1 pl-1">
                        {passed.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                            <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Error message */}
                  {scan.error_message && (
                    <p className="mt-2 text-xs text-red-400">Error: {scan.error_message}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
