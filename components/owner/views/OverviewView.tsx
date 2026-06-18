'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import type { FounderSectionId } from '@/lib/owner/founderNav';
import type { CeoDashboard, CeoPriority } from '@/lib/owner/ceoDashboard';

const FOCUS_STORAGE_KEY = 'founder-focus-done';

function impactColor(impact: CeoPriority['impact']): string {
  switch (impact) {
    case 'critical':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'high':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    default:
      return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  }
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default function OverviewView({ ceoDashboard: d }: { ceoDashboard: CeoDashboard }) {
  const { setSection } = useFounderNav();
  const [focusDone, setFocusDone] = useState<Record<string, boolean>>({});
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
      if (raw) setFocusDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFocus = useCallback((id: string) => {
    setFocusDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const s = d.snapshot;
  const visibleFocus = d.focusBlock.filter((step) => !hideCompleted || !focusDone[step.id]);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-wider text-violet-400">Founder OS</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">CyberShield Today</h1>
        <p className="mt-2 text-sm text-gray-500">
          {new Date(d.generatedAt).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      {/* Section 1 — CEO Snapshot */}
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">CEO snapshot</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="MRR" value={`$${s.mrr.toLocaleString()}`} />
          <Metric label="ARR" value={`$${s.arr.toLocaleString()}`} />
          <Metric
            label="Customers"
            value={s.payingCustomers > 0 ? s.payingCustomers : '—'}
          />
          <Metric label="Trial users" value={s.trialUsers} />
          <Metric label="New signups today" value={s.newSignupsToday} />
          <Metric label="Scans today" value={s.scansToday} />
          <Metric
            label="Conversion"
            value={s.newSignupsToday > 0 ? `${s.conversionRate}%` : '—'}
          />
          <Metric label="Churn risk" value={s.churnRiskLevel} />
        </div>
        {s.payingCustomers === 0 && s.mrr === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No paying customers yet. First goal: convert one signup into a paying customer.
          </p>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-gray-300">{d.interpretation}</p>
        )}
        {s.growth30dPct !== 0 && (
          <p className="mt-2 text-xs text-gray-500">
            30-day signup trend: {s.growth30dPct >= 0 ? '+' : ''}
            {s.growth30dPct}%
          </p>
        )}
      </section>

      {/* What should I do next */}
      {d.nextAction && (
        <section className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-300">
            What should I do next?
          </p>
          <p className="mt-2 text-lg font-medium text-white">{d.nextAction.title}</p>
          <p className="mt-1 text-sm text-gray-400">{d.nextAction.reason}</p>
          <button
            type="button"
            onClick={() => setSection(d.nextAction!.module as FounderSectionId)}
            className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            {d.nextAction.cta} →
          </button>
        </section>
      )}

      {/* Section 2 — What Changed Today */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
          What changed today
        </h2>
        {d.changesToday.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-sm text-gray-400">
            No major business changes today. Focus on outreach and onboarding.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {d.changesToday.map((c) => (
              <li
                key={c.label}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm"
              >
                <span className="text-gray-400">{c.label}</span>
                <span className="font-medium text-white">{c.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Revenue at risk + Next $1k */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Revenue at risk
          </h2>
          <p className="mt-2 text-sm text-gray-400">{d.revenueAtRisk.summary}</p>
          {d.revenueAtRisk.items.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-gray-300">
              {d.revenueAtRisk.items.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No elevated risks from current data.</p>
          )}
        </section>
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Next $1,000 MRR path
          </h2>
          <p className="mt-2 text-sm text-gray-400">{d.next1kPath.summary}</p>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-gray-300">
            {d.next1kPath.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </div>

      {/* Section 3 — Revenue Opportunities */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
          Revenue opportunities
        </h2>
        {d.opportunities.length === 0 ? (
          <p className="text-sm text-gray-500">
            No revenue opportunities yet. Run discovery and scans to surface outreach-ready prospects.
          </p>
        ) : (
          <ul className="space-y-3">
            {d.opportunities.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{o.title}</p>
                    {o.estimatedMrr !== null && (
                      <p className="mt-1 text-sm text-emerald-400">
                        Estimated opportunity: ${o.estimatedMrr.toLocaleString()}/mo
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500">{o.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSection(o.module as FounderSectionId)}
                    className="shrink-0 text-sm font-medium text-violet-400 hover:text-violet-300"
                  >
                    {o.action} →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 4 — Today's Priorities */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
          Today&apos;s priorities
        </h2>
        <ol className="space-y-3">
          {d.priorities.map((p, i) => (
            <li
              key={p.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-gray-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{p.title}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${impactColor(p.impact)}`}
                    >
                      {p.impact}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{p.reason}</p>
                  <p className="mt-1 text-xs text-gray-600">Outcome: {p.expectedOutcome}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSection(p.module as FounderSectionId)}
                  className="shrink-0 rounded-lg border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/10"
                >
                  {p.cta}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section 5 — Founder Focus Mode */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Today&apos;s 90-minute growth block
          </h2>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            Hide completed
          </label>
        </div>
        <ol className="mt-4 space-y-2">
          {visibleFocus.map((step, i) => (
            <li key={step.id} className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => toggleFocus(step.id)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  focusDone[step.id]
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-gray-600 text-transparent'
                }`}
                aria-label={focusDone[step.id] ? 'Mark incomplete' : 'Mark complete'}
              >
                ✓
              </button>
              <span className={focusDone[step.id] ? 'text-gray-600 line-through' : 'text-gray-300'}>
                {i + 1}. {step.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Section 6 — Business Warnings */}
      {d.warnings.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
            Business warnings
          </h2>
          <ul className="space-y-2">
            {d.warnings.map((w) => (
              <li
                key={w.id}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  w.severity === 'critical'
                    ? 'border-red-500/30 bg-red-500/5 text-red-200'
                    : 'border-amber-500/30 bg-amber-500/5 text-amber-100'
                }`}
              >
                <span>{w.message}</span>
                {w.action && w.module && (
                  <button
                    type="button"
                    onClick={() => setSection(w.module as FounderSectionId)}
                    className="ml-2 font-medium underline hover:no-underline"
                  >
                    {w.action}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
