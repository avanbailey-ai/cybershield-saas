'use client';

import LeadDiscovery from '../LeadDiscovery';
import type { OwnerProspect } from '@/lib/owner/types';
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';

interface Props {
  prospects: OwnerProspect[];
  revenue: RevenueOpportunitySummary;
}

export default function ProspectsView({ prospects, revenue }: Props) {
  const hot = prospects.filter((p) => p.lead_score === 'HOT').length;
  const scanned = prospects.filter((p) => p.scan_status === 'completed').length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Prospects</h1>
        <p className="mt-2 text-gray-500">Import → scan → score → outreach</p>
        {prospects.length > 0 && (
          <p className="mt-4 text-sm text-gray-400">
            {prospects.length} imported · {scanned} scanned · {hot} HOT
            {revenue.crmPipelineMrr > 0 &&
              ` · $${revenue.crmPipelineMrr.toLocaleString()}/mo CRM pipeline`}
          </p>
        )}
      </header>
      <LeadDiscovery initialProspects={prospects} embedded />
    </div>
  );
}
