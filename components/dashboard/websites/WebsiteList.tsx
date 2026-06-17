"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import ScanAllButton from "@/components/dashboard/ScanAllButton";
import { useUser } from '@/lib/auth/useUser';
import { useScanQueueRealtime, type ScanQueueJob } from "@/lib/scanner/useScanQueueRealtime";
import {
  isActiveScanStatus,
  isScanStale,
  scanStatusLabel,
  SCAN_UI_TIMEOUT_MS,
  SCAN_DELAYED_MESSAGE,
  SCAN_DELAYED_LABEL,
  SCAN_TIMEOUT_HINT,
} from "@/lib/scanner/scanStatus";
import { getWebsiteUsageMessage } from "@/lib/auth/permissions";
import { buildScanIdempotencyKey } from "@/lib/usage/idempotencyKey";
import QueueDemandBanner from "@/components/dashboard/QueueDemandBanner";

function isQueueJobStale(job: ScanQueueJob): boolean {
  const startedAt = job.started_at ?? job.created_at;
  return isActiveScanStatus(job.scanStatus) && isScanStale(startedAt, SCAN_UI_TIMEOUT_MS);
}

function scanProgressMessage(job: ScanQueueJob | null | undefined): string {
  if (!job || !isActiveScanStatus(job.scanStatus)) return "";
  const startedAt = job.started_at ?? job.created_at;
  const timedOut = isScanStale(startedAt, SCAN_UI_TIMEOUT_MS);
  return scanStatusLabel(job.scanStatus, timedOut);
}



interface LatestQueueJob {

  id: string;

  status: string;

  domain: string | null;

  result: { score?: number; scanId?: string; error?: string } | null;

  error: string | null;

  created_at: string;

  completed_at: string | null;

}



interface WebsiteRow {

  id: string;

  url: string;

  label: string | null;

  is_active: boolean;

  priority_monitoring: boolean;

  created_at: string;

  last_scanned_at: string | null;

  latestQueueJob: LatestQueueJob | null;

