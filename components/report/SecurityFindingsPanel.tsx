'use client';

import { useMemo, useState } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import SecurityFindingCard from './SecurityFindingCard';

interface SecurityFindingsPanelProps {
  findings: SecurityFinding[];
}

function defaultExpandedState(findings: SecurityFinding[]): Record<string, boolean> {
  return Object.fromEntries(
    findings.map((finding) => [
      finding.id,
      finding.severity === 'critical' || finding.severity === 'high',
    ]),
  );
}

export default function SecurityFindingsPanel({ findings }: SecurityFindingsPanelProps) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(() =>
    defaultExpandedState(findings),
  );

  const expandedCount = useMemo(
    () => findings.filter((finding) => expandedById[finding.id]).length,
    [findings, expandedById],
  );

  function setAll(next: boolean) {
    setExpandedById(Object.fromEntries(findings.map((finding) => [finding.id, next])));
  }

  return (
    <section className="mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Security Intelligence Findings ({findings.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            Collapse all
          </button>
          <span className="self-center text-xs text-gray-500">
            {expandedCount} of {findings.length} expanded
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {findings.map((finding) => (
          <SecurityFindingCard
            key={finding.id}
            finding={finding}
            controlId={`finding-${finding.id}`}
            expanded={expandedById[finding.id] ?? false}
            onToggle={() =>
              setExpandedById((current) => ({
                ...current,
                [finding.id]: !current[finding.id],
              }))
            }
          />
        ))}
      </div>
    </section>
  );
}
