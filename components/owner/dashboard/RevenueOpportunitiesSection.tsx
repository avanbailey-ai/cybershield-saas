'use client';

import { useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import type { RevenueOpportunityItem } from '@/lib/owner/revenueOpportunities';
import type { FounderSectionId } from '@/lib/owner/founderNav';

export default function RevenueOpportunitiesSection({
  opportunities,
}: {
  opportunities: RevenueOpportunityItem[];
}) {
  const { setSection, refreshFounderData } = useFounderNav();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function execute(item: RevenueOpportunityItem) {
    if (item.inboxId) {
      setBusyId(item.id);
      try {
        await fetch('/api/owner/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            ids: [item.inboxId],
            meta: item.userId ? { userId: item.userId } : item.prospectId ? { prospectId: item.prospectId } : undefined,
          }),
        });
        await refreshFounderData();
      } finally {
        setBusyId(null);
      }
      return;
    }
    setSection(item.actionTarget as FounderSectionId);
  }

  if (opportunities.length === 0) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Next revenue opportunities
        </h2>
        <p className="mt-4 text-sm text-gray-500">
          No outreach-ready prospects or retention actions right now. Run discovery to feed the pipeline.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-emerald-400/80">
        Next revenue opportunities
      </h2>
      <ul className="mt-4 space-y-3">
        {opportunities.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-white">{item.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{item.reason}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {item.estimatedMrr != null && item.estimatedMrr > 0 && (
                  <span className="text-emerald-300">Est. ${item.estimatedMrr}/mo</span>
                )}
                <span className="text-violet-300">{item.confidence} confidence</span>
                <span className="text-gray-500 capitalize">{item.type.replace('_', ' ')}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => execute(item)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busyId === item.id ? 'Working…' : item.actionLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
