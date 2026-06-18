'use client';

import LeadCrm from '../LeadCrm';
import type { OwnerCrmLead } from '@/lib/owner/types';

export default function CrmView({ crmLeads }: { crmLeads: OwnerCrmLead[] }) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">CRM</h1>
        <p className="mt-2 text-gray-500">Pipeline management — lead, status, revenue, next action</p>
      </header>
      <LeadCrm initialLeads={crmLeads} embedded />
    </div>
  );
}
