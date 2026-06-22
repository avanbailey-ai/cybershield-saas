'use client';

import {
  FounderMetricCard,
  FounderMetricOrEmpty,
  FounderPanel,
  FounderSectionHeader,
} from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';

export default function FounderFunnelView({ data }: { data: FounderCommandCenterData }) {
  const f = data.funnel;

  return (
    <div>
      <FounderSectionHeader
        title="Traffic & Funnel"
        subtitle={`Conversion funnel from analytics events (last ${f.windowDays} days). Drop-off % is vs prior stage.`}
        updatedAt={f.generatedAt}
      />

      {!f.analyticsAvailable && (
        <FounderPanel className="mb-8 border-amber-500/20 bg-amber-950/10">
          <p className="text-sm text-amber-200/90">{f.analyticsEmptyAction}</p>
        </FounderPanel>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <FounderMetricOrEmpty metric={f.pageViews30d} />
        <FounderMetricOrEmpty metric={f.pricingPageViews30d} />
        <FounderMetricCard label="Account signups (30d)" value={f.signups30d} />
      </div>

      <FounderPanel title="Funnel stages">
        {f.stages.length === 0 ? (
          <p className="text-sm text-gray-500">
            No funnel data yet. Events are read from analytics_events and system_events once traffic
            flows through landing → scan → report → pricing → checkout.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Stage</th>
                  <th className="pb-2 pr-4 font-medium">Sessions</th>
                  <th className="pb-2 font-medium">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {f.stages.map((s) => (
                  <tr key={s.stage} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-4 text-gray-200">{s.label}</td>
                    <td className="py-2.5 pr-4 font-medium text-white">{s.count}</td>
                    <td className="py-2.5 text-gray-400">
                      {s.dropoffPct > 0 ? `${s.dropoffPct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FounderPanel>
    </div>
  );
}
