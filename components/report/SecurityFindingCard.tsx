import type { SecurityIntelligenceCard } from '@/lib/securityIntelligence/types';
import {
  categoryLabel,
  formatSeverity,
  severityBadgeClass,
  severityGlowClass,
} from './severityStyles';

interface SecurityFindingCardProps {
  finding: SecurityIntelligenceCard;
  compact?: boolean;
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

export default function SecurityFindingCard({ finding, compact = false }: SecurityFindingCardProps) {
  return (
    <article
      className={`rounded-xl border bg-gray-900/80 p-5 ${severityGlowClass(finding.severity)}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">{finding.title}</h3>
          <p className="mt-1 text-xs uppercase tracking-wider text-gray-500">
            {categoryLabel(finding.category)}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityBadgeClass(finding.severity)}`}
        >
          {formatSeverity(finding.severity)}
        </span>
      </header>

      <p className="text-sm leading-relaxed text-gray-300">{finding.description}</p>

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

      {!compact && (
        <>
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400/90">
              Exploit Scenario
            </h4>
            <p className="text-sm leading-relaxed text-amber-100/80">{finding.exploitScenario}</p>
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Remediation
            </h4>
            <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/80 px-4 py-3 font-mono text-xs leading-relaxed text-emerald-300/90 whitespace-pre-wrap">
              {finding.fix}
            </pre>
          </div>

          <div className="mt-4 rounded-lg border border-green-500/15 bg-green-500/5 px-4 py-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-400/90">
              Security Impact If Fixed
            </h4>
            <p className="text-sm leading-relaxed text-green-100/80">
              {finding.securityImpactIfFixed}
            </p>
          </div>
        </>
      )}
    </article>
  );
}
