'use client';

import LeadCrm from '../../LeadCrm';
import { FounderPanel, FounderSectionHeader } from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';
import type { OwnerCrmLead } from '@/lib/owner/types';

export default function FounderSalesView({
  data,
  crmLeads,
  onRefresh,
}: {
  data: FounderCommandCenterData;
  crmLeads: OwnerCrmLead[];
  onRefresh?: () => void;
}) {
  const s = data.sales;

  return (
    <div>
      <FounderSectionHeader
        title="Sales / CRM"
        subtitle="Real saved leads only — no fake discovery pipeline. Add contacts manually or import from genuine outreach."
        updatedAt={s.generatedAt}
      />

      {Object.keys(s.stageCounts).length > 0 && (
        <FounderPanel title="Pipeline by stage" className="mb-8">
          <div className="flex flex-wrap gap-4">
            {Object.entries(s.stageCounts).map(([stage, count]) => (
              <div key={stage} className="rounded-lg bg-[#0c1220] px-4 py-2 text-sm">
                <span className="text-gray-400">{stage}</span>
                <span className="ml-2 font-semibold text-white">{count}</span>
              </div>
            ))}
          </div>
        </FounderPanel>
      )}

      {!s.crmAvailable && (
        <FounderPanel className="mb-8 border-amber-500/20">
          <p className="text-sm text-amber-200/90">
            CRM table unavailable. Check Supabase owner_crm_leads or handle pipeline externally until
            rebuilt.
          </p>
        </FounderPanel>
      )}

      <FounderPanel title="CRM leads">
        <LeadCrm initialLeads={crmLeads} embedded />
      </FounderPanel>

      <p className="mt-6 text-xs text-gray-600">
        Prospect discovery has been removed from the main Founder OS nav. Statuses: New, Contacted,
        Replied, Interested, Demo/Report Sent, Won, Lost, No Verified Email.
      </p>
    </div>
  );
}
