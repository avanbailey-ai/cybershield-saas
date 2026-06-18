'use client';

import { useFounderNav } from '../FounderNavContext';
import EmptyState from '../EmptyState';

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
  const health = founderData.v6.customerHealth;
  const revenue = founderData.v6.revenueAtRisk;
  const expansion = founderData.v6.expansion;
  const mrr = founderData.v6.homeSummary.mrr;

  if (health.customers.length === 0) {
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

  const totalMrr = health.customers.reduce((s, c) => s + c.mrr, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Customers</h1>
        <p className="mt-2 text-gray-500">
          {health.customers.length} paying customer{health.customers.length === 1 ? '' : 's'} · $
          {totalMrr}/mo MRR
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Paying customers" value={String(health.customers.length)} />
        <Metric label="Total MRR" value={`$${mrr}`} tone="text-emerald-400" />
        <Metric
          label="At risk"
          value={String(health.atRisk + health.critical)}
          tone={health.atRisk + health.critical > 0 ? 'text-amber-400' : 'text-emerald-400'}
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
          {health.customers.map((c) => (
            <li key={c.userId} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium text-white">{c.email}</p>
                <p className="text-xs text-gray-500">
                  {c.plan} · ${c.mrr}/mo · {c.websiteCount}{' '}
                  {c.websiteCount === 1 ? 'website' : 'websites'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span
                  className={
                    c.status === 'Healthy'
                      ? 'text-emerald-400'
                      : c.status === 'At Risk'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }
                >
                  {c.score}/100 · {c.status}
                </span>
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
