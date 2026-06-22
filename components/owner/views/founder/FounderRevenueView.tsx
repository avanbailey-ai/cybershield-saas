'use client';

import { useState } from 'react';
import {
  FounderMetricCard,
  FounderMetricOrEmpty,
  FounderPanel,
  FounderSectionHeader,
} from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';

export default function FounderRevenueView({ data }: { data: FounderCommandCenterData }) {
  const r = data.revenue;
  const [costInput, setCostInput] = useState(
    r.monthlyCosts != null ? String(r.monthlyCosts) : '',
  );
  const [saved, setSaved] = useState(false);

  async function saveCosts() {
    const amount = parseFloat(costInput);
    if (Number.isNaN(amount) || amount < 0) return;
    await fetch('/api/owner/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyCosts: { amount } }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <FounderSectionHeader
        title="Revenue"
        subtitle="MRR from active subscriptions (profiles × Stripe display prices). No fabricated costs."
        updatedAt={r.generatedAt}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FounderMetricCard label="MRR" value={`$${r.mrr.toLocaleString()}`} />
        <FounderMetricCard label="ARR" value={`$${r.arr.toLocaleString()}`} />
        <FounderMetricCard label="Active paid accounts" value={r.activePaidAccounts} />
        <FounderMetricCard label="Monthly gross" value={`$${r.monthlyGrossRevenue.toLocaleString()}`} />
        <FounderMetricCard label="Free users" value={r.freeUsers} />
        <FounderMetricCard label="Trialing" value={r.trialingUsers} />
        <FounderMetricCard label="Canceled" value={r.canceledUsers} />
        <FounderMetricCard label="Failed payments" value={r.failedPayments} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <FounderPanel title="Active subscriptions by plan">
          <dl className="space-y-2">
            {Object.entries(r.subscriptionsByPlan).map(([plan, count]) => (
              <div key={plan} className="flex justify-between text-sm">
                <dt className="capitalize text-gray-400">{plan}</dt>
                <dd className="text-white">{count}</dd>
              </div>
            ))}
          </dl>
        </FounderPanel>

        <FounderPanel title="Monthly costs (founder-entered)">
          {!r.costsConfigured && (
            <p className="mb-3 text-sm text-gray-500">
              Platform costs are not tracked automatically. Enter your estimated monthly spend to see
              a net estimate.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Estimated monthly costs ($)
              <input
                type="number"
                min={0}
                step={1}
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                className="mt-1 w-40 rounded-lg border border-white/10 bg-[#050810] px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveCosts()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Save
            </button>
            {saved && <span className="text-xs text-emerald-400">Saved — refresh page for net</span>}
          </div>
          {r.netEstimate != null && (
            <p className="mt-4 text-sm text-gray-300">
              Net estimate: <span className="font-semibold text-white">${r.netEstimate.toLocaleString()}/mo</span>
            </p>
          )}
        </FounderPanel>
      </div>

      <FounderMetricOrEmpty metric={r.recentPayments} />
    </div>
  );
}
