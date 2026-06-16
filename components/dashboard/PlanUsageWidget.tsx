'use client';

import Link from 'next/link';
import { useUser } from '@/lib/auth/useUser';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { useConversionOptional } from '@/components/conversion/ConversionProvider';
import { getWebsiteUsageMessage } from '@/lib/auth/permissions';

export default function PlanUsageWidget() {
  const { plan, limits, websiteCount, scansToday, websitesRemaining, scansRemaining, loading } =
    useUser();
  const conversion = useConversionOptional();

  if (loading) {
    return (
      <div className="hidden items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-500 md:flex">
        Loading plan…
      </div>
    );
  }

  const planLabel = PLAN_LIMITS[plan]?.name ?? 'Free';
  const websiteUsage = getWebsiteUsageMessage(websiteCount, { id: '', plan });
  const scanUsage =
    limits.maxScansPerDay === Infinity
      ? `${scansToday} scans today`
      : `${scansRemaining} of ${limits.maxScansPerDay} scans left today`;
  const websiteLimitReached = websitesRemaining === 0;
  const scanLimitReached = scansRemaining === 0;
  const nearLimit = websiteLimitReached || scanLimitReached;

  function handleUpgrade() {
    conversion?.openUpgradeModal({
      trigger: nearLimit ? 'scan_limit' : 'manual',
      recommendedPlan: plan === 'pro' ? 'growth' : 'agency',
    });
  }

  return (
    <div className="hidden items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 md:flex">
      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/30">
        {planLabel}
      </span>
      <span className="text-xs text-gray-400">{websiteUsage}</span>
      <span className="text-xs text-gray-500">·</span>
      <span className={`text-xs ${scansRemaining <= 1 ? 'text-orange-400' : 'text-gray-400'}`}>
        {scanUsage}
      </span>
      {nearLimit && conversion && (
        <button
          type="button"
          onClick={handleUpgrade}
          className="text-xs font-medium text-orange-400 hover:text-orange-300"
          aria-label="Upgrade plan for higher limits"
        >
          {websiteLimitReached && scanLimitReached
            ? 'Upgrade for more sites & scans'
            : websiteLimitReached
              ? 'Upgrade for more websites'
              : 'Upgrade for more scans'}
        </button>
      )}
      {nearLimit && !conversion && (
        <Link href="/app/settings" className="text-xs font-medium text-orange-400 hover:text-orange-300">
          {websiteLimitReached && scanLimitReached
            ? 'Upgrade for more sites & scans'
            : websiteLimitReached
              ? 'Upgrade for more websites'
              : 'Upgrade for more scans'}
        </Link>
      )}
    </div>
  );
}
