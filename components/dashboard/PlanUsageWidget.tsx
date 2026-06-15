'use client';

import Link from 'next/link';
import { usePlan } from '@/lib/billing/usePlan';
import { useConversionOptional } from '@/components/conversion/ConversionProvider';
import { getWebsiteUsageMessage } from '@/lib/billing/guards';

export default function PlanUsageWidget() {
  const { plan, limits, websiteCount, scansToday, websitesRemaining, scansRemaining, loading } =
    usePlan();
  const conversion = useConversionOptional();

  if (loading) {
    return (
      <div className="hidden items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-500 lg:flex">
        Loading plan…
      </div>
    );
  }

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const websiteUsage = getWebsiteUsageMessage(websiteCount, { id: '', plan });
  const scanUsage = `${scansToday} / ${limits.maxScansPerDay} scans today`;
  const nearLimit = websitesRemaining === 0 || scansRemaining === 0;

  function handleUpgrade() {
    conversion?.openUpgradeModal({
      trigger: nearLimit ? 'scan_limit' : 'manual',
      recommendedPlan: plan === 'pro' ? 'growth' : 'agency',
    });
  }

  return (
    <div className="hidden items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 lg:flex">
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
        >
          Upgrade
        </button>
      )}
      {nearLimit && !conversion && (
        <Link href="/app/settings" className="text-xs font-medium text-orange-400 hover:text-orange-300">
          Upgrade
        </Link>
      )}
    </div>
  );
}
