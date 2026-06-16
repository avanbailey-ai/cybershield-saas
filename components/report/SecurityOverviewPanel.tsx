import type { SecurityIntelligenceReport } from '@/lib/securityIntelligence/types';
import { formatRiskLevel, riskBadgeClass, riskScoreColor } from './severityStyles';

interface SecurityOverviewPanelProps {
  report: Pick<
    SecurityIntelligenceReport,
    'summary' | 'securityScore' | 'riskLevel' | 'attackSurfaceScore' | 'attackSurfaceLevel' | 'changeSummary'
  >;
  locked?: boolean;
}

function postureClass(posture: SecurityIntelligenceReport['changeSummary']['posture']): string {
  switch (posture) {
    case 'improved':
      return 'text-green-400';
    case 'degraded':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export default function SecurityOverviewPanel({ report, locked = false }: SecurityOverviewPanelProps) {
  const { changeSummary } = report;

  return (
    <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Security Overview
      </h2>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {locked ? (
            <>
              <p className="text-sm text-gray-500">Score preview only</p>
              <p className="mt-2 text-xs text-gray-600">Not enabled on Free plan</p>
            </>
          ) : (
            <>
              <p className={`text-5xl font-bold tabular-nums ${riskScoreColor(report.riskLevel)}`}>
                {report.securityScore}
                <span className="text-lg font-normal text-gray-500">/100</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">Higher score = stronger posture</p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${riskBadgeClass(report.riskLevel)}`}
          >
            {formatRiskLevel(report.riskLevel)} Risk
          </span>
          {!locked && (
            <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-300">
              Attack Surface: {report.attackSurfaceLevel} ({report.attackSurfaceScore}/100)
            </span>
          )}
        </div>
      </div>

      {locked && (
        <div className="mt-4 rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Change detection
          </p>
          <div className="mt-2 space-y-1 blur-sm select-none" aria-hidden="true">
            <p className="text-xs text-gray-500">Website change detected since last scan</p>
            <p className="text-xs text-gray-500">Posture degraded — new endpoint exposed</p>
          </div>
          <p className="mt-3 text-sm font-medium text-white">Start continuous protection</p>
          <p className="mt-1 text-xs text-gray-500">
            Change detection and trend tracking are not enabled on the Free plan.
          </p>
        </div>
      )}

      {!locked && (
        <>
          <p className="mt-4 text-sm leading-relaxed text-gray-300">{report.summary}</p>

          {changeSummary.highlights.length > 0 && (
            <div className="mt-4 border-t border-gray-800 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Change Summary
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium ${postureClass(changeSummary.posture)}`}>
                  {changeSummary.posture === 'improved'
                    ? 'Posture improved'
                    : changeSummary.posture === 'degraded'
                      ? 'Posture degraded'
                      : 'No significant change'}
                </span>
                {changeSummary.scoreDelta !== null && changeSummary.scoreDelta !== 0 && (
                  <span className="text-xs text-gray-400">
                    ({changeSummary.scoreDelta > 0 ? '+' : ''}
                    {changeSummary.scoreDelta} pts)
                  </span>
                )}
              </div>
              <ul className="mt-2 space-y-1">
                {changeSummary.highlights.map((highlight) => (
                  <li key={highlight} className="text-xs text-gray-400">
                    • {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
