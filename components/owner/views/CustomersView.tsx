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
  const { founderData, setSection } = useFounderNav();
  const [directory, setDirectory] = useState<CustomerDirectoryEntry[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);
  const revenue = founderData.v6.revenueAtRisk;
  const expansion = founderData.v6.expansion;

  useEffect(() => {
    fetch('/api/owner/customers')
      .then((r) => r.json())
      .then((d) => {
        if (d.customers) setDirectory(d.customers);
        if (d.totalMrr != null) setTotalMrr(d.totalMrr);
      });
  }, [founderData.generatedAt]);

  if (directory.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Customers</h1>
          <p className="mt-2 text-gray-500">Your paying customer directory</p>
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
        <h1 className="text-3xl font-semibold tracking-tight text-white">Customers</h1>
        <p className="mt-2 text-gray-500">
          {directory.length} paying customer{directory.length === 1 ? '' : 's'} · ${totalMrr}/mo
          MRR
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Paying customers" value={String(directory.length)} />
        <Metric label="Total MRR" value={`$${totalMrr}`} tone="text-emerald-400" />
        <Metric
          label="At risk"
          value={String(directory.filter((c) => c.healthStatus !== 'Healthy').length)}
          tone={
            directory.some((c) => c.healthStatus !== 'Healthy')
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
          {directory.map((c) => (
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
