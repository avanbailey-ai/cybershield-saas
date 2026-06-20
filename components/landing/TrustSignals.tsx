/**
 * Platform trust metrics — architecture only. Values stay hidden until wired to real analytics.
 * Do not display fabricated counts.
 */

const TRUST_METRICS = [
  {
    key: 'websites',
    label: 'Websites monitored',
    description: 'Active properties under continuous monitoring',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    key: 'checks',
    label: 'Security checks completed',
    description: 'SSL, headers, uptime, and change detection runs',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    key: 'findings',
    label: 'Findings detected',
    description: 'Security gaps and configuration issues surfaced',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    key: 'resolved',
    label: 'Issues resolved',
    description: 'Findings fixed and verified through re-scan',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
] as const;

export default function TrustSignals() {
  return (
    <section className="relative px-4 py-10 sm:px-4 sm:py-20 md:px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center sm:mb-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500 sm:mb-3 sm:text-sm">
            Platform Trust
          </p>
          <h2 className="mb-3 text-xl font-bold tracking-tight text-white sm:mb-4 sm:text-3xl">
            Built for continuous protection
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-gray-400 sm:text-base">
            CyberShield tracks real monitoring activity across your portfolio — not vanity metrics.
            Platform-wide totals will appear here once aggregated reporting is enabled.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {TRUST_METRICS.map((metric) => (
            <div
              key={metric.key}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 sm:rounded-xl sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400 ring-1 ring-blue-600/20 sm:h-10 sm:w-10">
                  {metric.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{metric.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{metric.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2 sm:mt-4">
                <span className="text-xl font-bold text-gray-600 sm:text-2xl" aria-hidden="true">
                  —
                </span>
                <span className="rounded-full border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Live data pending
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600 sm:mt-8">
          Your dashboard shows real counts for your own websites — SSL checks, changes detected, and
          resolved findings.
        </p>
      </div>
    </section>
  );
}
