import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative flex items-center overflow-hidden px-4 pb-8 pt-[4.25rem] sm:min-h-[85vh] sm:px-4 sm:pt-16 sm:pb-0 md:px-5">
      <div className="absolute inset-0 grid-bg opacity-40 max-md:opacity-25" />
      <div className="absolute left-1/4 top-1/2 hidden h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-blue-600/8 blur-3xl md:block" />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="grid items-center gap-6 sm:gap-12 lg:grid-cols-2">
          <div className="space-y-4 sm:space-y-0">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-800/50 bg-blue-950/30 px-2.5 py-1 text-xs font-medium text-blue-400 sm:mb-6 sm:px-3 sm:py-1.5 sm:text-sm">
              <span className="relative hidden h-2 w-2 sm:flex">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="md:hidden">Free scan to start</span>
              <span className="hidden md:inline">Continuous monitoring — free scan to start</span>
            </div>

            <h1 className="max-w-[18rem] text-[1.625rem] font-bold leading-snug tracking-tight text-white sm:mb-6 sm:max-w-none sm:text-5xl sm:leading-tight lg:text-6xl">
              Website Security Monitoring{" "}
              <span className="text-blue-400">— SSL, Health & Change Detection</span>
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-gray-400 sm:mb-8 sm:text-lg">
              CyberShield Cloud monitors business websites for security settings, SSL certificate
              issues, domain problems, uptime changes, and unexpected website changes — with alerts
              before customers see browser warnings.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
              <a
                href="#scan"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0a0f1e] sm:min-h-[48px] sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"
              >
                Start with a free scan
                <ArrowRightIcon className="h-4 w-4" />
              </a>
              <a
                href="#health-center"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-gray-700 px-5 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white sm:min-h-[48px] sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"
              >
                See Health Center
              </a>
            </div>

            <div className="flex flex-col gap-2.5 text-xs text-gray-500 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2 sm:text-sm">
              <span className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0 text-green-500/80" />
                SSL expiry alerts before browser warnings
              </span>
              <span className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0 text-green-500/80" />
                Uptime checks — catch downtime early
              </span>
              <span className="hidden items-center gap-2 sm:flex">
                <CheckIcon className="h-4 w-4 shrink-0 text-green-500/80" />
                Change timeline — your website&apos;s memory
              </span>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-xl border border-gray-700/60 bg-gray-950 shadow-2xl shadow-black/40">
              <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-500/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <span className="h-3 w-3 rounded-full bg-green-500/70" />
                <span className="ml-3 font-mono text-xs text-gray-500">
                  cybershield — continuous monitor
                </span>
              </div>
              <div className="p-5 font-mono text-sm leading-relaxed">
                <p className="text-gray-500">$ cybershield monitor --target example.com</p>
                <p className="mt-2 text-blue-400">
                  [*] Monitoring active for example.com...
                </p>
                <p className="text-gray-400">[*] SSL certificate valid — expires in 87 days</p>
                <p className="text-green-400">[✓] Uptime check passed (142ms)</p>
                <p className="mt-1 text-gray-400">[*] Comparing against last baseline...</p>
                <p className="text-yellow-400">[!] Change detected: X-Frame-Options removed</p>
                <p className="text-yellow-400">[!] Change detected: new script analytics.js</p>
                <p className="mt-1 text-gray-400">[*] Security score recalculated...</p>
                <p className="text-green-400">[✓] Domain registration healthy</p>
                <p className="mt-3 text-gray-500">─────────────────────────────────</p>
                <p className="mt-1 font-semibold text-white">
                  Security Score:{" "}
                  <span className="text-yellow-400">72/100</span>
                  <span className="ml-2 text-xs font-normal text-red-400">↓ 6 since last week</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  2 changes detected · alert sent · next check in 1h
                </p>
                <p className="mt-3 animate-pulse text-gray-600">█</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0f1e] to-transparent" />
    </section>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
