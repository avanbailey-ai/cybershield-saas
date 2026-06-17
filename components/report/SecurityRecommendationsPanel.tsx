'use client';

import { useMemo, useState } from 'react';
import type { SecurityFinding, SecurityRecommendation } from '@/lib/securityIntelligence/types';
import {
  formatSeverity,
  severityBadgeClass,
} from './severityStyles';
import CollapsibleReportSection from './CollapsibleReportSection';

interface SecurityRecommendationsPanelProps {
  recommendations: SecurityRecommendation[];
  findings?: SecurityFinding[];
}

function defaultExpandedState(recommendations: SecurityRecommendation[]): Record<string, boolean> {
  return Object.fromEntries(
    recommendations.map((rec, index) => [rec.findingId, index < 2]),
  );
}

export default function SecurityRecommendationsPanel({
  recommendations,
  findings = [],
}: SecurityRecommendationsPanelProps) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(() =>
    defaultExpandedState(recommendations),
  );

  const severityByFindingId = useMemo(
    () => Object.fromEntries(findings.map((finding) => [finding.id, finding.severity])),
    [findings],
  );

  if (recommendations.length === 0) return null;

  function setAll(next: boolean) {
    setExpandedById(
      Object.fromEntries(recommendations.map((rec) => [rec.findingId, next])),
    );
  }

  const expandedCount = recommendations.filter((rec) => expandedById[rec.findingId]).length;

  return (
    <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Recommendations
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
            {expandedCount} of {recommendations.length} expanded
          </span>
        </div>
      </div>

      <ol className="space-y-4">
        {recommendations.map((rec, index) => {
          const severity = severityByFindingId[rec.findingId];
          const summary = rec.steps[0] ?? 'Step-by-step remediation guidance';
          const expanded = expandedById[rec.findingId] ?? false;
          const controlId = `recommendation-${rec.findingId}`;

          return (
            <li
              key={rec.findingId}
              className="rounded-lg border border-gray-800 bg-gray-950/40 p-4"
            >
              <CollapsibleReportSection
                id={controlId}
                expanded={expanded}
                onToggle={() =>
                  setExpandedById((current) => ({
                    ...current,
                    [rec.findingId]: !current[rec.findingId],
                  }))
                }
                header={
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{rec.title}</h3>
                        {severity && (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityBadgeClass(severity)}`}
                          >
                            {formatSeverity(severity)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-400">{summary}</p>
                    </div>
                  </div>
                }
              >
                <ol className="space-y-2 pl-9">
                  {rec.steps.map((step, stepIndex) => (
                    <li key={step} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-0.5 shrink-0 text-xs font-semibold text-gray-500">
                        {stepIndex + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CollapsibleReportSection>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
