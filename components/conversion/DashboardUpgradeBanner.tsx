'use client';

import Link from 'next/link';
import { usePlan } from '@/lib/billing/usePlan';
import { useConversionOptional } from './ConversionProvider';
import { useBrainState } from '@/lib/brain/useBrainState';
import UsageMeter from './UsageMeter';

export default function DashboardUpgradeBanner() {
  const { plan, limits, websiteCount, scansToday, websitesRemaining, scansRemaining, loading } =
    usePlan();
  const conversion = useConversionOptional();
  const brain = useBrainState();

  if (loading) return null;

  if (brain.recommendedAction === 'retention' && plan !== 'free') {
    return (
      <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-amber-200">Run a fresh scan</p>
            <p className="mt-1 text-sm text-amber-200/70">
              Your security posture may have changed since your last check.
            </p>
          </div>
          <Link
            href="/app/websites"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-500/40 px-5 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/10"
          >
            Run scan
          </Link>
        </div>
      </div>
    );
  }

  if (plan === 'free') {
    return (
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-white">Unlock continuous monitoring</p>
            <p className="mt-1 text-sm text-gray-400">
              Upgrade to get daily scans, alerts, and full security reports.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Choose a plan
          </Link>
        </div>
      </div>
    );
  }

  const websitePct =
    limits.websites === Infinity ? 0 : Math.round((websiteCount / limits.websites) * 100);
  const scanPct =
    limits.maxScansPerDay === Infinity
      ? 0
      : Math.round((scansToday / limits.maxScansPerDay) * 100);
  const maxPct = Math.max(websitePct, scanPct);
  const nearLimit = websitesRemaining === 0 || scansRemaining === 0 || maxPct >= 80;

  return (
    <div className="mb-6 space-y-4">
      <UsageMeter />

      {nearLimit && (
        <div className="flex flex-col gap-3 rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-orange-200">
            {websitesRemaining === 0 || scansRemaining === 0
              ? "You've reached a plan limit."
              : `You're at ${maxPct}% of your plan capacity.`}
          </p>
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
              Upgrade plan
            </button>
          ) : (
            <Link
              href="/app/settings"
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Upgrade plan
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
