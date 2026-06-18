'use client';

import { useState } from 'react';
import MetricCard, { SectionCard } from './MetricCard';
import type { BusinessOverviewMetrics, TrendWindow } from '@/lib/owner/types';

interface Props {
  initialWindows: Record<TrendWindow, BusinessOverviewMetrics>;
}

const WINDOWS: { id: TrendWindow; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
];

export default function BusinessOverview({ initialWindows }: Props) {
  const [window, setWindow] = useState<TrendWindow>('30d');
  const m = initialWindows[window];

  return (
    <SectionCard
      id="overview"
      title="Real-Time Business Overview"
      subtitle="Executive metrics from platform data and billing"
      action={
        <div className="flex gap-1 rounded-lg border border-white/5 bg-gray-950 p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWindow(w.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                window === w.id
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="MRR" value={`$${m.mrr.toLocaleString()}`} accent="text-emerald-400" />
        <MetricCard label="ARR" value={`$${m.arr.toLocaleString()}`} accent="text-emerald-300" />
        <MetricCard
          label="Growth"
          value={`${m.mrrGrowthPct >= 0 ? '+' : ''}${m.mrrGrowthPct}%`}
          delta="Signup trend vs prior period"
        />
        <MetricCard label="Total Users" value={m.totalUsers} />
        <MetricCard label="New Signups" value={m.newSignups} />
        <MetricCard label="Websites" value={m.websites} />
        <MetricCard label="Scans" value={m.scans} />
        <MetricCard
          label="Conversion"
          value={`${m.conversionRate}%`}
          delta="Signup to paid"
          accent="text-violet-400"
        />
      </div>
    </SectionCard>
  );
}
