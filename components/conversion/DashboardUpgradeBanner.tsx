'use client';

import Link from 'next/link';
import { usePlan } from '@/lib/billing/usePlan';
import { useConversionOptional } from './ConversionProvider';

export default function DashboardUpgradeBanner() {
  const { plan, websitesRemaining, scansRemaining, loading } = usePlan();
  const conversion = useConversionOptional();

  if (loading) return null;

  const atLimit = websitesRemaining === 0 || scansRemaining === 0;

  if (plan === 'free') {
    return (
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-white">Enable continuous protection</p>
            <p className="mt-1 text-sm text-gray-400">
              One-time scans miss new threats. Get daily scans, alerts, and full reports.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Enable protection
          </Link>
        </div>
      </div>
    );
  }

  if (!atLimit) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-orange-200">You&apos;ve reached a plan limit.</p>
      {conversion ? (
        <button
          type="button"
          onClick={() =>
            conversion.openUpgradeModal({
              trigger: 'scan_limit',
              recommendedPlan: plan === 'pro' ? 'growth' : 'agency',
            })
          }
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Upgrade protection
        </button>
      ) : (
        <Link
          href="/app/settings"
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Upgrade protection
        </Link>
      )}
    </div>
  );
}
