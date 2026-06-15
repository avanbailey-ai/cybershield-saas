'use client';

import Link from 'next/link';
import { usePlan } from '@/lib/billing/usePlan';
import ScanAllButton from './ScanAllButton';

export interface LastScanSummary {
  websiteLabel: string;
  status: string;
  score: number | null;
  completedAt: string | null;
  scanId: string | null;
}

interface DashboardOverviewProps {
  websiteCount: number;
  lastScan: LastScanSummary | null;
  criticalAlertCount: number;
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

function lastScanLabel(lastScan: LastScanSummary | null): string {
  if (!lastScan) return 'No scans yet';
  if (lastScan.status === 'processing' || lastScan.status === 'pending') return 'Scan in progress…';
  if (lastScan.status === 'failed') return 'Last scan failed';
  if (lastScan.score !== null) return `Score ${lastScan.score}/100 · ${lastScan.completedAt ? timeAgo(lastScan.completedAt) : 'recently'}`;
  return lastScan.status;
}

export default function DashboardOverview({
  websiteCount,
  lastScan,
  criticalAlertCount,
}: DashboardOverviewProps) {
  const { plan, limits, scansToday, scansRemaining, loading } = usePlan();

  if (loading) {
    return (
      <div className="mb-6 h-24 animate-pulse rounded-xl border border-gray-800 bg-gray-900/40" />
    );
  }

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const scansLabel =
    limits.maxScansPerDay === Infinity
      ? `${scansToday} scans today`
      : `${scansRemaining} of ${limits.maxScansPerDay} scans left today`;

  let nextAction: { label: string; href?: string; showScanAll?: boolean } = {
    label: 'Add a website',
    href: '/app/websites',
  };

  if (websiteCount === 0) {
    nextAction = { label: 'Add your first website', href: '/app/websites' };
  } else if (!lastScan || lastScan.status === 'failed') {
    nextAction = { label: 'Run a security scan', showScanAll: true };
  } else if (criticalAlertCount > 0) {
    nextAction = { label: 'Review critical alerts', href: '/app/alerts' };
  } else if (lastScan.status === 'completed') {
    nextAction = { label: 'View latest report', href: lastScan.scanId ? `/report/${lastScan.scanId}` : '/app/scans' };
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Plan</p>
          <p className="mt-1 text-sm font-semibold text-white">{planLabel}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Scans today</p>
          <p className={`mt-1 text-sm font-semibold ${scansRemaining <= 1 ? 'text-orange-400' : 'text-white'}`}>
            {scansLabel}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Last scan</p>
          <p className="mt-1 text-sm font-semibold text-white">{lastScanLabel(lastScan)}</p>
          {lastScan?.websiteLabel && (
            <p className="mt-0.5 truncate text-xs text-gray-500">{lastScan.websiteLabel}</p>
          )}
        </div>
        <div className="flex flex-col justify-center sm:items-end">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-right">
            Next step
          </p>
          {nextAction.showScanAll ? (
            <ScanAllButton />
          ) : (
            <Link
              href={nextAction.href ?? '/app/websites'}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {nextAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
