'use client';

import { usePlan } from '@/lib/billing/usePlan';
import { useConversionOptional } from './ConversionProvider';
import { formatWebsiteLimit } from '@/lib/billing/plans';

function usagePct(used: number, limit: number): number {
  if (limit === Infinity) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

function barColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 80) return 'bg-orange-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-blue-500';
}

interface UsageMeterProps {
  compact?: boolean;
}

export default function UsageMeter({ compact = false }: UsageMeterProps) {
  const {
    plan,
    limits,
    websiteCount,
    scansToday,
    websitesRemaining,
    scansRemaining,
    loading,
  } = usePlan();
  const conversion = useConversionOptional();

  if (loading) return null;

  const websiteLimit = limits.websites === Infinity ? null : limits.websites;
  const scanLimit = limits.maxScansPerDay === Infinity ? null : limits.maxScansPerDay;
  const websitePct = websiteLimit ? usagePct(websiteCount, websiteLimit) : 0;
  const scanPct = scanLimit ? usagePct(scansToday, scanLimit) : 0;
  const nearLimit =
    websitesRemaining === 0 || scansRemaining === 0 || websitePct >= 80 || scanPct >= 80;

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  function handleUpgrade() {
    if (conversion) {
      conversion.openUpgradeModal({
        trigger: nearLimit ? 'scan_limit' : 'manual',
        recommendedPlan: plan === 'pro' ? 'growth' : 'agency',
      });
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 font-semibold text-blue-400 ring-1 ring-blue-500/30">
          {planLabel}
        </span>
        {websiteLimit !== null && (
          <span>
            {websiteCount}/{websiteLimit} sites
          </span>
        )}
        {scanLimit !== null && (
          <span className={scansRemaining <= 1 ? 'text-orange-400' : undefined}>
            {scansToday}/{scanLimit} scans today
          </span>
        )}
        {nearLimit && conversion && (
          <button
            type="button"
            onClick={handleUpgrade}
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            Upgrade
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        nearLimit ? 'border-orange-500/30 bg-orange-500/5' : 'border-gray-800 bg-gray-900/40'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/30">
            {planLabel} plan
          </span>
          {nearLimit && (
            <span className="text-xs font-medium text-orange-400">Approaching limit</span>
          )}
        </div>
        {nearLimit && conversion && (
          <button
            type="button"
            onClick={handleUpgrade}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Upgrade plan
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {websiteLimit !== null && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Websites</span>
              <span className="text-gray-300">
                {websiteCount} / {formatWebsiteLimit(websiteLimit)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className={`h-full rounded-full transition-all ${barColor(websitePct)}`}
                style={{ width: `${websitePct}%` }}
              />
            </div>
          </div>
        )}
        {scanLimit !== null && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Scans today</span>
              <span className={scansRemaining <= 1 ? 'text-orange-400' : 'text-gray-300'}>
                {scansToday} / {scanLimit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className={`h-full rounded-full transition-all ${barColor(scanPct)}`}
                style={{ width: `${scanPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
