'use client';

import Link from 'next/link';
import { useUser } from '@/lib/auth/useUser';
import { useScanQueueRealtime, type ScanQueueJob } from '@/lib/scanner/useScanQueueRealtime';
import {
  isActiveScanStatus,
  isScanStale,
  mapScanStatusToDisplay,
  scanStatusLabel,
  SCAN_UI_TIMEOUT_MS,
  SCAN_TIMEOUT_HINT,
} from '@/lib/scanner/scanStatus';

function effectiveJobStatus(job: ScanQueueJob): ScanQueueJob['status'] | 'failed' {
  const startedAt = job.started_at ?? job.created_at;
  if (isActiveScanStatus(job.scanStatus) && isScanStale(startedAt, SCAN_UI_TIMEOUT_MS)) {
    return 'failed';
  }
  return job.status;
}

function scoreBadgeClass(score: number): string {
  if (score >= 90) return 'bg-green-500/10 text-green-400 border border-green-500/20';
  if (score >= 70) return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
  if (score >= 50) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
  return 'bg-red-500/10 text-red-400 border border-red-500/20';
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 text-green-400 border border-green-500/20';
    case 'processing':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    case 'failed':
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function JobRow({ job }: { job: ScanQueueJob }) {
  const status = effectiveJobStatus(job);
  const score = job.result?.score;
  const errorMsg = job.result?.error ?? job.error;
  const label = job.domain ?? 'Monitored website';
  const startedAt = job.started_at ?? job.created_at;
  const timedOut =
    status === 'failed' && isActiveScanStatus(job.scanStatus) && isScanStale(startedAt, SCAN_UI_TIMEOUT_MS);
  const displayLabel = mapScanStatusToDisplay(job.scanStatus);
  const progressLabel = isActiveScanStatus(job.scanStatus)
    ? scanStatusLabel(job.scanStatus, isScanStale(startedAt, SCAN_UI_TIMEOUT_MS))
    : displayLabel;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-5 transition-colors hover:bg-gray-800/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white">{label}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Started {timeAgo(job.started_at ?? job.created_at)}
            {job.completed_at ? ` · finished ${timeAgo(job.completed_at)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {typeof score === 'number' && (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(score)}`}>
              {score}/100
            </span>
          )}
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(status)}`}>
            {status === 'processing' && (
              <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            )}
            {displayLabel}
          </span>
          {status === 'completed' && job.result?.scanId && (
            <Link href={`/report/${job.result.scanId}`} className="text-xs text-blue-400 hover:text-blue-300">
              View report →
            </Link>
          )}
        </div>
      </div>
      {errorMsg && status === 'failed' && (
        <p className="mt-2 text-xs text-red-400">
          Error: {timedOut ? 'Scan timed out after 3 minutes — ' : errorMsg}
          {timedOut && (
            <Link href="/app/websites" className="font-semibold text-red-300 underline hover:text-red-200">
              retry from Websites
            </Link>
          )}
        </p>
      )}
      {(status === 'pending' || status === 'processing') && (
        <p className="mt-2 text-xs text-gray-500">{progressLabel}</p>
      )}
    </div>
  );
}

export default function ScanQueueList() {
  const { id: userId, loading: userLoading } = useUser();
  const { jobs, loading: queueLoading } = useScanQueueRealtime(userId || null);

  const loading = userLoading || queueLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span className="ml-3 text-sm text-gray-500">Loading scans…</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16 text-center">
        <p className="text-sm font-medium text-gray-300">No scans yet</p>
        <p className="mt-1 max-w-sm text-xs text-gray-500">
          Add a website or click Scan Now — status updates appear here instantly. {SCAN_TIMEOUT_HINT}.
        </p>
        <Link
          href="/app/websites"
          className="mt-5 inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
        >
          Go to Websites
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  );
}
