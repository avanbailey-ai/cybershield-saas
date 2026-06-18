'use client';

import { SectionCard } from './MetricCard';
import type { CustomerIntelligenceSummary } from '@/lib/owner/customerIntelligence';

export default function CustomerIntelligencePanel({
  intelligence,
}: {
  intelligence: CustomerIntelligenceSummary;
}) {
  return (
    <SectionCard
      id="customer-intel"
      title="Customer Intelligence"
      subtitle="Conversion and churn drivers from user and scan data"
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <p className="text-xs text-gray-500">Avg Risk Score</p>
          <p className="text-2xl font-bold text-white">{intelligence.avgRiskScore}/100</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-gray-500">Churn Signals</p>
          <p className="text-2xl font-bold text-amber-400">{intelligence.churnSignals}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs text-gray-500">Active Subscribers</p>
          <p className="text-2xl font-bold text-emerald-400">{intelligence.conversionSignals}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-red-400">Churn Drivers</h3>
          {intelligence.churnDrivers.length === 0 ? (
            <p className="text-sm text-gray-500">No churn signals detected.</p>
          ) : (
            <ul className="space-y-2">
              {intelligence.churnDrivers.map((d) => (
                <li key={d} className="rounded-lg bg-red-500/5 px-3 py-2 text-sm text-red-200">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-emerald-400">Conversion Drivers</h3>
          {intelligence.conversionDrivers.length === 0 ? (
            <p className="text-sm text-gray-500">Insufficient conversion data.</p>
          ) : (
            <ul className="space-y-2">
              {intelligence.conversionDrivers.map((d) => (
                <li key={d} className="rounded-lg bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-medium text-white">Top Industries</h3>
          {intelligence.topIndustries.length === 0 ? (
            <p className="text-sm text-gray-500">No industry data yet.</p>
          ) : (
            <ul className="space-y-2">
              {intelligence.topIndustries.map((ind) => (
                <li
                  key={ind.name}
                  className="flex items-center justify-between rounded-lg bg-gray-800/40 px-3 py-2 text-sm"
                >
                  <span className="text-gray-300">{ind.name}</span>
                  <span className="font-medium text-white">{ind.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium text-white">Common Findings</h3>
          {intelligence.commonFindings.length === 0 ? (
            <p className="text-sm text-gray-500">No scan findings aggregated yet.</p>
          ) : (
            <ul className="space-y-2">
              {intelligence.commonFindings.map((f) => (
                <li
                  key={f.finding}
                  className="flex items-start justify-between gap-2 rounded-lg bg-gray-800/40 px-3 py-2 text-sm"
                >
                  <span className="text-gray-300">{f.finding}</span>
                  <span className="shrink-0 font-medium text-violet-400">{f.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
