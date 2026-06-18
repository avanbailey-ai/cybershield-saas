'use client';

import { useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import type { CustomerHealthSummary } from '@/lib/owner/customerHealth';
import type { CustomerExpansionSummary } from '@/lib/owner/customerExpansion';
import type { RevenueAtRiskSummary } from '@/lib/owner/revenueAtRisk';

export default function CustomerRiskExpansionSection({
  health,
  expansion,
  revenue,
}: {
  health: CustomerHealthSummary;
  expansion: CustomerExpansionSummary;
  revenue: RevenueAtRiskSummary;
}) {
  const { refreshFounderData, setSection } = useFounderNav();
  const [busy, setBusy] = useState<string | null>(null);

  const atRisk = health.customers.filter((c) => c.status !== 'Healthy').slice(0, 5);
  const expansions = expansion.opportunities.slice(0, 3);

  async function approveRetention(userId: string, mrr: number) {
    setBusy(userId);
    try {
      await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          ids: [`churn-${userId}`],
          meta: { userId, mrr },
        }),
      });
      await refreshFounderData();
    } finally {
      setBusy(null);
    }
  }

  async function approveExpansion(userId: string, mrrGain: number, toPlan: string) {
    setBusy(`exp-${userId}`);
    try {
      await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          ids: [`exp-${userId}`],
          meta: { userId, mrrGain, toPlan },
        }),
      });
      await refreshFounderData();
    } finally {
      setBusy(null);
    }
  }

  if (atRisk.length === 0 && expansions.length === 0 && revenue.totalMrrAtRisk === 0) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Customer risk &amp; expansion
        </h2>
        <p className="mt-4 text-sm text-emerald-400">
          All paying customers healthy — no retention or expansion actions needed.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-amber-400/80">
          Customer risk &amp; expansion
        </h2>
        <button
          type="button"
          onClick={() => setSection('success')}
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          Open success center →
        </button>
      </div>

      {revenue.totalMrrAtRisk > 0 && (
        <p className="mt-2 text-sm text-amber-200/90">
          ${revenue.totalMrrAtRisk}/mo at risk across {revenue.affectedCustomers.length} account(s)
        </p>
      )}

      {atRisk.length > 0 && (
        <ul className="mt-4 space-y-2">
          {atRisk.map((c) => (
            <li
              key={c.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{c.email}</p>
                <p className="text-xs text-gray-500">
                  {c.status} · ${c.mrr}/mo · {c.score}/100
                </p>
                <p className="mt-1 text-xs text-amber-200/80">
                  {c.recommendedActions[0] ?? c.reasons.find((r) => !r.ok)?.label}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === c.userId}
                onClick={() => approveRetention(c.userId, c.mrr)}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {busy === c.userId ? 'Sending…' : 'Approve retention'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {expansions.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
          {expansions.map((o) => (
            <li
              key={o.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/10 bg-black/20 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{o.email}</p>
                <p className="text-xs text-emerald-300">
                  {o.currentPlanLabel} → {o.recommendedPlanLabel} (+${o.mrrGain}/mo)
                </p>
              </div>
              <button
                type="button"
                disabled={busy === `exp-${o.userId}`}
                onClick={() => approveExpansion(o.userId, o.mrrGain, o.recommendedPlan)}
                className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                {busy === `exp-${o.userId}` ? 'Sending…' : 'Approve upgrade'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
