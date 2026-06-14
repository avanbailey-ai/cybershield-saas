import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import type { HeaderChecks } from "@/types";

export const metadata: Metadata = {
  title: "Reports — CyberShield",
};

function scoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-green-500/10 text-green-400 border border-green-500/20";
  if (score >= 70) return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
  if (score >= 50) return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
  return "bg-red-500/10 text-red-400 border border-red-500/20";
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

interface ScanReport {
  id: string;
  security_score: number | null;
  ssl_valid: boolean | null;
  issues: string[] | null;
  passed: string[] | null;
  explanation: string | null;
  completed_at: string | null;
  started_at: string;
  headers: HeaderChecks | null;
  websites: { url: string; label: string | null } | null;
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rawScans } = await supabase
    .from("scans")
    .select("id, security_score, ssl_valid, issues, passed, explanation, completed_at, started_at, headers, websites(url, label)")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(10);

  const scans = (rawScans ?? []) as unknown as ScanReport[];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? ""} title="Reports" />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Security Reports</h2>
          <p className="mt-1 text-sm text-gray-500">
            Detailed security reports generated from your website scans.
          </p>
        </div>

        {scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800/60 text-gray-500">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-200">No reports yet</p>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Reports are automatically generated after security scans complete. Add a website and
              run your first scan to see your security report here.
            </p>
            <Link
              href="/dashboard/websites"
              className="mt-6 inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              Go to Websites
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => {
              const site = scan.websites;
              const issues = scan.issues ?? [];
              const passed = scan.passed ?? [];

              return (
                <div
                  key={scan.id}
                  className="rounded-xl border border-gray-800 bg-gray-900/50 p-5"
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {site?.label ?? (site?.url ? (() => { try { return new URL(site.url).hostname } catch { return site.url } })() : "Unknown")}
                      </p>
                      {site?.label && site?.url && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{site.url}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {scan.security_score !== null && (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(scan.security_score)}`}>
                          {scan.security_score}/100
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-xs ${scan.ssl_valid ? "text-green-400" : "text-red-400"}`}>
                        {scan.ssl_valid ? "✓" : "✗"} SSL
                      </span>
                      <span className="text-xs text-gray-500">
                        {scan.completed_at ? timeAgo(scan.completed_at) : timeAgo(scan.started_at)}
                      </span>
                    </div>
                  </div>

                  {/* Explanation */}
                  {scan.explanation && (
                    <p className="mt-3 text-sm text-gray-400">{scan.explanation}</p>
                  )}

                  {/* Stats row */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      <span className="text-green-400 font-medium">{passed.length}</span> passed
                    </span>
                    <span>
                      <span className="text-red-400 font-medium">{issues.length}</span> issues
                    </span>
                  </div>

                  {/* Expandable issues */}
                  {issues.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-red-400 hover:text-red-300">
                        Show {issues.length} issue{issues.length !== 1 ? "s" : ""}
                      </summary>
                      <ul className="mt-2 space-y-1">
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
                      <ul className="mt-2 space-y-1">
                        {passed.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                            <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </details>
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
