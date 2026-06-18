'use client';

import { useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import BusinessHealthSection from '../dashboard/BusinessHealthSection';
import ActivityAwaySection from '../dashboard/ActivityAwaySection';
import FounderInboxSection from '../dashboard/FounderInboxSection';
import RevenueOpportunitiesSection from '../dashboard/RevenueOpportunitiesSection';
import CustomerRiskExpansionSection from '../dashboard/CustomerRiskExpansionSection';
import AutomationHealthSection from '../dashboard/AutomationHealthSection';

export default function FounderHomeView() {
  const { founderData: data, refreshFounderData } = useFounderNav();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const v6 = data.v6;
  const inboxPreview = data.inbox.slice(0, 5);

  async function exportAudit() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch('/api/owner/founder-os-audit');
      const json = await res.json();
      if (!res.ok || !json.audit) {
        setExportError(json.error ?? 'Export failed');
        return;
      }
      const blob = new Blob([JSON.stringify(json.audit, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `founder-os-audit-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Network error during export');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Operator dashboard</h1>
          <p className="mt-2 text-gray-500">
            {v6.executionStats.pendingApprovals > 0
              ? `${v6.executionStats.pendingApprovals} item(s) need approval · ${v6.executionStats.emailsSent24h} emails sent (24h)`
              : 'CyberShield autopilot standing by'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={exportAudit}
            disabled={exporting}
            className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export AI Audit'}
          </button>
          <button
            type="button"
            onClick={refreshFounderData}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Refresh data
          </button>
          {exportError && <p className="text-xs text-red-400">{exportError}</p>}
        </div>
      </header>

      <BusinessHealthSection metrics={v6.businessHealth} />
      <ActivityAwaySection feed={v6.activityFeed} />
      {data.inbox.length > 0 && (
        <FounderInboxSection items={inboxPreview} totalCount={data.inbox.length} />
      )}
      <RevenueOpportunitiesSection opportunities={v6.revenueOpportunities} />
      <CustomerRiskExpansionSection
        health={v6.customerHealth}
        expansion={v6.expansion}
        revenue={v6.revenueAtRisk}
      />
      <AutomationHealthSection health={v6.automationHealth} />
    </div>
  );
}
