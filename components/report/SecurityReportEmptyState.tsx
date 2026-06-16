import type { SecurityIntelligenceReport } from '@/lib/securityIntelligence/types';

interface SecurityReportEmptyStateProps {
  report: Pick<
    SecurityIntelligenceReport,
    'securityScore' | 'attackSurfaceScore' | 'attackSurfaceLevel' | 'riskLevel'
  >;
}

export default function SecurityReportEmptyState({ report }: SecurityReportEmptyStateProps) {
  return (
    <section className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
        <svg
          className="h-6 w-6 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-green-300">No critical security issues</h3>
      <p className="mt-2 text-sm text-gray-400">
        No structured findings were detected. Your security posture remains strong — continue
        monitoring for drift.
      </p>
      <dl className="mt-4 flex flex-wrap justify-center gap-6 text-xs text-gray-500">
        <div>
          <dt className="uppercase tracking-wider">Security Score</dt>
          <dd className="mt-1 text-sm font-semibold text-white">{report.securityScore}/100</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider">Attack Surface</dt>
          <dd className="mt-1 text-sm font-semibold text-white">
            {report.attackSurfaceLevel} ({report.attackSurfaceScore}/100)
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider">Risk Level</dt>
          <dd className="mt-1 text-sm font-semibold capitalize text-white">{report.riskLevel}</dd>
        </div>
      </dl>
    </section>
  );
}