  recentScores?: number[];

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



function scoreTrendText(scores: number[] | undefined): string | null {
  if (!scores || scores.length < 2) return null;
  const delta = scores[0] - scores[1];
  if (delta === 0) return 'No change vs last scan';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} vs last scan`;
}

function ScoreSparkline({ scores }: { scores: number[] }) {
  const recent = scores.slice(0, 3).reverse();
  if (recent.length < 2) return null;
  const min = Math.min(...recent, 0);
  const max = Math.max(...recent, 100);
  const range = max - min || 1;
  const points = recent
    .map((s, i) => {
      const x = (i / (recent.length - 1)) * 40;
      const y = 12 - ((s - min) / range) * 10;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width="44" height="14" className="ml-1 inline-block opacity-70" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default function WebsiteList() {

  const router = useRouter();
  const {
    id: userId,
    plan,
    effectivePlan,
    limits,
    websiteCount,
    websitesRemaining,
    loading: planLoading,
    refresh: refreshPlan,
    priorityMonitoring,
  } = useUser();

  const priorityEligible = priorityMonitoring?.eligible === true;
  const prioritySlotsUsed = priorityMonitoring?.used ?? 0;
  const prioritySlotsLimit = priorityMonitoring?.limit ?? 25;
  const prioritySlotsFull = priorityEligible && prioritySlotsUsed >= prioritySlotsLimit;

  const { getWebsiteJob, getActiveJob, jobsByWebsite } = useScanQueueRealtime(userId || null);

  const [websites, setWebsites] = useState<WebsiteRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const websiteLimitReached =

    !planLoading && limits.websites !== Infinity && websitesRemaining === 0;

  const [showAddForm, setShowAddForm] = useState(false);

  const [addUrl, setAddUrl] = useState("");

  const [addLabel, setAddLabel] = useState("");

  const [adding, setAdding] = useState(false);

  const [addError, setAddError] = useState<string | null>(null);

  const [scanningId, setScanningId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [limitError, setLimitError] = useState<string | null>(null);

  const [queueWarning, setQueueWarning] = useState(false);

  const [completedScanIds, setCompletedScanIds] = useState<Map<string, string>>(new Map());

  const [delayedRetryWebsiteId, setDelayedRetryWebsiteId] = useState<string | null>(null);

  const [priorityUpdatingId, setPriorityUpdatingId] = useState<string | null>(null);

  const [priorityError, setPriorityError] = useState<string | null>(null);

  const scanningRef = useRef<string | null>(null);

  const scanIdempotencyRef = useRef<Map<string, string>>(new Map());

  const scanSessionRef = useRef<{
    websiteId: string;
    startedAt: number;
    sawActive: boolean;
  } | null>(null);

  const prevJobsByWebsiteRef = useRef<Map<string, ScanQueueJob>>(new Map());



  const fetchWebsites = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const res = await fetch("/api/websites");

      if (!res.ok) throw new Error("Failed to load websites");

      const data = await res.json();

      setWebsites(

        (Array.isArray(data) ? data : []).map((w: WebsiteRow) => ({

          ...w,

          priority_monitoring: w.priority_monitoring === true,

        })),

      );

    } catch (e) {

      setError(e instanceof Error ? e.message : "Unknown error");

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    fetchWebsites();

  }, [fetchWebsites]);

  useEffect(() => {
    if (!loading && websites.length === 0) {
      setShowAddForm(true);
    }
  }, [loading, websites.length]);



  // Clear scanning spinner when realtime reports completion or failure for THIS scan session.
  // Ignore pre-existing completed rows that appear before the new pending scan is subscribed.

  useEffect(() => {

    if (!scanningId) return;

    const session = scanSessionRef.current;

    if (!session || session.websiteId !== scanningId) return;

    const job = getWebsiteJob(scanningId);

    if (!job) return;



    if (isActiveScanStatus(job.scanStatus)) {

      session.sawActive = true;

      return;

    }



    const isCompleted = job.status === "completed" || job.scanStatus === "completed";

    const isFailed = job.status === "failed" || job.scanStatus === "failed";

    const isStale = isQueueJobStale(job);



    if (!isCompleted && !isFailed && !isStale) return;

    if (!jobBelongsToScanSession(job, session)) return;



    if (isCompleted) {

      scanningRef.current = null;

      setScanningId(null);

      scanIdempotencyRef.current.delete(scanningId);

      scanSessionRef.current = null;

      const scanId = job.result?.scanId ?? job.id;
      if (scanId) {
        setCompletedScanIds((prev) => new Map(prev).set(scanningId, scanId));
      }

      router.refresh();
      void refreshPlan();

    } else {

      setError(
        isFailed
          ? (job.result?.error ?? job.error ?? "Scan failed")
          : SCAN_DELAYED_MESSAGE,
      );

      if (isStale) {
        setDelayedRetryWebsiteId(scanningId);
      }

      scanningRef.current = null;

      setScanningId(null);

      scanIdempotencyRef.current.delete(scanningId);

      scanSessionRef.current = null;

    }

  }, [scanningId, getWebsiteJob, router, refreshPlan]);



  // Fallback: clear stuck scanning UI after 2 minutes

  useEffect(() => {

    if (!scanningId) return;

    const timer = setTimeout(() => {

      const job = getWebsiteJob(scanningId);

      if (!job || isActiveScanStatus(job.scanStatus)) {

        setError(SCAN_DELAYED_MESSAGE);

        setDelayedRetryWebsiteId(scanningId);

        scanningRef.current = null;

        setScanningId(null);

        scanIdempotencyRef.current.delete(scanningId);

        scanSessionRef.current = null;

      }

    }, SCAN_UI_TIMEOUT_MS);

    return () => clearTimeout(timer);

  }, [scanningId, getWebsiteJob]);



  // Refresh list when scheduled (cron) or manual scans complete via realtime

  useEffect(() => {

    let shouldRefresh = false;

    for (const [websiteId, job] of jobsByWebsite) {

      const prev = prevJobsByWebsiteRef.current.get(websiteId);

      if (
        (job.status === 'completed' || job.scanStatus === 'completed') &&
        (prev?.status === 'pending' || prev?.status === 'processing' ||
          prev?.scanStatus === 'pending' || prev?.scanStatus === 'running')
      ) {

        shouldRefresh = true;

      }

    }

    prevJobsByWebsiteRef.current = new Map(jobsByWebsite);

    if (shouldRefresh) {

      void fetchWebsites();

      router.refresh();
      void refreshPlan();

    }

  }, [jobsByWebsite, fetchWebsites, router, refreshPlan]);



  function clearScanState(websiteId: string) {

    scanningRef.current = null;

    setScanningId(null);

    setDelayedRetryWebsiteId(null);

    scanIdempotencyRef.current.delete(websiteId);

    if (scanSessionRef.current?.websiteId === websiteId) {
      scanSessionRef.current = null;
    }

  }

  function jobBelongsToScanSession(job: ScanQueueJob, session: NonNullable<typeof scanSessionRef.current>): boolean {
    if (session.sawActive) return true;
    const jobStartMs = new Date(job.started_at ?? job.created_at).getTime();
    return jobStartMs >= session.startedAt - 3000;
  }



  async function retryDelayedScan(websiteId: string) {

    setError(null);

    setDelayedRetryWebsiteId(null);

    try {

      await fetch("/api/scan/process-pending", { method: "POST" });

    } catch {

      /* non-fatal — handleScan will enqueue/process again */

    }

    await handleScan(websiteId);

  }



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

        return;

      }

      if (!res.ok) throw new Error(data.error ?? "Failed to add website");

      setAddUrl("");

      setAddLabel("");

      setShowAddForm(false);

      await fetchWebsites();
      void refreshPlan();

      if (data.jobId) {

        setScanningId(data.id);

      }

    } catch (e) {

      setAddError(e instanceof Error ? e.message : "Unknown error");

    } finally {

      setAdding(false);

    }

  }



  async function handleScan(websiteId: string) {

    if (scanningRef.current === websiteId) return;

    scanningRef.current = websiteId;

    setScanningId(websiteId);

    scanSessionRef.current = {
      websiteId,
      startedAt: Date.now(),
      sawActive: false,
    };

    setLimitError(null);

    const idempotencyKey =

      scanIdempotencyRef.current.get(websiteId) ?? buildScanIdempotencyKey(userId ?? websiteId, websiteId);

    scanIdempotencyRef.current.set(websiteId, idempotencyKey);

    try {

      const res = await fetch("/api/scan", {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          "Idempotency-Key": idempotencyKey,

        },

        body: JSON.stringify({ websiteId }),

      });

      const data = await res.json();

      if (res.status === 403) {

        setLimitError(

          data.message ?? data.error ?? "You've reached your scan limit.",

        );

        clearScanState(websiteId);

        return;

      }



      if (res.status === 503 || data.error === "QUEUE_BUSY") {

        setError(data.message ?? "Scan queue is at capacity — try again shortly.");

        clearScanState(websiteId);

        return;

      }

      if (res.status === 429) {

        setError(data.error ?? "Scan skipped — site was scanned recently or rate limit reached");

        clearScanState(websiteId);

        return;

      }

      if (res.status === 409) {

        setError(data.error ?? "Already queued — a scan for this site is already in progress");

        clearScanState(websiteId);

        return;

      }

      if (res.status === 200 && (data.already_queued || data.duplicate)) {
        void fetch("/api/scan/process-pending", { method: "POST" });
        return;
      }

      if (!res.ok && res.status !== 202) {

        throw new Error(data.error ?? "Scan failed");

      }



      // Cached recent scan (cooldown bypass with existing result)

      if (data.cached && typeof data.score === "number") {

        clearScanState(websiteId);

        router.refresh();
        void refreshPlan();

        return;

      }



      // Enqueued — realtime subscription delivers completion (no polling)

      if (res.status === 202 || data.queued) {

        if (data.queueWarning) {

          setQueueWarning(true);

        }

        void fetch("/api/scan/process-pending", { method: "POST" });

        return;

      }



      clearScanState(websiteId);

    } catch (e) {

      setError(e instanceof Error ? e.message : "Scan failed");

      scanningRef.current = null;

      setScanningId(null);

      scanIdempotencyRef.current.delete(websiteId);

      scanSessionRef.current = null;

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
      void refreshPlan();

    } catch (e) {

      setError(e instanceof Error ? e.message : "Delete failed");

    } finally {

      setDeletingId(null);

    }

  }



  async function handlePriorityToggle(websiteId: string, enabled: boolean) {

    setPriorityUpdatingId(websiteId);

    setPriorityError(null);

    try {

      const res = await fetch(`/api/websites/${websiteId}/priority-monitoring`, {

        method: "PATCH",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ enabled }),

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data.error ?? "Failed to update priority monitoring");

      }

      setWebsites((prev) =>

        prev.map((w) =>

          w.id === websiteId ? { ...w, priority_monitoring: enabled } : w,

        ),

      );

      void refreshPlan();

    } catch (e) {

      setPriorityError(e instanceof Error ? e.message : "Failed to update priority monitoring");

    } finally {

      setPriorityUpdatingId(null);

    }

  }



  function resolveWebsiteDisplay(site: WebsiteRow) {

    const scanJob = getWebsiteJob(site.id);
    const liveJob = scanJob ?? site.latestQueueJob;

    const activeJob = getActiveJob(site.id);

    const staleJob = scanJob && isQueueJobStale(scanJob);

    const isScanning = (scanningId === site.id || !!activeJob) && !staleJob;

    const isDelayed = staleJob || delayedRetryWebsiteId === site.id;

    const score =
      scanJob?.scanStatus === "completed" && typeof scanJob.result?.score === "number"
        ? scanJob.result.score
        : site.latestQueueJob?.status === "completed" &&
            typeof site.latestQueueJob.result?.score === "number"
          ? site.latestQueueJob.result.score
          : null;

    const lastScannedAt =

      liveJob?.completed_at ?? site.last_scanned_at;

    return { scanJob, liveJob, isScanning, isDelayed, score, lastScannedAt };

  }



  return (

    <div>

      {/* Header bar */}

      <div className="mb-6 flex items-center justify-between">

        <div>

          <h2 className="text-xl font-bold text-white">Websites</h2>

          <p className="mt-1 text-sm text-gray-500">

            Add a site, then click Scan to check its security.

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

              setShowAddForm(!showAddForm);

              setAddError(null);

            }}

            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"

          >

            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>

              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />

            </svg>

            Add Website

          </button>

        </div>

      </div>



      {priorityEligible && (

        <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-gray-300">

          <p>

            <span className="font-medium text-white">Priority monitoring slots:</span>{" "}

            {prioritySlotsUsed} / {prioritySlotsLimit} used

          </p>

          <p className="mt-1 text-xs text-gray-500">

            Agency includes {prioritySlotsLimit} priority slots. Priority websites are checked every 5 minutes. Non-priority websites are checked hourly.

          </p>

        </div>

      )}



      {!priorityEligible && !planLoading && effectivePlan !== "agency" && plan !== "agency" && (

        <p className="mb-4 text-xs text-gray-600">

          Priority 5-minute monitoring is available on Agency plans.

        </p>

      )}



      {priorityError && (

        <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">

          {priorityError}

          <button type="button" onClick={() => setPriorityError(null)} className="ml-3 underline">

            Dismiss

          </button>

        </div>

      )}



      {websiteLimitReached && !showAddForm && (

        <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">

          {upgradeMessage ?? "You've reached your website limit."}{" "}

          <a href="/app/settings" className="font-semibold underline hover:text-orange-300">

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

          <h3 className="mb-4 text-sm font-semibold text-white">
            {websites.length === 0 ? 'Add your website to run your first scan' : 'Add New Website'}
          </h3>

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

              <a href="/app/settings" className="font-semibold underline hover:text-orange-300">

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

              {adding ? "Adding…" : websites.length === 0 ? "Add & scan" : "Add Website"}

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

          {error === SCAN_DELAYED_MESSAGE && delayedRetryWebsiteId && (

            <button
              type="button"
              onClick={() => void retryDelayedScan(delayedRetryWebsiteId)}
              className="ml-3 font-semibold text-red-300 underline hover:text-red-200"
            >
              Retry scan now
            </button>

          )}

          <button
            onClick={() => {
              setError(null);
              setDelayedRetryWebsiteId(null);
            }}
            className="ml-3 text-red-300 underline"
          >
            Dismiss
          </button>

        </div>

      )}



      {/* Scan limit banner (inline only — no modal) */}

      {limitError && (

        <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">

          <span className="flex-1">{limitError}</span>

          <a href="/app/settings" className="font-semibold underline hover:text-orange-300 whitespace-nowrap">

            Upgrade plan →

          </a>

          <button onClick={() => setLimitError(null)} className="text-orange-300 underline text-xs">Dismiss</button>

        </div>

      )}



      <QueueDemandBanner show={queueWarning} onDismiss={() => setQueueWarning(false)} />



      {/* Loading state */}

      {loading && (

        <div className="flex items-center justify-center py-16">

          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />

          <span className="ml-3 text-sm text-gray-500">Loading websites…</span>

        </div>

      )}



      {/* Empty state */}

      {!loading && websites.length === 0 && !showAddForm && (

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16 text-center">

          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.105.223-2.152.623-3.093" />
            </svg>
          </div>

          <p className="text-sm font-medium text-gray-300">No websites yet</p>

          <p className="mt-1 max-w-sm text-xs text-gray-500">
            Add your site URL to run your first security scan. {SCAN_TIMEOUT_HINT}.
          </p>

          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Add your first website
          </button>

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

                {priorityEligible && (

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">

                    Priority 5-min

                  </th>

                )}

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-gray-800">

              {websites.map((site) => {

                const { scanJob, liveJob, isScanning, isDelayed, score, lastScannedAt } = resolveWebsiteDisplay(site);

                return (

                <tr key={site.id} className="bg-gray-900/20 transition-colors hover:bg-gray-800/30">

                  <td className="px-5 py-4">

                    <div>

                      <p className="text-sm font-medium text-white">

                        {site.label ?? new URL(site.url).hostname}

                      </p>

                      <p className="mt-0.5 truncate text-xs text-gray-500">{site.url}</p>

                      {scanJob && scanJob.scanStatus === "failed" && (

                        <p className="mt-1 text-xs text-red-400">

                          {scanJob.result?.error ?? scanJob.error ?? "Scan failed"}

                        </p>

                      )}

                      {scanJob && isActiveScanStatus(scanJob.scanStatus) && !isDelayed && (

                        <p className="mt-1 text-xs text-blue-400/80">

                          {scanProgressMessage(scanJob)}

                        </p>

                      )}

                      {isDelayed && (

                        <p className="mt-1 text-xs text-orange-400">

                          {SCAN_DELAYED_LABEL} —{' '}

                          <button
                            type="button"
                            onClick={() => void retryDelayedScan(site.id)}
                            className="font-semibold underline hover:text-orange-300"
                          >
                            retry scan
                          </button>

                        </p>

                      )}

                    </div>

                  </td>

                  <td className="px-5 py-4">

                    {score !== null ? (

                      <div className="flex flex-col gap-0.5">

                        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(score)}`}>

                          {score}/100

                          {site.recentScores && site.recentScores.length > 1 && (

                            <ScoreSparkline scores={site.recentScores} />

                          )}

                        </span>

                        {scoreTrendText(site.recentScores) && (

                          <span className={`text-xs ${

                            (site.recentScores![0] - site.recentScores![1]) > 0

                              ? 'text-green-400'

                              : (site.recentScores![0] - site.recentScores![1]) < 0

                                ? 'text-red-400'

                                : 'text-gray-500'

                          }`}>

                            {scoreTrendText(site.recentScores)}

                          </span>

                        )}

                        {completedScanIds.get(site.id) && (
                          <a
                            href={`/report/${completedScanIds.get(site.id)}`}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            View report →
                          </a>
                        )}

                      </div>

                    ) : isScanning ? (

                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">

                        <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />

                        {scanProgressMessage(scanJob) || "Scanning…"}

                      </span>

                    ) : isDelayed ? (

                      <span className="text-xs text-orange-400">Scan delayed</span>

                    ) : (

                      <span className="text-xs text-gray-600">Not scanned</span>

                    )}

                  </td>

                  <td className="px-5 py-4 text-sm text-gray-400">

                    {lastScannedAt ? timeAgo(lastScannedAt) : "Never"}

                  </td>



                  {priorityEligible && (

                    <td className="px-5 py-4">

                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-400">

                        <input

                          type="checkbox"

                          checked={site.priority_monitoring === true}

                          disabled={

                            priorityUpdatingId === site.id ||

                            (!site.priority_monitoring && prioritySlotsFull)

                          }

                          onChange={(e) => void handlePriorityToggle(site.id, e.target.checked)}

                          className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"

                        />

                        {site.priority_monitoring ? "Priority" : "Hourly"}

                      </label>

                      {!site.priority_monitoring && prioritySlotsFull && (

                        <p className="mt-1 text-xs text-orange-400">No slots left</p>

                      )}

                    </td>

                  )}



                  <td className="px-5 py-4 text-right">

                    <div className="flex items-center justify-end gap-2">

                      <button

                        type="button"

                        onClick={() => void handleScan(site.id)}

                        disabled={isScanning}

                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-60"

                      >

                        {isScanning ? (

                          <>

                            <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />

                            {scanProgressMessage(scanJob) || "Scanning…"}

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

              );

              })}

            </tbody>

          </table>

        </div>

      )}

    </div>

  );

}


