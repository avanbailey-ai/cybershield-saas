'use client';

import LeadDiscovery from '../LeadDiscovery';
import type { OwnerProspect } from '@/lib/owner/types';
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';

interface Props {
  prospects: OwnerProspect[];
  revenue: RevenueOpportunitySummary;
}

export default function ProspectsView({ prospects }: Props) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-wider text-violet-400">Founder OS</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Prospects</h1>
        <p className="mt-2 text-gray-500">
          Revenue intelligence — find businesses most likely to become customers
        </p>
      </header>
      <LeadDiscovery initialProspects={prospects} embedded />
    </div>
  );
}
