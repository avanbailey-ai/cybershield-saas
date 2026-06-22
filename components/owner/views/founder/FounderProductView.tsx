'use client';

import {
  FounderMetricCard,
  FounderMetricOrEmpty,
  FounderPanel,
  FounderSectionHeader,
} from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';

export default function FounderProductView({ data }: { data: FounderCommandCenterData }) {
  const p = data.product;

  return (
    <div>
      <FounderSectionHeader
        title="Product Usage"
        subtitle="Whether customers are scanning, monitoring sites, and engaging with reports."
        updatedAt={p.generatedAt}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FounderMetricCard label="Monitored websites" value={p.monitoredWebsites} />
        <FounderMetricCard label="Scans (30d)" value={p.scans30d} />
        <FounderMetricCard label="Failed scans (30d)" value={p.failedScans30d} />
        <FounderMetricCard
          label="Avg security score"
          value={p.avgSecurityScore ?? '—'}
        />
        <FounderMetricOrEmpty metric={p.websitesWithScoreChanges30d} />
        <FounderMetricOrEmpty metric={p.websitesWithNewRisks30d} />
        <FounderMetricOrEmpty metric={p.reportViews30d} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FounderPanel title="Most active accounts (30d)">
          {p.activeAccounts.length === 0 ? (
            <p className="text-sm text-gray-500">No account activity yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-gray-500">
                  <th className="pb-2 font-medium">Account</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Sites</th>
                  <th className="pb-2 font-medium">Scans</th>
                </tr>
              </thead>
              <tbody>
                {p.activeAccounts.map((a) => (
                  <tr key={a.email} className="border-b border-white/[0.04]">
                    <td className="py-2 text-gray-300">{a.email}</td>
                    <td className="py-2 capitalize text-gray-400">{a.plan}</td>
                    <td className="py-2 text-white">{a.websites}</td>
                    <td className="py-2 text-white">{a.scans30d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </FounderPanel>

        <FounderPanel title="Findings by severity (30d scans)">
          {p.findingsBySeverity.length === 0 ? (
            <p className="text-sm text-gray-500">No finding data in recent scans.</p>
          ) : (
            <ul className="space-y-2">
              {p.findingsBySeverity.map((f) => (
                <li key={f.severity} className="flex justify-between text-sm">
                  <span className="capitalize text-gray-400">{f.severity}</span>
                  <span className="text-white">{f.count}</span>
                </li>
              ))}
            </ul>
          )}
        </FounderPanel>
      </div>

      {p.topFindingCategories.length > 0 && (
        <FounderPanel title="Common finding categories" className="mt-6">
          <ul className="space-y-2">
            {p.topFindingCategories.map((c) => (
              <li key={c.category} className="flex justify-between text-sm">
                <span className="truncate pr-4 text-gray-400">{c.category}</span>
                <span className="shrink-0 text-white">{c.count}</span>
              </li>
            ))}
          </ul>
        </FounderPanel>
      )}
    </div>
  );
}
