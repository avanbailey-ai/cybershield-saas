'use client';

import type { RevenueIntelligenceSummary } from '@/lib/owner/revenueIntelligence';
import { formatRevenue } from '@/lib/owner/revenueIntelligence';

export default function RevenueOpportunityBar({ summary }: { summary: RevenueIntelligenceSummary }) {
  return (
    <section className="mb-8 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-violet-500/5 p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">
        Revenue intelligence
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Potential opportunities" value={String(summary.potentialOpportunities)} />
        <Metric label="Outreach ready" value={String(summary.outreachReady)} />
        <Metric label="Est. monthly revenue" value={formatRevenue(summary.estimatedMonthlyRevenue)} />
        <Metric label="Est. annual revenue" value={formatRevenue(summary.estimatedAnnualRevenue)} />
        <Metric
          label="Highest confidence lead"
          value={summary.highestConfidenceLead?.business_name ?? '—'}
          small
        />
        <Metric label="Best industry" value={summary.bestIndustry ?? '—'} small />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 font-semibold text-white ${small ? 'text-sm truncate' : 'text-xl'}`}>
        {value}
      </p>
    </div>
  );
}
