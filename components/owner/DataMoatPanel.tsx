'use client';

import { SectionCard } from './MetricCard';
import type { DataMoatSnapshot } from '@/lib/owner/dataMoat';

const MOAT_LABELS = {
  building: { label: 'Building', color: 'text-gray-400' },
  emerging: { label: 'Emerging', color: 'text-amber-400' },
  established: { label: 'Established', color: 'text-emerald-400' },
};

export default function DataMoatPanel({ moat }: { moat: DataMoatSnapshot }) {
  const strength = MOAT_LABELS[moat.moatStrength];

  return (
    <SectionCard
      id="data-moat"
      title="Data Moat Building"
      subtitle="Industry benchmarks and security trend architecture"
    >
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-5 py-3">
          <p className="text-xs text-gray-500">Moat Strength</p>
          <p className={`text-lg font-bold ${strength.color}`}>{strength.label}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-5 py-3">
          <p className="text-xs text-gray-500">Data Points</p>
          <p className="text-lg font-bold text-white">{moat.dataPoints.toLocaleString()}</p>
        </div>
        {moat.trends[0] && (
          <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-5 py-3">
            <p className="text-xs text-gray-500">Platform Avg Score</p>
            <p className="text-lg font-bold text-white">{moat.trends[0].avgScore}/100</p>
          </div>
        )}
      </div>

      <h3 className="mb-3 text-sm font-medium text-white">Industry Benchmarks</h3>
      <div className="grid gap-4 lg:grid-cols-3">
        {moat.benchmarks.map((b) => (
          <div key={b.industry} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <h4 className="font-medium text-white">{b.industry}</h4>
            <p className="mt-1 text-2xl font-bold text-violet-400">{b.avgSecurityScore}/100</p>
            <p className="mt-1 text-xs text-gray-500">Sample: {b.sampleSize}</p>
            <ul className="mt-2 space-y-1">
              {b.commonVulnerabilities.slice(0, 3).map((v) => (
                <li key={v} className="text-xs text-gray-400">
                  • {v}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
