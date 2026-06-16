'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  PLAN_LIMITS,
  formatScanFrequency,
  formatWebsiteLimit,
  type BilledPlan,
} from '@/lib/billing/plans';
import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';
import { formatDisplayPrice } from '@/lib/billing/formatPrice';
import { trackEvent } from '@/lib/conversion/track';
import PlanComparisonTable from '@/components/conversion/PlanComparisonTable';
import CheckoutContextPanel from '@/components/conversion/CheckoutContextPanel';
import {
  parseFunnelFromSearchParams,
  readFunnelSession,
  hostnameFromUrl,
  type FunnelSessionState,
} from '@/lib/funnel/session';

const smbPlans = [
  {
    id: 'pro' as const,
    name: 'Pro',
    subtitle: 'Recommended after your scan',
    badge: 'Best for your site',
    price: '',
    period: '/mo',
    description:
      'Full vulnerability reports, daily scans, and automated fix guidance — everything your scan revealed, unlocked.',
    roiLine: 'Fixes the issues your scan found automatically.',
    features: [
      formatWebsiteLimit(PLAN_LIMITS.pro.websites),
      `${PLAN_LIMITS.pro.maxScansPerDay} scans/day`,
      formatScanFrequency(PLAN_LIMITS.pro.scanFrequency),
      'Full reports & email alerts',
      'Attack surface & exploit modeling',
      'Daily automated scans',
    ],
    cta: 'Enable continuous protection',
    highlighted: true,
    stripePlan: 'pro' as const,
  },
  {
    id: 'growth' as const,
    name: 'Continuous Protection',
    subtitle: 'For multiple live sites',
    badge: null,
    price: '',
    period: '/mo',
    description: 'Daily scans, alerts, and change detection for teams managing several websites.',
    roiLine: 'One prevented breach pays for years of monitoring.',
    features: [
      formatWebsiteLimit(PLAN_LIMITS.growth.websites),
      `${PLAN_LIMITS.growth.maxScansPerDay} scans/day`,
      formatScanFrequency(PLAN_LIMITS.growth.scanFrequency),
      'Full vulnerability reports',
      'Email alerts when risks change',
      'Change detection & trend tracking',
    ],
    cta: 'Enable continuous protection',
    highlighted: false,
    stripePlan: 'growth' as const,
  },
];

const freePlan = {
  id: 'free' as const,
  name: 'Free Scan',
  description: 'One-time preview only — top 3 findings shown, no continuous monitoring.',
  features: [
    'One-time risk score',
    'Top 3 vulnerabilities shown',
    'No account required',
    'Attack surface mapping not included',
    'Change detection not included',
    'Exploit modeling not included',
  ],
  cta: 'Scan your website for free',
  href: '/#scan',
};

function PricingInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightedPlan, setHighlightedPlan] = useState<BilledPlan>('pro');
  const [trustSignals, setTrustSignals] = useState(true);
  const [funnelState, setFunnelState] = useState<FunnelSessionState | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<BilledPlan | null>(null);
  const { prices } = useDisplayPrices();

  useEffect(() => {
    const fromParams = parseFunnelFromSearchParams(searchParams);
    setFunnelState(fromParams ?? readFunnelSession());

    const planParam = searchParams.get('plan');
    if (planParam === 'pro' || planParam === 'growth') {
      setHighlightedPlan(planParam);
    }

    trackEvent('pricing_viewed', { path: '/pricing', trigger: 'page_load' });
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/analytics/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!cfg) return;
        if (cfg.highlighted_plan && !searchParams.get('plan')) {
          setHighlightedPlan(cfg.highlighted_plan);
        }
        if (typeof cfg.trust_signals_visible === 'boolean') {
          setTrustSignals(cfg.trust_signals_visible);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const pricedSmbPlans = useMemo(
    () =>
      smbPlans.map((p) => ({
        ...p,
        highlighted: p.id === highlightedPlan,
        price: formatDisplayPrice(prices[p.stripePlan]),
      })),
    [highlightedPlan, prices],
  );

  const orderedSmbPlans = useMemo(() => {
    const hero = pricedSmbPlans.find((p) => p.id === 'pro')!;
    const rest = pricedSmbPlans.filter((p) => p.id !== 'pro');
    return [hero, ...rest];
  }, [pricedSmbPlans]);

  const personalizedHeadline = useMemo(() => {
    if (!funnelState) return 'Enable continuous protection for your website';
    const hostname = hostnameFromUrl(funnelState.scanned_site);
    const issues = funnelState.issue_count;
    if (issues > 0) {
      return `Your site has ${issues} issue${issues !== 1 ? 's' : ''} — Pro fixes this automatically`;
    }
    if (funnelState.score < 70) {
      return `${hostname} scored ${funnelState.score}/100 — enable protection before attackers find these gaps`;
    }
    return `Protect ${hostname} with continuous monitoring`;
  }, [funnelState]);

  async function proceedToCheckout(plan: BilledPlan) {
    setLoading(plan);
    setError(null);
    trackEvent('upgrade_clicked', { plan, trigger: 'pricing' });
    trackEvent('checkout_started', { plan, trigger: 'pricing' });

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/signup?redirectTo=${encodeURIComponent('/pricing')}`;
          return;
        }
        const message = data.details
          ? `${data.error ?? 'Checkout failed'}: ${data.details}`
          : (data.error ?? 'Something went wrong. Please try again.');
        setError(message);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
      setCheckoutPlan(null);
    }
  }

  function handleCheckoutClick(plan: BilledPlan) {
    setCheckoutPlan(plan);
  }

  return (
    <section id="pricing" className="relative px-4 py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-500">
            Enable protection
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {personalizedHeadline}
          </h2>
          {funnelState && (
            <div className="mx-auto mt-4 inline-flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-2">
              <span
                className={`text-2xl font-bold ${
                  funnelState.score < 70 ? 'text-red-400' : 'text-yellow-400'
                }`}
              >
                {funnelState.score}
              </span>
              <span className="text-left text-sm text-gray-400">
                <span className="block font-medium text-white">
                  {hostnameFromUrl(funnelState.scanned_site)}
                </span>
                {funnelState.issue_count} issue{funnelState.issue_count !== 1 ? 's' : ''} detected
              </span>
            </div>
          )}
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            Your free scan showed the gaps. Pro unlocks full reports, daily monitoring, and automated
            fix guidance.
          </p>
          {trustSignals && (
            <p className="mx-auto mt-3 max-w-xl text-xs text-gray-500">
              Secure checkout · Cancel anytime · 30-day guarantee
            </p>
          )}
        </div>

        {error && (
          <div className="mx-auto mb-6 max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {orderedSmbPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-xl border p-7 ${
                plan.highlighted
                  ? 'border-blue-600 bg-blue-950/25 shadow-lg shadow-blue-900/25 ring-1 ring-blue-600/30'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {plan.badge && plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                  {plan.subtitle}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">{plan.name}</h3>
                <p className="mt-2 text-sm text-gray-400">{plan.description}</p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="mb-1 text-sm text-gray-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-xs text-green-400/90">{plan.roiLine}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckoutClick(plan.stripePlan)}
                disabled={loading === plan.stripePlan}
                className={`w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors disabled:opacity-60 ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                {loading === plan.stripePlan ? 'Redirecting…' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-gray-800/80 bg-gray-950/40 p-6 opacity-75">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Incomplete without monitoring
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-400">{freePlan.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{freePlan.description}</p>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {freePlan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="h-1 w-1 rounded-full bg-gray-600" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={freePlan.href}
              className="shrink-0 rounded-lg border border-gray-700 px-6 py-2.5 text-center text-sm font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-300"
            >
              {freePlan.cta}
            </a>
          </div>
        </div>

        <PlanComparisonTable />

        <div className="mt-16 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-gray-950 p-8 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
              Enterprise & regulated teams
            </p>
            <h3 className="mt-3 text-2xl font-bold text-white">Request Security Review</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              Compliance reporting, audit trails, SSO, and dedicated security support. No self-serve
              pricing — our team scopes coverage to your environment.
            </p>
            <ul className="mt-6 inline-flex flex-col gap-2 text-left text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <span className="text-amber-400">✓</span> SOC2-ready audit logs & compliance reporting
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400">✓</span> Multi-tenant org management & SSO path
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400">✓</span> Dedicated security review & custom SLA
              </li>
            </ul>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={
                  funnelState
                    ? `/enterprise/review?domain=${encodeURIComponent(funnelState.scanned_site)}&score=${funnelState.score}&source=pricing`
                    : '/enterprise/review'
                }
                onClick={() => trackEvent('upgrade_clicked', { trigger: 'pricing_enterprise_review' })}
                className="rounded-lg bg-amber-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-500"
              >
                Request Security Review
              </Link>
              <Link
                href="/enterprise/lead"
                onClick={() => trackEvent('upgrade_clicked', { trigger: 'pricing_enterprise_lead' })}
                className="rounded-lg border border-gray-700 px-8 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </div>

      <CheckoutContextPanel
        open={checkoutPlan != null}
        plan={checkoutPlan ?? 'pro'}
        funnelState={funnelState}
        loading={loading != null}
        onConfirm={() => checkoutPlan && proceedToCheckout(checkoutPlan)}
        onCancel={() => setCheckoutPlan(null)}
      />
    </section>
  );
}

export default function Pricing() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-gray-900/30" />}>
      <PricingInner />
    </Suspense>
  );
}
