'use client';

import { useState } from 'react';
import type { Plan, BilledPlan } from '@/lib/billing/plans';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';
import { formatDisplayPriceMonthly } from '@/lib/billing/formatPrice';

interface BillingCardProps {
  currentPlan: Plan;
  subscriptionStatus: string | null;
}

function formatWebsiteDescription(plan: Plan): string {
  const limits = PLAN_LIMITS[plan];
  const websites =
    limits.websites === Infinity ? 'Unlimited websites' : `${limits.websites} website${limits.websites === 1 ? '' : 's'}`;
  return `${websites} · ${limits.maxScansPerDay} scans/day`;
}

export default function BillingCard({ currentPlan, subscriptionStatus }: BillingCardProps) {
  const [loading, setLoading] = useState<BilledPlan | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { prices } = useDisplayPrices();

  const meta = {
    name: PLAN_LIMITS[currentPlan]?.name ?? PLAN_LIMITS.free.name,
    description: formatWebsiteDescription(currentPlan),
  };

  async function handleUpgrade(plan: BilledPlan) {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
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

  async function handlePortal() {
    setLoading('portal');
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
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

  const isSubscribed =
    (currentPlan !== 'free' && subscriptionStatus === 'active') || currentPlan === 'owner';

  const upgradePlans: BilledPlan[] =
    currentPlan === 'free'
      ? ['pro', 'growth', 'agency']
      : currentPlan === 'pro'
        ? ['growth', 'agency']
        : currentPlan === 'growth'
          ? ['agency']
          : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-200">Current Plan</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {meta.name} Plan · {meta.description}
            {subscriptionStatus && subscriptionStatus !== 'active' && (
              <span className="ml-2 text-yellow-400">({subscriptionStatus})</span>
            )}
          </p>
        </div>
        <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/30">
          {meta.name}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {upgradePlans.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {currentPlan === 'growth' ? 'Upgrade to Agency' : 'Upgrade Your Plan'}
          </p>
          <div className="space-y-3">
            {upgradePlans.map((plan) => (
              <UpgradeOption
                key={plan}
                plan={plan}
                name={PLAN_LIMITS[plan].name}
                priceLabel={formatDisplayPriceMonthly(prices[plan])}
                description={formatWebsiteDescription(plan)}
                loading={loading === plan}
                onUpgrade={handleUpgrade}
              />
            ))}
          </div>
        </div>
      )}

      {isSubscribed && (
        <button
          onClick={handlePortal}
          disabled={loading === 'portal'}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-60"
        >
          {loading === 'portal' ? 'Opening portal…' : 'Manage Subscription'}
        </button>
      )}
    </div>
  );
}

interface UpgradeOptionProps {
  plan: BilledPlan;
  name: string;
  priceLabel: string;
  description: string;
  loading: boolean;
  onUpgrade: (plan: BilledPlan) => void;
}

function UpgradeOption({ plan, name, priceLabel, description, loading, onUpgrade }: UpgradeOptionProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-white">
          {name}
          {priceLabel !== '—' && (
            <span className="ml-2 text-xs font-normal text-gray-400">{priceLabel}</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onUpgrade(plan)}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
      >
        {loading ? 'Redirecting…' : `Upgrade to ${name}`}
      </button>
    </div>
  );
}
