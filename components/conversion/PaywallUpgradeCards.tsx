'use client';

import Link from 'next/link';
import type { BilledPlan } from '@/lib/billing/plans';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { getPlanMarketing } from '@/lib/billing/planFeatures';
import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';
import { formatDisplayPriceMonthly } from '@/lib/billing/formatPrice';

interface PaywallUpgradeCardsProps {
  recommendedPlan: BilledPlan;
  onSelectPlan: (plan: BilledPlan) => void;
  className?: string;
}

const CARD_PLANS: BilledPlan[] = ['pro', 'growth'];

export default function PaywallUpgradeCards({
  recommendedPlan,
  onSelectPlan,
  className = '',
}: PaywallUpgradeCardsProps) {
  const { prices } = useDisplayPrices();

  return (
    <div className={className}>
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
        Recommended plans
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARD_PLANS.map((plan) => {
          const marketing = getPlanMarketing(plan);
          const highlighted = plan === recommendedPlan;
          return (
            <div
              key={plan}
              className={`rounded-xl border p-5 ${
                highlighted
                  ? 'border-blue-500/50 bg-blue-600/10 ring-1 ring-blue-500/30'
                  : 'border-gray-700/60 bg-gray-800/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{PLAN_LIMITS[plan].name}</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {formatDisplayPriceMonthly(prices[plan])}
                  </p>
                </div>
                {highlighted && (
                  <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-semibold text-blue-300">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-400">{marketing.tagline}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-300">
                <li>{marketing.websiteLabel}</li>
                <li>{marketing.monitoringLabel}</li>
                <li>{marketing.deepScanLabel}</li>
              </ul>
              <button
                type="button"
                onClick={() => onSelectPlan(plan)}
                className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-gray-600 text-gray-200 hover:border-gray-500 hover:text-white'
                }`}
              >
                {plan === 'pro' ? 'Unlock Full Report' : 'Start Monitoring'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-lg border border-gray-700/50 bg-gray-800/20 px-4 py-3 text-center">
        <p className="text-sm text-gray-400">Need agency or enterprise coverage?</p>
        <div className="mt-2 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
          <Link href="/pricing" className="text-sm font-medium text-blue-400 hover:text-blue-300">
            View all plans
          </Link>
          <span className="hidden text-gray-600 sm:inline">·</span>
          <Link
            href="/enterprise/review"
            className="text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            Request Security Review
          </Link>
        </div>
      </div>
    </div>
  );
}
