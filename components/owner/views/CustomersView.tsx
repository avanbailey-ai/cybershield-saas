'use client';

import { useEffect, useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import EmptyState from '../EmptyState';
import type { CustomerDirectoryEntry } from '@/lib/owner/customerDirectory';

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function CustomersView() {
  const { founderData, refreshFounderData, setSection } = useFounderNav();
  const [directory, setDirectory] = useState<CustomerDirectoryEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const business = founderData.v6.businessHealth;
  const revenue = founderData.v6.revenueAtRisk;
  const expansion = founderData.v6.expansion;
  const healthCustomers = founderData.v6.customerHealth.customers;

  useEffect(() => {
    fetch('/api/owner/customers')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.customers) && d.customers.length > 0) {
          setDirectory(d.customers);
        }
      })
      .catch(() => {});
  }, [founderData.generatedAt]);

  const displayDirectory: CustomerDirectoryEntry[] =
    directory.length > 0
      ? directory
      : healthCustomers.map((c) => ({
          userId: c.userId,
          email: c.email,
          plan: c.plan,
          planLabel: c.plan,
          mrr: c.mrr,
          healthScore: c.score,
          healthStatus: c.status,
          lastLoginAt: c.lastActivityAt,
          websites: [],
          scansLast30Days: 0,
          alertsLast30Days: 0,
          risks: c.reasons.filter((r) => !r.ok).map((r) => r.label).slice(0, 4),
          expansionOpportunity: null,
          nextAction: c.recommendedActions[0] ?? 'Monitor — healthy',
        }));

  const displayMrr = business.mrr;
  const payingCount = business.payingCustomers;

  async function sendRetention(userId: string) {
    setBusy(`ret-${userId}`);
    try {
      await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', ids: [`churn-${userId}`], meta: { userId } }),
      });
      await refreshFounderData();
    } finally {
      setBusy(null);
    }
  }

  async function sendUpgrade(userId: string, mrrGain: number, toPlan: string) {
    setBusy(`up-${userId}`);
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

  async function markStatus(userId: string, action: 'mark_healthy' | 'mark_at_risk') {
    setBusy(`${action}-${userId}`);
    try {
      await fetch(`/api/owner/customers/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const res = await fetch('/api/owner/customers');
      const d = await res.json();
      if (d.customers?.length) setDirectory(d.customers);
      await refreshFounderData();
    } finally {
      setBusy(null);
    }
  }

  if (payingCount === 0 && displayDirectory.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Revenue protection</h1>
          <p className="mt-2 text-gray-500">Paying customer directory and retention actions</p>
        </header>
        <EmptyState
          title="No paying customers yet"
          description="Customer health and retention insights appear as users subscribe and engage."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Revenue protection</h1>
        <p className="mt-2 text-gray-500">
          {payingCount} paying customer{payingCount === 1 ? '' : 's'} · ${displayMrr}/mo MRR
          <span className="text-gray-600"> · synced with Home metrics</span>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Paying customers" value={String(payingCount)} />
        <Metric label="Total MRR" value={`$${displayMrr}`} tone="text-emerald-400" />
        <Metric
          label="At risk"
          value={String(displayDirectory.filter((c) => c.healthStatus !== 'Healthy').length)}
          tone={
            displayDirectory.some((c) => c.healthStatus !== 'Healthy')
              ? 'text-amber-400'
              : 'text-emerald-400'
          }
        />
        <Metric
          label="Expansion potential"
          value={expansion.totalPotentialMrr > 0 ? `+$${expansion.totalPotentialMrr}/mo` : '—'}
          tone="text-violet-300"
        />
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Customer directory
          </h2>
          <button
            type="button"
            onClick={() => setSection('success')}
            className="text-xs text-violet-400 hover:text-violet-300"
          >
            Open success center →
          </button>
        </div>
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {displayDirectory.map((c) => (
            <li key={c.userId} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{c.email}</p>
                  <p className="text-xs text-gray-500">
                    {c.planLabel} · ${c.mrr}/mo · {c.websites.length}{' '}
                    {c.websites.length === 1 ? 'website' : 'websites'}
                  </p>
                  {c.lastLoginAt && (
                    <p className="mt-1 text-xs text-gray-600">
                      Last activity: {new Date(c.lastLoginAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span
                  className={
                    c.healthStatus === 'Healthy'
                      ? 'text-emerald-400'
                      : c.healthStatus === 'At Risk'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }
                >
                  {c.healthScore}/100 · {c.healthStatus}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-gray-400 sm:grid-cols-4">
                <span>Scans (30d): {c.scansLast30Days}</span>
                <span>Alerts (30d): {c.alertsLast30Days}</span>
                {c.expansionOpportunity && (
                  <span className="text-violet-300">
                    Upgrade: +${c.expansionOpportunity.mrrGain}/mo
                  </span>
                )}
                <span className="text-violet-400">Next: {c.nextAction}</span>
              </div>
              {c.risks.length > 0 && (
                <p className="mt-2 text-xs text-amber-400/90">Risks: {c.risks.join(' · ')}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {c.healthStatus !== 'Healthy' && (
                  <button
                    type="button"
                    disabled={busy === `ret-${c.userId}`}
                    onClick={() => sendRetention(c.userId)}
                    className="min-h-[40px] rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {busy === `ret-${c.userId}` ? 'Sending…' : 'Send retention'}
                  </button>
                )}
                {c.expansionOpportunity && (
                  <button
                    type="button"
                    disabled={busy === `up-${c.userId}`}
                    onClick={() =>
                      sendUpgrade(
                        c.userId,
                        c.expansionOpportunity!.mrrGain,
                        c.expansionOpportunity!.recommendedPlan,
                      )
                    }
                    className="min-h-[40px] rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    {busy === `up-${c.userId}` ? 'Sending…' : 'Send upgrade email'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy === `mark_healthy-${c.userId}`}
                  onClick={() => markStatus(c.userId, 'mark_healthy')}
                  className="min-h-[40px] rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 disabled:opacity-50"
                >
                  Mark healthy
                </button>
                <button
                  type="button"
                  disabled={busy === `mark_at_risk-${c.userId}`}
                  onClick={() => markStatus(c.userId, 'mark_at_risk')}
                  className="min-h-[40px] rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 disabled:opacity-50"
                >
                  Mark at risk
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {revenue.affectedCustomers.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-200/90">
          ${revenue.totalMrrAtRisk}/mo at risk —{' '}
          <button
            type="button"
            onClick={() => setSection('success')}
            className="text-violet-300 underline hover:text-violet-200"
          >
            review in success center
          </button>
        </div>
      )}
    </div>
  );
}
