'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import type { FounderBriefing } from '@/lib/owner/briefing';

export default function DailyBriefing({ briefing }: { briefing: FounderBriefing }) {
  return (
    <SectionCard
      id="briefing"
      title="Founder Daily Briefing"
      subtitle={`Updated ${new Date(briefing.generatedAt).toLocaleString()}`}
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-xs text-gray-500">New Customers (24h)</p>
          <p className="mt-1 text-2xl font-bold text-white">{briefing.newCustomers}</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs text-gray-500">New Leads (24h)</p>
          <p className="mt-1 text-2xl font-bold text-white">{briefing.newLeads}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs text-gray-500">MRR</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            ${briefing.revenueMrr.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-gray-500">HOT Prospects</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{briefing.hotProspects}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-white">Today&apos;s Highlights</h3>
          <ul className="space-y-2">
            {briefing.highlights.map((h) => (
              <li key={h} className="rounded-lg bg-gray-800/50 px-3 py-2 text-sm text-gray-300">
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-white">Opportunities</h3>
          <ul className="space-y-2">
            {briefing.opportunities.map((o) => (
              <li
                key={o}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-200"
              >
                {o}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}
