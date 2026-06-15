'use client';

import { useEffect, useState } from 'react';
import { trackEvent } from '@/lib/conversion/track';
import { getLastScannedDomain } from '@/lib/conversion/limits';
import { getPersonalizedCta } from '@/lib/conversion/personalize';

const SHOWN_KEY = 'cybershield_exit_intent_shown';

interface ExitIntentModalProps {
  enabled?: boolean;
}

export default function ExitIntentModal({ enabled = true }: ExitIntentModalProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (sessionStorage.getItem(SHOWN_KEY)) return;

    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY > 0) return;
      if (sessionStorage.getItem(SHOWN_KEY)) return;
      sessionStorage.setItem(SHOWN_KEY, '1');
      setVisible(true);
      trackEvent('paywall_viewed', { trigger: 'exit_intent', domain: getLastScannedDomain() ?? undefined });
    }

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [enabled]);

  if (!visible) return null;

  const domain = getLastScannedDomain();
  const cta = getPersonalizedCta(domain, 'protect');

  async function handleCheckout() {
    setLoading(true);
    trackEvent('upgrade_clicked', { plan: 'growth', trigger: 'exit_intent', domain: domain ?? undefined });
    trackEvent('checkout_started', { plan: 'growth', trigger: 'exit_intent', domain: domain ?? undefined });

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'growth' }),
      });
      const data = await res.json();

      if (res.status === 401) {
        window.location.href = `/signup?redirectTo=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Silent fail — user can dismiss
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setVisible(false)}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-950 p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="absolute right-4 top-4 text-gray-500 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Before you go</p>
        <h2 className="mt-2 text-xl font-bold text-white">Your scan results are ready</h2>
        <p className="mt-3 text-sm text-gray-400">
          A one-time scan can&apos;t catch new threats. Upgrade for daily monitoring
          {domain ? ` on ${domain}` : ''} and real-time alerts.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? 'Redirecting…' : cta}
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            No thanks, I&apos;ll risk it
          </button>
        </div>
      </div>
    </div>
  );
}
