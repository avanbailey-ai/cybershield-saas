"use client";

import { useState, useEffect, useCallback } from "react";
import ScanAllButton from "@/components/dashboard/ScanAllButton";
import { usePlan } from "@/lib/billing/usePlan";
import { getWebsiteUsageMessage } from "@/lib/billing/guards";
import { useConversion } from "@/components/conversion/ConversionProvider";

interface LatestScan {
  id: string;
  security_score: number | null;
  status: string;
  completed_at: string | null;
  started_at: string;
}

interface WebsiteRow {
  id: string;
  url: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  last_scanned_at: string | null;
  latestScan: LatestScan | null;
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

function scoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-green-500/10 text-green-400 border border-green-500/20";
  if (score >= 70) return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
  if (score >= 50) return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
  return "bg-red-500/10 text-red-400 border border-red-500/20";
}

export default function WebsiteList() {
  const { plan, limits, websiteCount, websitesRemaining, scansRemaining, scansToday, loading: planLoading } = usePlan();
  const { openUpgradeModal } = useConversion();
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const websiteLimitReached =
    !planLoading && limits.websites !== Infinity && websitesRemaining === 0;
  const scanLimitReached = !planLoading && scansRemaining === 0;
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ id: string; score: number } | null>(null);
  const [limitError, setLimitError] = useState<{ message: string; upgradeUrl: string } | null>(null);

  const fetchWebsites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/websites");
      if (!res.ok) throw new Error("Failed to load websites");
      const data = await res.json();
      setWebsites(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addUrl.trim(), label: addLabel.trim() || undefined }),
      });
      const data = await res.json();
      if (res.status === 403 && (data.error === 'WEBSITE_LIMIT_REACHED' || data.upgradeRequired)) {
        setUpgradeRequired(true);
        setUpgradeMessage(data.message ?? "Website limit reached.");
        setAddError(data.message ?? "Website limit reached.");
        openUpgradeModal({ trigger: 'add_website', recommendedPlan: plan === 'pro' ? 'growth' : 'agency' });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to add website");
      setAddUrl("");
      setAddLabel("");
      setShowAddForm(false);
      await fetchWebsites();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAdding(false);
    }
  }

  async function pollScanJob(jobId: string): Promise<{ score: number } | null> {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(`/api/scan?jobId=${encodeURIComponent(jobId)}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.done && typeof data.score === "number") {
        return { score: data.score };
      }
      if (data.done && data.status === "failed") {
        throw new Error(data.error ?? "Scan failed");
      }
    }
    return null;
  }

  async function handleScan(websiteId: string) {
    if (scanningId !== null) return;
    setScanningId(websiteId);
    setScanResult(null);
    setLimitError(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const data = await res.json();
      if (res.status === 403) {
        const isUsageLimit = data.error === "USAGE_LIMIT_REACHED";
        setLimitError({
          message: data.message ?? (isUsageLimit
            ? "Daily scan limit reached. Upgrade your plan to scan more."
            : "Website limit reached for your plan."),
          upgradeUrl: data.upgradeUrl ?? "/dashboard/settings",
        });
        return;
      }
      if (res.status === 429) {
        setError(data.error ?? "Scan skipped — site was scanned recently or rate limit reached");
        return;
      }
      if (res.status === 409) {
        setError(data.error ?? "Already queued — a scan for this site is already in progress");
        return;
      }
      if (res.status === 200 && data.already_queued && data.jobId) {
        const result = await pollScanJob(data.jobId);
        if (result) {
          setScanResult({ id: websiteId, score: result.score });
          await fetchWebsites();
        } else {
          setError("Scan is still running — refresh the page to see results");
        }
        return;
      }
      if (!res.ok && res.status !== 202) throw new Error(data.error ?? "Scan failed");

      // Cached recent scan
      if (data.cached && typeof data.score === "number") {
        setScanResult({ id: websiteId, score: data.score });
        await fetchWebsites();
        return;
      }

      // Async: poll for completion
      if (res.status === 202 && data.jobId) {
        const result = await pollScanJob(data.jobId);
        if (result) {
          setScanResult({ id: websiteId, score: result.score });
          await fetchWebsites();
        } else {
          setError("Scan is still running — refresh the page to see results");
        }
        return;
      }

      // Legacy synchronous response (if any)
      setScanResult({ id: websiteId, score: data.result?.score ?? data.scan?.security_score ?? data.score ?? 0 });
      await fetchWebsites();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanningId(null);
    }
  }

  async function handleDelete(websiteId: string) {
    if (!confirm("Delete this website and all its scan history?")) return;
    setDeletingId(websiteId);
    try {
      const res = await fetch(`/api/websites/${websiteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      await fetchWebsites();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Header bar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Websites</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage and scan your monitored websites.
            {!planLoading && (
              <span className="ml-2 text-gray-400">
                {getWebsiteUsageMessage(websiteCount, { id: "", plan })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {websites.length > 0 && (
            <ScanAllButton />
          )}
          <button
            onClick={() => {
              if (websiteLimitReached) {
                openUpgradeModal({ trigger: 'add_website', recommendedPlan: plan === 'pro' ? 'growth' : 'agency' });
                return;
              }
              setShowAddForm(!showAddForm);
              setAddError(null);
            }}
            disabled={websiteLimitReached && websiteCount === 0}
            title={websiteLimitReached ? (upgradeMessage ?? "Upgrade to add more websites") : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Website
          </button>
        </div>
      </div>

      {websiteLimitReached && !showAddForm && (
        <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
          {upgradeMessage ?? "You've reached your website limit."}{" "}
          <a href="/dashboard/settings" className="font-semibold underline hover:text-orange-300">
            Upgrade to add more websites.
          </a>
        </div>
      )}

      {/* Add website form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-white">Add New Website</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                URL <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Label <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="text"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="My Company Site"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          {addError && (
            <p className="mt-3 text-xs text-red-400">{addError}</p>
          )}
          {upgradeRequired && (
            <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
              {upgradeMessage ?? "You've reached your plan limit."}{" "}
              <a href="/dashboard/settings" className="font-semibold underline hover:text-orange-300">
                Upgrade to add more websites.
              </a>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add Website"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddError(null); }}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-300 underline">Dismiss</button>
        </div>
      )}

      {/* Scan result banner */}
      {scanResult && (
        <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-400">
          Scan complete! Security score: <strong>{scanResult.score}/100</strong>
          <button onClick={() => setScanResult(null)} className="ml-3 text-green-300 underline">Dismiss</button>
        </div>
      )}

      {/* Plan limit upgrade banner */}
      {limitError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="flex-1">{limitError.message}</span>
          <a href={limitError.upgradeUrl} className="font-semibold underline hover:text-orange-300 whitespace-nowrap">
            Upgrade plan →
          </a>
          <button onClick={() => setLimitError(null)} className="text-orange-300 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="ml-3 text-sm text-gray-500">Loading websites…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && websites.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-300">No websites yet</p>
          <p className="mt-1 text-xs text-gray-500">Click &quot;Add Website&quot; to start monitoring.</p>
        </div>
      )}

      {/* Websites list */}
      {!loading && websites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Website</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Score</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Scanned</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {websites.map((site) => (
                <tr key={site.id} className="bg-gray-900/20 transition-colors hover:bg-gray-800/30">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {site.label ?? new URL(site.url).hostname}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{site.url}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {site.latestScan?.security_score !== null && site.latestScan?.security_score !== undefined ? (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(site.latestScan.security_score)}`}>
                        {site.latestScan.security_score}/100
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">Not scanned</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-400">
                    {site.last_scanned_at ? timeAgo(site.last_scanned_at) : "Never"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleScan(site.id)}
                        disabled={scanningId === site.id || scanLimitReached}
                        title={scanLimitReached ? "Daily scan limit reached — upgrade for more scans" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-60"
                      >
                        {scanningId === site.id ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
                            Scanning…
                          </>
                        ) : (
                          <>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Scan Now
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(site.id)}
                        disabled={deletingId === site.id}
                        className="inline-flex items-center rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                      >
                        {deletingId === site.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
