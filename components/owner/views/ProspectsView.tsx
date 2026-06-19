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
        <h1 className="text-3xl font-semibold tracking-tight text-white">Prospects</h1>
        <p className="mt-2 max-w-2xl text-gray-500">
          Discover businesses, approve outreach, and send through Resend — one queue, no dead ends.
        </p>
      </header>
      <LeadDiscovery initialProspects={prospects} embedded />
    </div>
  );
}
