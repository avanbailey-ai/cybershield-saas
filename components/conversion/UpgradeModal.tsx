'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PLAN_LIMITS,
  BILLED_PLANS,
  type BilledPlan,
} from '@/lib/billing/plans';
import { getPlanMarketing } from '@/lib/billing/planFeatures';
import { getUrgencyMessage } from '@/lib/conversion/urgency';
import { getPersonalizedCta } from '@/lib/conversion/personalize';
import { trackEvent, getSessionId } from '@/lib/analytics/events';
import { useAdaptiveConfig } from '@/components/analytics/AdaptiveCTA';
import { getVariantClient } from '@/lib/analytics/experimentsClient';
import { useDisplayPrices } from '@/lib/billing/useDisplayPrices';
import { formatDisplayPrice } from '@/lib/billing/formatPrice';
import type { PaywallTrigger } from './ConversionProvider';
import CheckoutContextPanel from './CheckoutContextPanel';
import SecurityCoverageBar from './SecurityCoverageBar';
import { computeSecurityCoverage } from '@/lib/conversion/coverage';

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
  const [checkoutPlan, setCheckoutPlan] = useState<BilledPlan | null>(null);
  const { config: adaptiveConfig } = useAdaptiveConfig();
  const { prices } = useDisplayPrices();

  const urgency = getUrgencyMessage(score, domain);
  const highlightPlan =
    recommendedPlan ?? autopilotPlan ?? adaptiveConfig.highlightPlan ?? urgency.highlightPlan;
  const coveragePercent = computeSecurityCoverage(3, Math.max(6, 3 + (score < 60 ? 4 : 2)));

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

  async function proceedToCheckout(plan: BilledPlan) {
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
      setCheckoutPlan(null);
    }
  }

  function handleCheckoutClick(plan: BilledPlan) {
    setCheckoutPlan(plan);
  }

  const triggerMessages: Record<PaywallTrigger, string | null> = {
    full_report: 'Your full report includes deeper issue context, remediation steps, and monitoring options that are not enabled on the Free plan.',
    second_scan: 'One-time scans miss new threats. Enable continuous protection to stay covered.',
    add_website: 'Add more websites and enable continuous protection.',
    export: 'Export full reports with continuous protection enabled.',
    scan_limit: "You've reached your scan limit — enable protection for higher daily limits.",
    queue_busy: 'Enable protection for priority processing and faster scan throughput.',
    manual: null,
  };

  const triggerMessage = trigger ? triggerMessages[trigger] : null;
  const protectCta = ctaText ?? getPersonalizedCta(domain, 'protect');
  const enterpriseHref = domain
    ? `/enterprise/review?domain=${encodeURIComponent(domain)}&score=${score}&source=upgrade_modal`
    : '/enterprise/review';

  const headline =
    trigger === 'full_report'
      ? 'Unlock full protection report'
      : trigger === 'second_scan' || trigger === 'scan_limit'
        ? 'Start continuous protection'
        : score < 60
          ? 'Get guided fixes for vulnerabilities'
          : adaptiveConfig.ctaStyle === 'educational'
            ? 'Enable the protection you\'re missing'
            : urgency.headline;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-labelledby="upgrade-modal-title"
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-gray-700 bg-gray-950 shadow-2xl sm:rounded-2xl"
      >
        <div className="border-b border-gray-800 p-5 sm:p-6">
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
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Enable protection
          </p>
          <h2 id="upgrade-modal-title" className="mt-2 pr-8 text-xl font-bold text-white sm:text-2xl">
            {headline}
          </h2>
          <p className="mt-2 text-sm text-gray-400">{urgency.subtext}</p>
          <SecurityCoverageBar percent={coveragePercent} className="mt-4 max-w-md" />
          {triggerMessage && (
            <p className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-blue-300">
              {triggerMessage}
            </p>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 sm:mx-6">
            {error}
          </div>
        )}

        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          {BILLED_PLANS.map((plan) => {
            const limits = PLAN_LIMITS[plan];
            const marketing = getPlanMarketing(plan);
            const isHighlighted = plan === highlightPlan;
            const isGrowth = plan === 'growth';
            return (
              <div
                key={plan}
                className={`relative flex flex-col rounded-xl border p-4 sm:p-5 ${
                  isHighlighted
                    ? 'border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30'
                    : 'border-gray-800 bg-gray-900/40'
                }`}
              >
                {isHighlighted && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {isGrowth ? 'Most Popular' : 'Recommended'}
                  </span>
                )}
                <h3 className="text-base font-bold text-white sm:text-lg">{limits.name}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{marketing.tagline}</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {formatDisplayPrice(prices[plan])}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-gray-400">
                  <li>{marketing.websiteLabel}</li>
                  <li>{marketing.monitoringLabel}</li>
                  <li>{marketing.deepScanLabel}</li>
                </ul>
                {isHighlighted ? (
                  <button
                    type="button"
                    onClick={() => handleCheckoutClick(plan)}
                    disabled={loading !== null}
                    className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
                  >
                    {loading === plan ? 'Redirecting…' : protectCta}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCheckoutClick(plan)}
                    disabled={loading !== null}
                    className="mt-4 w-full rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-60"
                  >
                    {loading === plan ? 'Redirecting…' : 'Enable protection'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {trustSignals && (
          <div className="mx-5 mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 sm:mx-6">
            <span>30-day money-back guarantee</span>
            <span>Cancel anytime</span>
            <span>Secure Stripe checkout</span>
          </div>
        )}

        <div className="border-t border-gray-800 px-5 py-4 text-center sm:px-6">
          <p className="text-xs text-gray-500">
            Regulated team or need SSO, audit logs, or a custom SLA?{' '}
            <Link
              href={enterpriseHref}
              onClick={() =>
                trackEvent('upgrade_clicked', { domain, trigger: 'enterprise_cta' })
              }
              className="font-medium text-amber-400 hover:text-amber-300"
            >
              Request enterprise review
            </Link>
          </p>
        </div>
      </div>

      <CheckoutContextPanel
        open={checkoutPlan != null}
        plan={checkoutPlan ?? 'pro'}
        loading={loading != null}
        onConfirm={() => checkoutPlan && proceedToCheckout(checkoutPlan)}
        onCancel={() => setCheckoutPlan(null)}
      />
    </div>
  );
}
