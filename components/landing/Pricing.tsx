'use client';

import { useState } from 'react';

const plans = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Get started at no cost.',
    features: ['1 website', '3 scans/day', 'Basic security scan'],
    cta: 'Get Started',
    highlighted: false,
    stripePlan: null,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'For individuals and small teams.',
    features: ['5 websites', 'Daily scans', 'Email alerts', 'Security scoring'],
    cta: 'Get Started',
    highlighted: false,
    stripePlan: 'pro' as const,
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    price: '$99',
    period: '/mo',
    description: 'The most popular plan for growing teams.',
    features: ['25 websites', 'Daily scans', 'Security scoring', 'Priority queue'],
    cta: 'Get Started',
    highlighted: true,
    stripePlan: 'growth' as const,
  },
  {
    id: 'agency' as const,
    name: 'Agency',
    price: '$199',
    period: '/mo',
    description: 'Enterprise-grade coverage for large organizations.',
    features: ['100 websites', 'Advanced monitoring', 'Team access', 'Priority support'],
    cta: 'Get Started',
    highlighted: false,
    stripePlan: 'agency' as const,
  },
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(plan: 'pro' | 'growth' | 'agency') {
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
        if (res.status === 401) {
          window.location.href = '/signup';
          return;
        }
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

  return (
    <section className="relative py-24 px-4">
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
            Start free, scale when you need. No hidden fees, no surprises.
          </p>
        </div>

        {error && (
          <div className="mb-6 mx-auto max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
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
                  href="/signup"
                  className="w-full rounded-lg border border-gray-700 py-2.5 text-center text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
                >
                  {plan.cta}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
