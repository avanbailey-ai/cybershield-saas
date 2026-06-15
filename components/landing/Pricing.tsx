'use client';



import { useState, useEffect, useMemo } from 'react';

import {

  PLAN_LIMITS,

  formatScanFrequency,

  formatWebsiteLimit,

  type BilledPlan,

} from '@/lib/billing/plans';

import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';

import { formatDisplayPrice } from '@/lib/billing/formatPrice';

import PlanComparisonTable from '@/components/conversion/PlanComparisonTable';

import ExitIntentModal from '@/components/conversion/ExitIntentModal';

import { trackEvent } from '@/lib/conversion/track';



const plans = [

  {

    id: 'free' as const,

    name: 'Public Scan',

    price: 'Free',

    period: '',

    description: 'One-off security check — no account needed.',

    features: [

      'Instant risk score',

      'Top 2 vulnerabilities shown',

      'No login required',

      formatScanFrequency(PLAN_LIMITS.free.scanFrequency),

    ],

    cta: 'Scan Now',

    highlighted: false,

    stripePlan: null,

    href: '/scan',

  },

  {

    id: 'pro' as const,

    name: PLAN_LIMITS.pro.name,

    price: '',

    period: '/mo',

    description: 'For individuals and small teams.',

    features: [

      formatWebsiteLimit(PLAN_LIMITS.pro.websites),

      `${PLAN_LIMITS.pro.maxScansPerDay} scans/day`,

      formatScanFrequency(PLAN_LIMITS.pro.scanFrequency),

      'Email alerts & security scoring',

    ],

    cta: 'Get Started',

    highlighted: false,

    stripePlan: 'pro' as const,

  },

  {

    id: 'growth' as const,

    name: PLAN_LIMITS.growth.name,

    price: '',

    period: '/mo',

    description: 'The most popular plan for growing teams.',

    features: [

      formatWebsiteLimit(PLAN_LIMITS.growth.websites),

      `${PLAN_LIMITS.growth.maxScansPerDay} scans/day`,

      formatScanFrequency(PLAN_LIMITS.growth.scanFrequency),

      'Priority queue & daily monitoring',

    ],

    cta: 'Get Started',

    highlighted: Boolean(PLAN_LIMITS.growth.mostPopular),

    stripePlan: 'growth' as const,

  },

  {

    id: 'agency' as const,

    name: PLAN_LIMITS.agency.name,

    price: '',

    period: '/mo',

    description: 'Enterprise-grade coverage for large organizations.',

    features: [

      formatWebsiteLimit(PLAN_LIMITS.agency.websites),

      `${PLAN_LIMITS.agency.maxScansPerDay} scans/day`,

      formatScanFrequency(PLAN_LIMITS.agency.scanFrequency),

      'Team access & priority support',

    ],

    cta: 'Get Started',

    highlighted: false,

    stripePlan: 'agency' as const,

  },

];



export default function Pricing() {

  const [loading, setLoading] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [highlightedPlan, setHighlightedPlan] = useState<BilledPlan>('growth');

  const [planOrder, setPlanOrder] = useState<BilledPlan[]>(['pro', 'growth', 'agency']);

  const [trustSignals, setTrustSignals] = useState(true);

  const { prices } = useDisplayPrices();

  useEffect(() => {
    fetch('/api/analytics/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!cfg) return;
        if (cfg.highlighted_plan) setHighlightedPlan(cfg.highlighted_plan);
        if (Array.isArray(cfg.pricing_layout_order)) {
          setPlanOrder(cfg.pricing_layout_order as BilledPlan[]);
        }
        if (typeof cfg.trust_signals_visible === 'boolean') {
          setTrustSignals(cfg.trust_signals_visible);
        }
      })
      .catch(() => {});
  }, []);

  const orderedPlans = useMemo(() => {
    const billed = plans.filter((p) => p.stripePlan);
    const freePlan = plans.find((p) => !p.stripePlan);
    const sorted = planOrder
      .map((id) => billed.find((p) => p.id === id))
      .filter(Boolean) as typeof billed;
    const withHighlight = sorted.map((p) => ({
      ...p,
      highlighted: p.id === highlightedPlan,
      price: p.stripePlan ? formatDisplayPrice(prices[p.stripePlan]) : p.price,
    }));
    return freePlan ? [freePlan, ...withHighlight] : withHighlight;
  }, [highlightedPlan, planOrder, prices]);



  async function handleCheckout(plan: BilledPlan) {

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

          window.location.href = `/signup?redirectTo=${encodeURIComponent('/#pricing')}`;

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

    }

  }



  return (

    <section id="pricing" className="relative py-24 px-4">

      <ExitIntentModal />

      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />

      <div className="mx-auto max-w-7xl">

        <div className="mb-14 text-center">

          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-500">

            Pricing

          </p>

          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">

            Simple, transparent pricing

          </h2>

          <p className="mx-auto max-w-xl text-gray-400">

            Try a free public scan, then upgrade for continuous monitoring.

          </p>

          {trustSignals && (
            <p className="mx-auto mt-3 max-w-xl text-xs text-gray-500">
              Secure checkout · Cancel anytime · 30-day guarantee
            </p>
          )}

        </div>



        {error && (

          <div className="mb-6 mx-auto max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">

            {error}

          </div>

        )}



        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          {orderedPlans.map((plan) => (

            <div

              key={plan.name}

              className={`relative flex flex-col rounded-xl border p-7 ${

                plan.highlighted

                  ? 'border-blue-600 bg-blue-950/20 shadow-lg shadow-blue-900/20'

                  : 'border-gray-800 bg-gray-900/50'

              }`}

            >

              {plan.highlighted && (

                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">

                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">

                    Most Popular

                  </span>

                </div>

              )}



              <div className="mb-6">

                <h3 className="mb-1 text-base font-semibold text-white">{plan.name}</h3>

                <p className="mb-4 text-xs text-gray-500">{plan.description}</p>

                <div className="flex items-end gap-1">

                  <span className="text-4xl font-bold text-white">{plan.price}</span>

                  <span className="mb-1 text-sm text-gray-500">{plan.period}</span>

                </div>

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



              {plan.stripePlan ? (

                <button

                  onClick={() => handleCheckout(plan.stripePlan!)}

                  disabled={loading === plan.stripePlan}

                  className={`w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors disabled:opacity-60 ${

                    plan.highlighted

                      ? 'bg-blue-600 text-white hover:bg-blue-700'

                      : 'border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'

                  }`}

                >

                  {loading === plan.stripePlan ? 'Redirecting…' : plan.cta}

                </button>

              ) : (

                <a

                  href={'href' in plan ? plan.href : '/scan'}

                  className="w-full rounded-lg border border-gray-700 py-2.5 text-center text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"

                >

                  {plan.cta}

                </a>

              )}

            </div>

          ))}

        </div>



        <PlanComparisonTable />

      </div>

    </section>

  );

}


