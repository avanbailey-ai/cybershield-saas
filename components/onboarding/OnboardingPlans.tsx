'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PLAN_LIMITS,
  formatScanFrequency,
  formatWebsiteLimit,
  type BilledPlan,
} from '@/lib/billing/plans';
import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';
import { formatDisplayPrice } from '@/lib/billing/formatPrice';
import AdaptiveCTA, { useAdaptiveConfig } from '@/components/analytics/AdaptiveCTA';
import { trackEvent } from '@/lib/analytics/events';

const PLANS: {
  plan: BilledPlan;
  highlighted: boolean;
}[] = [
  { plan: 'pro', highlighted: false },
  { plan: 'growth', highlighted: Boolean(PLAN_LIMITS.growth.mostPopular) },
  { plan: 'agency', highlighted: false },
];

export default function OnboardingPlans() {
  const [loading, setLoading] = useState<BilledPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { config } = useAdaptiveConfig();
  const { prices } = useDisplayPrices();
  const [highlightPlan, setHighlightPlan] = useState<BilledPlan>('growth');

  useEffect(() => {
    trackEvent('page_view', { path: '/onboarding' });
    async function loadConfig() {
      try {
        const res = await fetch('/api/analytics/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.highlighted_plan) setHighlightPlan(cfg.highlighted_plan);
        }
      } catch {
        // ignore
      }
    }
    loadConfig();
  }, []);

  async function handleUpgrade(plan: BilledPlan) {
    setLoading(plan);
    setError(null);
    trackEvent('upgrade_clicked', { plan, trigger: 'onboarding' });
    trackEvent('checkout_started', { plan, trigger: 'onboarding' });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/signup?redirectTo=${encodeURIComponent('/onboarding')}`;
          return;
        }
        if (res.status === 503) {
          setError(data.error ?? 'Stripe payments not yet configured. Please contact support.');
        } else {
          const message = data.details
            ? `${data.error ?? 'Checkout failed'}: ${data.details}`
            : (data.error ?? 'Something went wrong. Please try again.');
          setError(message);
        }
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map(({ plan }) => {
          const limits = PLAN_LIMITS[plan];
          const isHighlighted = plan === (config.highlightPlan ?? highlightPlan);
          return (
            <div
              key={plan}
              className={`flex flex-col rounded-xl border p-6 ${
                isHighlighted
                  ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/30'
                  : 'border-gray-800 bg-gray-900/40'
              }`}
            >
              {isHighlighted && (
                <span className="mb-3 self-start rounded-full bg-blue-600/20 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
                  {config.showPricingPressure ? 'Recommended' : 'Most Popular'}
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{limits.name}</h3>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatDisplayPrice(prices[plan])}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-400">
                <li>{formatWebsiteLimit(limits.websites)}</li>
                <li>{limits.maxScansPerDay} scans/day</li>
                <li>{formatScanFrequency(limits.scanFrequency)}</li>
              </ul>
              {isHighlighted && config.showPricingPressure ? (
                <AdaptiveCTA
                  onClick={() => handleUpgrade(plan)}
                  disabled={loading !== null}
                  className="mt-6 w-full"
                  fallbackLabel={loading === plan ? 'Redirecting…' : `Choose ${limits.name}`}
                />
              ) : (
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={loading !== null}
                  className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    isHighlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'border border-gray-700 bg-gray-800/60 text-gray-200 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  {loading === plan ? 'Redirecting…' : `Choose ${limits.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-gray-500">
        Need enterprise coverage?{' '}
        <Link href="/enterprise/lead" className="font-medium text-amber-400 hover:text-amber-300">
          Talk to a security expert
        </Link>
        {' · '}
        <Link href="/#pricing" className="font-medium text-blue-400 hover:text-blue-300">
          Compare all plans
        </Link>
      </p>
    </div>
  );
}
