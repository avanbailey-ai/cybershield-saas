import Link from 'next/link';

/** Static Health Center preview — mirrors dashboard card patterns, not a screenshot. */
const PREVIEW_METRICS = [
  {
    label: 'Security Score',
    value: '78/100',
    sub: 'Good · trending stable',
    tone: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
  },
  {
    label: 'SSL Certificate',
    value: 'Valid',
    sub: 'Expires in 87 days',
    tone: 'text-green-400 border-green-500/30 bg-green-500/10',
  },
  {
    label: 'Domain',
    value: 'Healthy',
    sub: 'Registration active',
    tone: 'text-green-400 border-green-500/30 bg-green-500/10',
  },
  {
    label: 'Uptime',
    value: 'Online',
    sub: 'Response 142ms',
    tone: 'text-green-400 border-green-500/30 bg-green-500/10',
  },
] as const;

const RECENT_CHANGES = [
  { title: 'Security header removed', detail: 'X-Frame-Options no longer present', severity: 'medium' },
  { title: 'SSL certificate renewed', detail: 'New expiry date detected', severity: 'good' },
  { title: 'New third-party script', detail: 'analytics.js added to homepage', severity: 'low' },
] as const;

const ACTIVE_FINDINGS = [
  { title: 'Missing Content-Security-Policy', severity: 'medium' },
  { title: 'Referrer-Policy not set', severity: 'low' },
] as const;

function severityClass(severity: string): string {
  if (severity === 'good') return 'bg-green-500/15 text-green-300 border-green-500/30';
  if (severity === 'medium') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
  return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

export default function HealthCenterPreview() {
  return (
    <section id="health-center" className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-500">
              Health Center
            </p>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
              One place to see everything about your website
            </h2>
            <p className="mb-6 text-base leading-relaxed text-gray-400">
              Security score, SSL status, domain registration, uptime, recent changes, and active
              findings — all in a single executive view per website. Know when something changes
              before it affects customers.
            </p>
            <ul className="mb-8 space-y-3 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                SSL expires → browser warnings, trust loss, and abandoned checkouts
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                Website down → leads stop flowing and revenue stalls
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                Malicious script added → customer data exposure risk
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                Security headers disappear → increased attack surface
              </li>
            </ul>
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Start monitoring
              <ArrowIcon />
            </Link>
          </div>

          <div className="rounded-xl border border-gray-700/60 bg-gray-950 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <span className="h-3 w-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs font-medium text-gray-500">
                Health Center · example.com
              </span>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Overall Website Health
                </p>
                <p className="mt-1 text-sm font-semibold text-yellow-300">Minor issues detected</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PREVIEW_METRICS.map((m) => (
                    <div key={m.label} className="rounded-lg border border-gray-800/80 bg-gray-900/40 px-2.5 py-2">
                      <p className="text-[10px] text-gray-500">{m.label}</p>
                      <p className="mt-0.5 text-xs font-semibold text-white">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PREVIEW_METRICS.slice(1).map((m) => (
                  <div key={m.label} className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {m.label}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${m.tone}`}
                    >
                      {m.value}
                    </span>
                    <p className="mt-1 text-[10px] text-gray-500">{m.sub}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Recent Changes
                </p>
                <ul className="mt-2 space-y-2">
                  {RECENT_CHANGES.map((c) => (
                    <li key={c.title} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white">{c.title}</p>
                        <p className="text-[10px] text-gray-500">{c.detail}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${severityClass(c.severity)}`}
                      >
                        {c.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Active Findings
                </p>
                <ul className="mt-2 space-y-1.5">
                  {ACTIVE_FINDINGS.map((f) => (
                    <li key={f.title} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-300">{f.title}</span>
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${severityClass(f.severity)}`}
                      >
                        {f.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="border-t border-gray-800 px-5 py-3 text-center text-[10px] text-gray-600">
              Illustrative preview — your dashboard shows live data from your websites
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}
