'use client';

import { useState } from 'react';
import type { BusinessHealthMetrics } from '@/lib/owner/businessHealthMetrics';

function Metric({
  label,
  value,
  tone,
  onExplain,
}: {
  label: string;
  value: string;
  tone?: string;
  onExplain?: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            className="text-[10px] text-violet-400 hover:text-violet-300"
          >
            View calculation
          </button>
        )}
      </div>
      <p className={`mt-1 text-xl font-semibold ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function BusinessHealthSection({ metrics }: { metrics: BusinessHealthMetrics }) {
  const [modal, setModal] = useState<'mrr' | 'conversion' | null>(null);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Business health
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Real subscriptions only · updated {new Date(metrics.calculation.generatedAt).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Metric
          label="MRR"
          value={`$${metrics.mrr.toLocaleString()}`}
          tone="text-emerald-400"
          onExplain={() => setModal('mrr')}
        />
        <Metric label="ARR" value={`$${metrics.arr.toLocaleString()}`} />
        <Metric label="Paying customers" value={String(metrics.payingCustomers)} />
        <Metric label="Trials" value={String(metrics.activeTrials)} />
        <Metric label="New signups (30d)" value={String(metrics.newSignups30d)} />
        <Metric
          label="Conversion"
          value={`${metrics.conversionRate}%`}
          onExplain={() => setModal('conversion')}
        />
        <Metric
          label="Churn risk"
          value={`${metrics.churnRisk} (${metrics.churnRiskCount})`}
          tone={
            metrics.churnRisk === 'High'
              ? 'text-red-400'
              : metrics.churnRisk === 'Medium'
                ? 'text-amber-400'
                : 'text-emerald-400'
          }
        />
        <Metric
          label="Revenue at risk"
          value={metrics.revenueAtRisk > 0 ? `$${metrics.revenueAtRisk}/mo` : 'None'}
          tone={metrics.revenueAtRisk > 0 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <Metric
          label="Goal progress"
          value={`${metrics.goalProgressPct}% of $${metrics.mrrGoal}`}
          tone="text-violet-300"
        />
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">
                {modal === 'mrr' ? 'MRR calculation' : 'Conversion calculation'}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
            {modal === 'mrr' ? (
              <div className="mt-4 space-y-3 text-sm text-gray-300">
                <p>
                  Current MRR: <strong className="text-white">${metrics.calculation.mrr.value}</strong>
                </p>
                <p>Plans counted: {metrics.calculation.mrr.includedPlans.join(', ')}</p>
                <ul className="list-disc space-y-1 pl-5 text-gray-400">
                  {metrics.calculation.mrr.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {metrics.calculation.mrr.excludedAccounts.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Excluded test accounts: {metrics.calculation.mrr.excludedAccounts.slice(0, 5).join(', ')}
                    {metrics.calculation.mrr.excludedAccounts.length > 5 ? '…' : ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-gray-300">
                <p>
                  Conversion rate:{' '}
                  <strong className="text-white">{metrics.calculation.conversion.value}%</strong>
                </p>
                <p>
                  {metrics.calculation.conversion.upgradedInWindow} paid upgrades /{' '}
                  {metrics.calculation.conversion.newSignups} signups (
                  {metrics.calculation.conversion.windowDays}d window)
                </p>
                <ul className="list-disc space-y-1 pl-5 text-gray-400">
                  {metrics.calculation.conversion.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
