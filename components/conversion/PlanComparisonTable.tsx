'use client';

import { useEffect, useState } from 'react';
import { PLAN_LIMITS, formatScanFrequency, formatWebsiteLimit } from '@/lib/billing/plans';
import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';
import { formatDisplayPriceMonthly } from '@/lib/billing/formatPrice';
import { getLastScannedDomain } from '@/lib/conversion/limits';
import { getSeverityCategory } from '@/lib/conversion/urgency';

type PlanId = 'free' | 'pro' | 'growth' | 'agency';

const ROWS: { feature: string; freeNote?: string; values: Record<PlanId, string | boolean> }[] = [
  {
    feature: 'Websites',
    values: {
      free: '1 scan only',
      pro: formatWebsiteLimit(PLAN_LIMITS.pro.websites),
      growth: formatWebsiteLimit(PLAN_LIMITS.growth.websites),
      agency: formatWebsiteLimit(PLAN_LIMITS.agency.websites),
    },
  },
  {
    feature: 'Scan frequency',
    values: {
      free: 'One-time',
      pro: formatScanFrequency(PLAN_LIMITS.pro.scanFrequency),
      growth: formatScanFrequency(PLAN_LIMITS.growth.scanFrequency),
      agency: formatScanFrequency(PLAN_LIMITS.agency.scanFrequency),
    },
  },
  {
    feature: 'Full vulnerability report',
    freeNote: 'Not enabled on Free plan',
    values: { free: false, pro: true, growth: true, agency: true },
  },
  {
    feature: 'Change detection',
    freeNote: 'Not enabled on Free plan',
    values: { free: false, pro: false, growth: true, agency: true },
  },
  {
    feature: 'Email alerts',
    freeNote: 'Not enabled on Free plan',
    values: { free: false, pro: true, growth: true, agency: true },
  },
  {
    feature: 'Continuous monitoring',
    freeNote: 'Not enabled on Free plan',
    values: { free: false, pro: true, growth: true, agency: true },
  },
  {
    feature: 'Priority support',
    values: { free: false, pro: false, growth: false, agency: true },
  },
];

const PLAN_IDS: PlanId[] = ['free', 'pro', 'growth', 'agency'];

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'First Scan',
  pro: PLAN_LIMITS.pro.name,
  growth: 'Continuous Protection',
  agency: PLAN_LIMITS.agency.name,
};

function CellValue({ value, isFree }: { value: string | boolean; isFree?: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <svg className="mx-auto h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <span className={`text-xs ${isFree ? 'text-gray-500' : 'text-gray-600'}`}>
        {isFree ? 'Locked' : '—'}
      </span>
    );
  }
  return <span className={`text-sm ${isFree ? 'text-gray-500' : 'text-gray-300'}`}>{value}</span>;
}

export default function PlanComparisonTable() {
  const [recommendedPlan, setRecommendedPlan] = useState<'pro' | 'growth'>('growth');
  const { prices } = useDisplayPrices();

  function planPrice(id: PlanId): string {
    if (id === 'free') return 'Preview only';
    return formatDisplayPriceMonthly(prices[id]);
  }

  useEffect(() => {
    const domain = getLastScannedDomain();
    if (!domain) return;
    const storedScore = sessionStorage.getItem('cybershield_last_score');
    const score = storedScore ? parseInt(storedScore, 10) : 50;
    const severity = getSeverityCategory(score);
    setRecommendedPlan(severity.level === 'high' ? 'growth' : 'pro');
  }, []);

  return (
    <div className="mt-16 overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/60">
            <th className="px-4 py-4 text-sm font-semibold text-gray-400">Feature</th>
            {PLAN_IDS.map((planId) => (
              <th
                key={planId}
                className={`px-4 py-4 text-center ${planId === 'free' ? 'opacity-60' : ''}`}
              >
                <div className={`text-sm font-semibold ${planId === 'free' ? 'text-gray-500' : 'text-white'}`}>
                  {PLAN_LABELS[planId]}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">{planPrice(planId)}</div>
                {planId === 'growth' && (
                  <span className="mt-1 inline-block rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                    Most Popular
                  </span>
                )}
                {(planId === 'pro' || planId === 'growth') && planId === recommendedPlan && (
                  <span className="mt-1 inline-block rounded-full bg-green-600/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                    Recommended for you
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.feature} className="border-b border-gray-800/60">
              <td className="px-4 py-3 text-sm text-gray-400">
                {row.feature}
                {row.freeNote && (
                  <span className="mt-0.5 block text-xs text-gray-600">{row.freeNote}</span>
                )}
              </td>
              {PLAN_IDS.map((planId) => (
                <td key={planId} className={`px-4 py-3 text-center ${planId === 'free' ? 'opacity-60' : ''}`}>
                  <CellValue value={row.values[planId]} isFree={planId === 'free'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
