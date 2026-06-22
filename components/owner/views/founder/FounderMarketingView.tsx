'use client';

import {
  FounderMetricCard,
  FounderMetricOrEmpty,
  FounderPanel,
  FounderSectionHeader,
} from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';

export default function FounderMarketingView({ data }: { data: FounderCommandCenterData }) {
  const m = data.marketing;

  return (
    <div>
      <FounderSectionHeader
        title="Marketing"
        subtitle="Outreach execution and growth tasks tied to CyberShield positioning — not generic startup ideas."
        updatedAt={m.generatedAt}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FounderMetricCard label="Outreach drafts pending" value={m.outreachDraftsPending} />
        <FounderMetricCard label="Outreach sent (30d)" value={m.outreachSent30d} />
        <FounderMetricCard label="Campaigns" value={m.campaignsCount} />
        <FounderMetricCard label="Emails sent (30d)" value={m.emailsSent30d} />
        <FounderMetricOrEmpty metric={m.repliesTracked} />
        <FounderMetricOrEmpty metric={m.freeScanPageViews30d} />
        <FounderMetricOrEmpty metric={m.ctaClicks30d} />
      </div>

      <FounderPanel title="Marketing actions" className="mb-8">
        <ul className="space-y-3">
          {m.actions.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-white/[0.06] bg-[#0c1220] px-4 py-3"
            >
              <p className="font-medium text-white">{a.title}</p>
              <p className="mt-1 text-sm text-gray-500">{a.description}</p>
            </li>
          ))}
        </ul>
      </FounderPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        {m.checklists.map((cl) => (
          <FounderPanel key={cl.id} title={cl.title}>
            <ul className="space-y-2">
              {cl.items.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                      item.done
                        ? 'border-emerald-500 bg-emerald-500/20'
                        : 'border-white/20 bg-transparent'
                    }`}
                    aria-hidden
                  />
                  <span className={item.done ? 'text-gray-500 line-through' : 'text-gray-300'}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </FounderPanel>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-600">
        Optional outreach inbox and draft approval remain available via API — add manual CRM leads in
        Sales / CRM rather than auto-generated prospect lists.
      </p>
    </div>
  );
}
