'use client';

import type { ReactNode } from 'react';

interface CollapsibleReportSectionProps {
  id: string;
  expanded: boolean;
  onToggle: () => void;
  header: ReactNode;
  children: ReactNode;
  className?: string;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function CollapsibleReportSection({
  id,
  expanded,
  onToggle,
  header,
  children,
  className = '',
}: CollapsibleReportSectionProps) {
  const panelId = `${id}-panel`;

  return (
    <section className={className}>
      <button
        type="button"
        id={id}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-lg text-left transition-colors hover:bg-gray-800/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
      >
        <div className="min-w-0 flex-1">{header}</div>
        <span className="mt-0.5 flex flex-col items-end gap-1">
          <ChevronIcon expanded={expanded} />
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
            {expanded ? 'Hide details' : 'View details'}
          </span>
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={id}
        hidden={!expanded}
        className={expanded ? 'mt-4 border-t border-gray-800/80 pt-4' : undefined}
      >
        {expanded ? children : null}
      </div>
    </section>
  );
}
