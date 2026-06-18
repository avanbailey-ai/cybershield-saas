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
    revenue.crmPipelineMrr > 0 ||
    revenue.totalScannedProspects > 0 ||
    revenue.industries.some((i) => i.scannedCount > 0 || i.crmRevenue > 0);

  return (
    <SectionCard
      id="revenue"
      title="Revenue Opportunity Engine"
      subtitle="CRM pipeline and scan-backed prospect tiers — real fields only"
    >
      {!hasData ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/50 p-8 text-center">
          <p className="text-sm text-gray-400">No revenue signals yet.</p>
          <p className="mt-1 text-xs text-gray-600">
            Import prospects, complete scans, and add CRM potential revenue to see pipeline here.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs text-gray-500">CRM pipeline MRR</p>
              <p className="text-2xl font-bold text-emerald-400">
                ${revenue.crmPipelineMrr.toLocaleString()}
              </p>
              <p className="mt-1 text-[10px] text-gray-600">From CRM potential revenue fields</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-xs text-gray-500">CRM pipeline ARR</p>
              <p className="text-2xl font-bold text-blue-400">
                ${revenue.crmPipelineArr.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="text-xs text-gray-500">Scanned prospects</p>
              <p className="text-2xl font-bold text-violet-400">{revenue.totalScannedProspects}</p>
              <p className="mt-1 text-[10px] text-gray-600">
                {revenue.hotCount} HOT · {revenue.warmCount} WARM
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs text-gray-500">Industries tracked</p>
              <p className="text-2xl font-bold text-amber-400">{revenue.industries.length}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-white">By industry</h3>
              {revenue.industries.length === 0 ? (
                <p className="text-xs text-gray-500">No industry breakdown yet.</p>
              ) : (
                <div className="space-y-2">
                  {revenue.industries.slice(0, 6).map((ind) => (
                    <div
                      key={ind.industry}
                      className="flex items-center justify-between rounded-lg bg-gray-800/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="text-gray-300">{ind.industry}</span>
                        <span className="ml-2 text-xs text-gray-600">
                          {ind.scannedCount} scanned · {ind.hotCount}H · {ind.warmCount}W
                        </span>
                      </div>
                      <span className="font-medium text-emerald-400">
                        {ind.crmRevenue > 0
                          ? `$${ind.crmRevenue.toLocaleString()}/mo CRM`
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-white">Top opportunities (scans)</h3>
              {revenue.topOpportunities.length === 0 ? (
                <p className="text-xs text-gray-500">Complete prospect scans to rank opportunities.</p>
              ) : (
                <div className="space-y-2">
                  {revenue.topOpportunities.map((opp) => (
                    <div
                      key={opp.website}
                      className="flex items-center justify-between rounded-lg bg-gray-800/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="text-white">{opp.name}</span>
                        {opp.tier && (
                          <span
                            className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] ${opportunityTierColor(opp.tier as LeadScore)}`}
                          >
                            {opp.tier}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-violet-400">
                          {opp.scanScore != null ? `${opp.scanScore}/100` : '—'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {opp.estimatedMrr != null
                            ? `$${opp.estimatedMrr.toLocaleString()}/mo (CRM/estimate)`
                            : 'No MRR on file'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
