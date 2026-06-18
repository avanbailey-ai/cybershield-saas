'use client';

import type { SecurityIntelligenceCard } from '@/lib/securityIntelligence/types';
import {
  categoryLabel,
  formatSeverity,
  severityBadgeClass,
  severityGlowClass,
} from './severityStyles';
import CollapsibleReportSection from './CollapsibleReportSection';

interface SecurityFindingCardProps {
  finding: SecurityIntelligenceCard & { id?: string };
  compact?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  controlId?: string;
}

function WarningIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

function FindingHeader({ finding }: { finding: SecurityIntelligenceCard }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pr-2">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-white">{finding.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {categoryLabel(finding.category)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">{finding.description}</p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityBadgeClass(finding.severity)}`}
      >
        {formatSeverity(finding.severity)}
      </span>
    </div>
  );
}

function FindingDetails({ finding }: { finding: SecurityIntelligenceCard }) {
  return (
    <>
      {finding.impact.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            What this means
          </h4>
          <ul className="space-y-2">
            {finding.impact.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                <WarningIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400/90">
          What this could mean for your site
        </h4>
        <p className="text-sm leading-relaxed text-amber-100/80">{finding.exploitScenario}</p>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          How to fix it
        </h4>
        <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/80 px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-emerald-300/90">
          {finding.fix}
        </pre>
      </div>

      <div className="rounded-lg border border-green-500/15 bg-green-500/5 px-4 py-3">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-400/90">
          Why fixing this matters
        </h4>
        <p className="text-sm leading-relaxed text-green-100/80">{finding.securityImpactIfFixed}</p>
      </div>
    </>
  );
}

export default function SecurityFindingCard({
  finding,
  compact = false,
  expanded = false,
  onToggle,
  controlId,
}: SecurityFindingCardProps) {
  const sectionId = controlId ?? `finding-${finding.title.replace(/\s+/g, '-').toLowerCase()}`;

  if (compact) {
    return (
      <article
        className={`rounded-xl border bg-gray-900/80 p-5 ${severityGlowClass(finding.severity)}`}
      >
        <FindingHeader finding={finding} />
        {finding.impact.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Impact
            </h4>
            <ul className="space-y-2">
              {finding.impact.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                  <WarningIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    );
  }

  if (onToggle) {
    return (
      <article
        className={`rounded-xl border bg-gray-900/80 p-5 ${severityGlowClass(finding.severity)}`}
      >
        <CollapsibleReportSection
          id={sectionId}
          expanded={expanded}
          onToggle={onToggle}
          header={<FindingHeader finding={finding} />}
        >
          <FindingDetails finding={finding} />
        </CollapsibleReportSection>
      </article>
    );
  }

  return (
    <article
      className={`rounded-xl border bg-gray-900/80 p-5 ${severityGlowClass(finding.severity)}`}
    >
      <FindingHeader finding={finding} />
      <div className="mt-4 border-t border-gray-800/80 pt-4">
        <FindingDetails finding={finding} />
      </div>
    </article>
  );
}
