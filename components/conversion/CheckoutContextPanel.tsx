'use client';

import { readFunnelSession, hostnameFromUrl, type FunnelSessionState } from '@/lib/funnel/session';
import type { BilledPlan } from '@/lib/billing/plans';

interface CheckoutContextPanelProps {
  open: boolean;
  plan: BilledPlan;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  funnelState?: FunnelSessionState | null;
}

const PRO_UNLOCKS = [
  'Full vulnerability report with remediation steps',
  'Daily automated scans & email alerts',
  'Attack surface & change detection monitoring',
  'Exploit scenario analysis',
];

export default function CheckoutContextPanel({
  open,
  plan,
  onConfirm,
  onCancel,
  loading = false,
  funnelState,
}: CheckoutContextPanelProps) {
  if (!open) return null;

  const state = funnelState ?? readFunnelSession();
  const hostname = state ? hostnameFromUrl(state.scanned_site) : null;
  const score = state?.score;
  const issues = state?.issue_count ?? 0;
  const planLabel = plan === 'growth' ? 'Continuous Protection' : plan === 'pro' ? 'Pro' : plan;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-labelledby="checkout-context-title"
        className="relative w-full max-w-lg overflow-hidden rounded-t-2xl border border-gray-700 bg-gray-950 shadow-2xl sm:rounded-2xl"
      >
        <div className="border-b border-gray-800 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Before checkout
          </p>
          <h2 id="checkout-context-title" className="mt-2 text-xl font-bold text-white">
            {hostname
              ? `${planLabel} for ${hostname}`
              : `Upgrade to ${planLabel}`}
          </h2>
          {state && (
            <div className="mt-4 flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
              <div
                className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 ${
                  score != null && score < 70
                    ? 'border-red-500/40 text-red-400'
                    : 'border-yellow-500/40 text-yellow-400'
                }`}
              >
                <span className="text-2xl font-bold">{score ?? '—'}</span>
                <span className="text-[10px] text-gray-500">/100</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {issues > 0
                    ? `${issues} issue${issues !== 1 ? 's' : ''} detected`
                    : 'Security gaps found'}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {planLabel} unlocks full reports and continuous protection
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            What {planLabel} unlocks
          </p>
          <ul className="space-y-2">
            {PRO_UNLOCKS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? 'Redirecting to secure checkout…' : 'Continue to checkout'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="w-full py-2 text-sm text-gray-500 transition-colors hover:text-gray-300 disabled:opacity-60"
            >
              Go back
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-600">
            Secure Stripe checkout · Cancel anytime · 30-day guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
