'use client';

import { SectionCard } from './MetricCard';
import { opportunityTierColor } from '@/lib/owner/opportunityScore';
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';
import type { OwnerCrmLead } from '@/lib/owner/types';
import type { LeadScore } from '@/lib/owner/types';

interface OpportunityCenterProps {
  revenue: RevenueOpportunitySummary;
  crmLeads: OwnerCrmLead[];
}

export default function OpportunityCenter({ revenue, crmLeads }: OpportunityCenterProps) {
  const demoLeads = crmLeads.filter((l) => l.stage === 'demo' || l.stage === 'trial');
  const hasData =
    revenue.topOpportunities.length > 0 ||
    revenue.highestRisk.length > 0 ||
    revenue.crmPipelineMrr > 0 ||
    demoLeads.length > 0;

  return (
    <SectionCard
      id="opportunity-center"
      title="Opportunity Center"
      subtitle="Highest-value prospects, riskiest sites, and CRM pipeline — from real data only"
    >
      {!hasData ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/50 p-8 text-center">
          <p className="text-sm text-gray-300">No opportunities yet.</p>
          <p className="mt-2 text-xs text-gray-500">
            Import prospects, run scans, and add CRM revenue to populate this view.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-medium text-white">Highest-Value Prospects</h3>
            {revenue.topOpportunities.length === 0 ? (
              <p className="text-xs text-gray-500">Run scans to rank prospects by findings.</p>
            ) : (
              <div className="space-y-2">
                {revenue.topOpportunities.slice(0, 5).map((opp) => (
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
                      <p className="text-[10px] text-gray-600">{opp.website}</p>
                    </div>
                    <span className="text-violet-400">{opp.scanScore ?? '—'}/100</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-white">Highest-Risk Websites</h3>
            {revenue.highestRisk.length === 0 ? (
              <p className="text-xs text-gray-500">No completed scans yet.</p>
            ) : (
              <div className="space-y-2">
                {revenue.highestRisk.map((r) => (
                  <div
                    key={r.website}
                    className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="text-white">{r.name}</span>
                      <p className="text-[10px] text-gray-600">{r.website}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-400">{r.scanScore}/100</p>
                      {r.riskLevel && (
                        <p className="text-[10px] text-gray-500">{r.riskLevel}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-white">CRM Pipeline</h3>
            {revenue.crmPipelineMrr > 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-2xl font-bold text-emerald-400">
                  ${revenue.crmPipelineMrr.toLocaleString()}/mo
                </p>
                <p className="text-xs text-gray-500">
                  ARR: ${revenue.crmPipelineArr.toLocaleString()} · from CRM potential revenue fields
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Add potential revenue in CRM to estimate pipeline.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-white">Most Likely Wins</h3>
            {demoLeads.length === 0 && revenue.hotCount === 0 ? (
              <p className="text-xs text-gray-500">No demo/trial leads or HOT prospects yet.</p>
            ) : (
              <div className="space-y-2">
                {demoLeads.slice(0, 3).map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg bg-gray-800/40 px-3 py-2 text-sm"
                  >
                    <span className="text-white">{l.business_name}</span>
                    <span className="ml-2 text-[10px] uppercase text-amber-400">{l.stage}</span>
                    {l.potential_revenue ? (
                      <p className="text-xs text-emerald-400">
                        ${Number(l.potential_revenue).toLocaleString()}/mo
                      </p>
                    ) : null}
                  </div>
                ))}
                {revenue.hotCount > 0 && (
                  <p className="text-xs text-red-400">
                    + {revenue.hotCount} HOT prospect(s) from scans
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
