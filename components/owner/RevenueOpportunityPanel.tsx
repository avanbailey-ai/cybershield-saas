'use client';

import { SectionCard } from './MetricCard';
import { opportunityTierColor } from '@/lib/owner/opportunityScore';
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';
import type { LeadScore } from '@/lib/owner/types';

export default function RevenueOpportunityPanel({
  revenue,
}: {
  revenue: RevenueOpportunitySummary;
}) {
  const hasData =
    revenue.totalPipelineMrr > 0 || revenue.industries.some((i) => i.prospectCount > 0);

  return (
    <SectionCard
      id="revenue"
      title="Revenue Opportunity Engine"
      subtitle="Industry-level MRR/ARR pipeline from prospects and CRM"
    >
      {!hasData ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/50 p-8 text-center">
          <p className="text-sm text-gray-400">No pipeline data yet.</p>
          <p className="mt-1 text-xs text-gray-600">
            Run prospect discovery to populate industry MRR estimates.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs text-gray-500">Total Pipeline MRR</p>
              <p className="text-2xl font-bold text-emerald-400">
                ${revenue.totalPipelineMrr.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="text-xs text-gray-500">Weighted Pipeline MRR</p>
              <p className="text-2xl font-bold text-violet-400">
                ${revenue.weightedPipelineMrr.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-xs text-gray-500">Pipeline ARR</p>
              <p className="text-2xl font-bold text-blue-400">
                ${revenue.totalPipelineArr.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-white">By Industry</h3>
              <div className="space-y-2">
                {revenue.industries.slice(0, 6).map((ind) => (
                  <div
                    key={ind.industry}
                    className="flex items-center justify-between rounded-lg bg-gray-800/40 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="text-gray-300">{ind.industry}</span>
                      <span className="ml-2 text-xs text-gray-600">
                        {ind.hotCount}H · {ind.warmCount}W
                      </span>
                    </div>
                    <span className="font-medium text-emerald-400">
                      ${ind.weightedMrr.toLocaleString()}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-white">Top Opportunities</h3>
              <div className="space-y-2">
                {revenue.topOpportunities.map((opp) => (
                  <div
                    key={opp.name}
                    className="flex items-center justify-between rounded-lg bg-gray-800/40 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="text-white">{opp.name}</span>
                      <span
                        className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] ${opportunityTierColor(opp.tier as LeadScore)}`}
                      >
                        {opp.tier}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400">${opp.estimatedMrr}/mo</p>
                      <p className="text-[10px] text-gray-500">{opp.conversionLikelihood}% likely</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
