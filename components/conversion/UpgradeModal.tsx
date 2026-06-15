'use client';

import { useEffect, useState } from 'react';
import {
  PLAN_LIMITS,
  BILLED_PLANS,
  formatScanFrequency,
  formatWebsiteLimit,
  type BilledPlan,
} from '@/lib/billing/plans';
import { getUrgencyMessage } from '@/lib/conversion/urgency';
import { getPersonalizedCta } from '@/lib/conversion/personalize';
import { trackEvent, getSessionId } from '@/lib/analytics/events';
import { useAdaptiveConfig } from '@/components/analytics/AdaptiveCTA';
import { getVariantClient } from '@/lib/analytics/experiments';
import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';
import { formatDisplayPrice } from '@/lib/billing/formatPrice';
import type { PaywallTrigger } from './ConversionProvider';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  score: number;
  domain?: string;
  trigger?: PaywallTrigger;
  recommendedPlan?: BilledPlan;
}

export default function UpgradeModal({
  open,
  onClose,
  score,
  domain,
  trigger,
  recommendedPlan,
}: UpgradeModalProps) {
  const [loading, setLoading] = useState<BilledPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ctaText, setCtaText] = useState<string | null>(null);
  const [autopilotPlan, setAutopilotPlan] = useState<BilledPlan | null>(null);
  const [trustSignals, setTrustSignals] = useState(true);
  const [urgencyLevel, setUrgencyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const { config: adaptiveConfig } = useAdaptiveConfig();
  const { prices } = useDisplayPrices();

  const urgency = getUrgencyMessage(score, domain);
  const highlightPlan =
    recommendedPlan ?? autopilotPlan ?? adaptiveConfig.highlightPlan ?? urgency.highlightPlan;

  useEffect(() => {
    if (!open) return;
    async function loadConfig() {
      try {
        const res = await fetch('/api/analytics/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.highlighted_plan) setAutopilotPlan(cfg.highlighted_plan);
          if (cfg.cta_text_variant) setCtaText(String(cfg.cta_text_variant));
          if (typeof cfg.trust_signals_visible === 'boolean') {
            setTrustSignals(cfg.trust_signals_visible);
          }
          if (cfg.urgency_level) {
            setUrgencyLevel(cfg.urgency_level as 'low' | 'medium' | 'high');
          }
        }
        const sessionId = getSessionId();
        const expRes = await fetch('/api/analytics/experiments/cta_text');
        if (expRes.ok) {
          const exp = await expRes.json();
          const { variant, config } = getVariantClient('cta_text', sessionId, exp);
          void fetch('/api/analytics/experiments/impression', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ experiment: 'cta_text', variant }),
          });
          if (config.text) setCtaText(String(config.text));
        }
      } catch {
        // ignore
      }
    }
    loadConfig();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleCheckout(plan: BilledPlan) {
    setLoading(plan);
    setError(null);
    trackEvent('upgrade_clicked', { plan, score, domain, trigger });

    try {
      trackEvent('checkout_started', { plan, score, domain, trigger });
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (res.status === 401) {
        const returnTo = encodeURIComponent(
          typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/scan',
        );
        window.location.href = `/signup?redirectTo=${returnTo}`;
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Checkout failed. Please try again.');
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

  const triggerMessages: Record<PaywallTrigger, string | null> = {
    full_report: 'Unlock the complete vulnerability report with a paid plan.',
    second_scan: 'Free scans are limited — upgrade for unlimited monitoring.',
    add_website: 'Add more websites and enable continuous protection.',
    export: 'Export full reports with a paid subscription.',
    manual: null,
  };

  const triggerMessage = trigger ? triggerMessages[trigger] : null;
  const protectCta = ctaText ?? getPersonalizedCta(domain, 'protect');

  const headline =
    adaptiveConfig.ctaStyle === 'aggressive' && adaptiveConfig.showUrgency
      ? urgency.headline
      : adaptiveConfig.ctaStyle === 'educational'
        ? 'Compare plans and find the right protection level'
        : urgency.headline;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-700 bg-gray-950 shadow-2xl">
        <div className="border-b border-gray-800 p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-white"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {adaptiveConfig.showUrgency && urgencyLevel !== 'low' && (
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                urgency.level === 'high'
                  ? 'text-red-400'
                  : urgency.level === 'medium'
                    ? 'text-yellow-400'
                    : 'text-green-400'
              }`}
            >
              {urgency.level === 'high' ? 'Urgent' : urgency.level === 'medium' ? 'Action needed' : 'Recommended'}
            </p>
          )}
          <h2 className="mt-2 text-xl font-bold text-white">{headline}</h2>
          <p className="mt-2 text-sm text-gray-400">{urgency.subtext}</p>
          {triggerMessage && (
            <p className="mt-2 text-sm text-blue-400">{triggerMessage}</p>
          )}
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-4 p-6 sm:grid-cols-3">
          {BILLED_PLANS.map((plan) => {
            const limits = PLAN_LIMITS[plan];
            const isHighlighted = plan === highlightPlan;
            return (
              <div
                key={plan}
                className={`relative flex flex-col rounded-xl border p-5 ${
                  isHighlighted
                    ? 'border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30'
                    : 'border-gray-800 bg-gray-900/40'
                }`}
              >
                {isHighlighted && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {adaptiveConfig.showPricingPressure ? 'Best Value' : 'Recommended'}
                  </span>
                )}
                {plan === 'growth' && PLAN_LIMITS.growth.mostPopular && !isHighlighted && (
                  <span className="mb-2 self-start rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                    Most Popular
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
                <button
                  type="button"
                  onClick={() => handleCheckout(plan)}
                  disabled={loading !== null}
                  className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    isHighlighted
                      ? adaptiveConfig.ctaStyle === 'aggressive'
                        ? 'bg-red-600 text-white hover:bg-red-500'
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  {loading === plan ? 'Redirecting…' : isHighlighted ? protectCta : `Choose ${limits.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {trustSignals && (
          <div className="mx-6 mb-2 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
            <span>✓ 30-day money-back guarantee</span>
            <span>✓ Cancel anytime</span>
            <span>✓ Secure Stripe checkout</span>
          </div>
        )}

        <div className="border-t border-gray-800 px-6 py-4 text-center">
          <p className="text-sm text-gray-400">{protectCta}</p>
        </div>
      </div>
    </div>
  );
}
