'use client';

import MarketingInsights from '../MarketingInsights';
import DataMoatPanel from '../DataMoatPanel';
import CompetitorIntel from '../CompetitorIntel';
import CeoAdvisoryPanel from '../CeoAdvisoryPanel';
import type { MarketingInsight } from '@/lib/owner/generators/insights';
import type { DataMoatSnapshot } from '@/lib/owner/dataMoat';
import type { OwnerCompetitor } from '@/lib/owner/types';
import type { CeoAdvisoryData } from '@/lib/owner/ceoAdvisory';
import type { BusinessOverviewMetrics, TrendWindow } from '@/lib/owner/types';

interface Props {
  insights: MarketingInsight[];
  moat: DataMoatSnapshot;
  competitors: OwnerCompetitor[];
  ceoAdvisory: CeoAdvisoryData;
  windows: Record<TrendWindow, BusinessOverviewMetrics>;
}

export default function InsightsView({
  insights,
  moat,
  competitors,
  ceoAdvisory,
  windows,
}: Props) {
  const m = windows['30d'];

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Insights</h1>
        <p className="mt-2 text-gray-500">Aggregated trends — MRR, conversion, benchmarks, competitors</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-gray-500">MRR (30d)</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-400">
            ${m.mrr.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {m.mrrGrowthPct >= 0 ? '+' : ''}
            {m.mrrGrowthPct}% vs prior
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-gray-500">Conversion</p>
          <p className="mt-2 text-3xl font-semibold text-white">{m.conversionRate}%</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-gray-500">Benchmark samples</p>
          <p className="mt-2 text-3xl font-semibold text-violet-400">{moat.dataPoints}</p>
        </div>
      </section>

      <MarketingInsights insights={insights} embedded />
      <CeoAdvisoryPanel data={ceoAdvisory} embedded insightsOnly />
      <DataMoatPanel moat={moat} embedded />
      <CompetitorIntel initialCompetitors={competitors} embedded />
    </div>
  );
}
