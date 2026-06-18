'use client';

import { useCallback, useState } from 'react';
import type { FounderOsV6Data } from '@/lib/owner/founderOsV6';

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  const colors =
    status === 'Healthy'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : status === 'At Risk'
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : 'text-red-400 bg-red-500/10 border-red-500/20';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}

export default function CustomerSuccessView({ initial }: { initial: FounderOsV6Data }) {
  const [data, setData] = useState(initial);
  const health = data.v6.customerHealth;
  const revenue = data.v6.revenueAtRisk;
  const expansion = data.v6.expansion;

  const refresh = useCallback(async () => {
    const res = await fetch('/api/owner/founder-os');
    const json = await res.json();
    if (json.data) setData(json.data);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Customer Success</h1>
          <p className="mt-2 text-gray-500">Health, retention, expansion, and revenue protection</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-sm text-violet-400 hover:text-violet-300"
        >
          Refresh
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Healthy" value={String(health.healthy)} tone="text-emerald-400" />
        <Metric label="At risk" value={String(health.atRisk)} tone="text-amber-400" />
        <Metric label="Critical" value={String(health.critical)} tone="text-red-400" />
        <Metric label="Inactive 30d+" value={String(health.inactive)} />
        <Metric
          label="MRR at risk"
          value={revenue.totalMrrAtRisk > 0 ? `$${revenue.totalMrrAtRisk}` : '—'}
          tone="text-amber-300"
        />
      </section>

      {revenue.affectedCustomers.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-amber-400/80">
            Revenue at risk
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Potential monthly loss: ${revenue.potentialMonthlyLoss}
          </p>
          <ul className="mt-4 space-y-3">
            {revenue.affectedCustomers.slice(0, 8).map((c) => (
              <li
                key={c.userId}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{c.email}</p>
                  <p className="text-xs text-gray-500">
                    {c.plan} · ${c.mrr}/mo
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {c.reasons.map((r) => (
                      <li key={r} className="text-xs text-amber-200/80">
                        ✗ {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right text-xs text-gray-400">
                  {c.suggestedActions.slice(0, 2).map((a) => (
                    <p key={a}>{a}</p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {expansion.opportunities.length > 0 && (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-emerald-400/80">
            Expansion opportunities
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            +${expansion.totalPotentialMrr}/mo potential · {expansion.highProbability} high
            probability
          </p>
          <ul className="mt-4 space-y-3">
            {expansion.opportunities.slice(0, 8).map((o) => (
              <li
                key={o.userId}
                className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{o.email}</p>
                  <span className="text-xs text-emerald-300">
                    {o.currentPlanLabel} → {o.recommendedPlanLabel} (+${o.mrrGain}/mo)
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {o.probability} probability · {o.websiteCount} sites
                </p>
                <ul className="mt-2 space-y-0.5">
                  {o.signals.map((s) => (
                    <li key={s} className="text-xs text-gray-400">
                      ✓ {s}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Customer health
        </h2>
        {health.customers.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No paying customers yet. Health scores appear when users subscribe and engage.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {health.customers.map((c) => (
              <li
                key={c.userId}
                className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{c.email}</p>
                    <p className="text-xs text-gray-500">
                      {c.plan} · ${c.mrr}/mo · {c.websiteCount} site
                      {c.websiteCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{c.score}/100</span>
                    <HealthBadge status={c.status} />
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {c.reasons.slice(0, 4).map((r) => (
                    <li key={r.label} className="text-xs text-gray-400">
                      {r.ok ? '✓' : '✗'} {r.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
