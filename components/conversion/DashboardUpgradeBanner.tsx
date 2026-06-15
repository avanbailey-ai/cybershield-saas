'use client';

import Link from 'next/link';
import { usePlan } from '@/lib/billing/usePlan';
import { useConversionOptional } from './ConversionProvider';
import { useBrainState } from '@/lib/brain/useBrainState';

export default function DashboardUpgradeBanner() {
  const { plan, limits, websiteCount, scansToday, websitesRemaining, scansRemaining, loading } =
    usePlan();
  const conversion = useConversionOptional();
  const brain = useBrainState();

  if (loading) return null;

  if (brain.recommendedAction === 'retention' && plan !== 'free') {
    return (
      <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-amber-300">We miss you — run a fresh scan</p>
            <p className="mt-1 text-sm text-amber-400/80">
              Your security posture may have changed. Stay protected with continuous monitoring.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
          >
            Run New Scan →
          </Link>
        </div>
      </div>
    );
  }

  if (plan === 'free') {
    return (
      <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-red-300">Dashboard access requires a paid plan</p>
            <p className="mt-1 text-sm text-red-400/80">
              Upgrade now to unlock continuous monitoring, alerts, and full security reports.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
          >
            Choose a Plan →
          </Link>
        </div>
      </div>
    );
  }

  const websitePct =
    limits.websites === Infinity
      ? 0
      : Math.round((websiteCount / limits.websites) * 100);
  const scanPct =
    limits.maxScansPerDay === Infinity
      ? 0
      : Math.round((scansToday / limits.maxScansPerDay) * 100);
  const maxPct = Math.max(websitePct, scanPct);

  if (maxPct < 70 && websitesRemaining !== 0 && scansRemaining > 5) {
    return null;
  }

  const powerUsed = Math.min(100, maxPct);
  const nearLimit = websitesRemaining === 0 || scansRemaining === 0;

  return (
    <div
      className={`mb-6 rounded-xl border px-5 py-4 ${
        nearLimit
          ? 'border-orange-500/30 bg-orange-500/10'
          : 'border-blue-500/20 bg-blue-500/5'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`font-semibold ${nearLimit ? 'text-orange-300' : 'text-blue-300'}`}>
            {nearLimit
              ? "You've hit a plan limit"
              : `You're only using ${powerUsed}% of CyberShield power`}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {nearLimit
              ? 'Upgrade for more websites, daily scans, and priority monitoring.'
              : 'Unlock higher limits and hourly monitoring with Growth or Agency.'}
          </p>
        </div>
        {conversion ? (
          <button
            type="button"
            onClick={() =>
              conversion.openUpgradeModal({
                trigger: 'manual',
                recommendedPlan: plan === 'pro' ? 'growth' : 'agency',
              })
            }
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Upgrade Plan →
          </button>
        ) : (
          <Link
            href="/dashboard/settings"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Upgrade Plan →
          </Link>
        )}
      </div>
    </div>
  );
}
