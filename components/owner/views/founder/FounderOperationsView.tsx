'use client';

import { FounderPanel, FounderSectionHeader } from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';

const SEVERITY_STYLES = {
  critical: 'border-red-500/30 bg-red-950/20 text-red-200',
  warning: 'border-amber-500/30 bg-amber-950/20 text-amber-200',
  info: 'border-blue-500/20 bg-blue-950/10 text-blue-200',
};

export default function FounderOperationsView({ data }: { data: FounderCommandCenterData }) {
  const o = data.operations;

  return (
    <div>
      <FounderSectionHeader
        title="Operations & Alerts"
        subtitle="Founder-level risks: billing, scans, email, analytics, and customer onboarding gaps."
        updatedAt={o.generatedAt}
      />

      <div className="mb-6">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${
            o.overallStatus === 'healthy'
              ? 'bg-emerald-500/10 text-emerald-400'
              : o.overallStatus === 'warning'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-red-500/10 text-red-400'
          }`}
        >
          {o.overallStatus}
        </span>
      </div>

      {o.alerts.length === 0 ? (
        <FounderPanel>
          <p className="text-sm text-gray-400">No operational alerts right now.</p>
        </FounderPanel>
      ) : (
        <ul className="space-y-4">
          {o.alerts.map((a) => (
            <li
              key={a.id}
              className={`rounded-xl border p-4 ${SEVERITY_STYLES[a.severity]}`}
            >
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 text-sm opacity-90">{a.detail}</p>
              <p className="mt-2 text-xs opacity-75">Action: {a.action}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
