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
import { trackEvent } from '@/lib/analytics/events';

const PAID_PLANS: BilledPlan[] = ['pro', 'growth', 'agency'];
const RECOMMENDED: BilledPlan = 'growth';

const OUTCOMES: Record<BilledPlan, string> = {
  pro: 'Daily scans and alerts — ideal for getting started.',
  growth: 'Daily monitoring with priority scans — best for most teams.',
  agency: 'Hourly scans and unlimited sites for agencies.',
};

export default function OnboardingPlans() {
  const [loading, setLoading] = useState<BilledPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { prices } = useDisplayPrices();

  useEffect(() => {
    trackEvent('page_view', { path: '/onboarding' });
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
          setError(data.error ?? 'Payments not configured yet. Try a free scan instead.');
        } else {
          setError(data.error ?? 'Something went wrong. Please try again.');
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

      {/* Free tier */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Free scan</h3>
            <p className="mt-1 text-sm text-gray-400">
              One-time security check — no subscription required.
            </p>
          </div>
          <Link
            href="/scan"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-600 hover:text-white"
          >
            Start free
          </Link>
        </div>
      </div>

      {/* Paid plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const isRecommended = plan === RECOMMENDED;
          return (
            <div
              key={plan}
              className={`flex flex-col rounded-xl border p-6 ${
                isRecommended
                  ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/30'
                  : 'border-gray-800 bg-gray-900/40'
              }`}
            >
              {isRecommended && (
                <span className="mb-3 self-start rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                  Recommended
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{limits.name}</h3>
              <p className="mt-1 text-sm text-gray-400">{OUTCOMES[plan]}</p>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatDisplayPrice(prices[plan])}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-400">
                <li>{formatWebsiteLimit(limits.websites)}</li>
                <li>{limits.maxScansPerDay} scans per day</li>
                <li>{formatScanFrequency(limits.scanFrequency)}</li>
              </ul>
              <button
                onClick={() => handleUpgrade(plan)}
                disabled={loading !== null}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  isRecommended
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-gray-700 bg-gray-800/60 text-gray-200 hover:border-gray-600 hover:text-white'
                }`}
              >
                {loading === plan ? 'Redirecting…' : 'Upgrade'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-gray-500">
        <Link href="/pricing" className="font-medium text-blue-400 hover:text-blue-300">
          Compare all plans
        </Link>
        {' · '}
        <Link href="/enterprise/lead" className="font-medium text-gray-400 hover:text-gray-300">
          Enterprise
        </Link>
      </p>
    </div>
  );
}
