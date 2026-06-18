import Link from "next/link";

export default function CTA() {
  return (
    <section className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-3xl text-center">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-6 py-12 sm:px-8 sm:py-16">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Stop guessing — start monitoring
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-base text-gray-400 sm:mb-10">
            A free scan shows today&apos;s posture. Continuous monitoring shows what changes —
            SSL expiry, downtime, security gaps — before they cost you trust and revenue.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/#scan"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
            >
              Start with a free scan
            </a>
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-gray-700 px-8 py-3.5 text-base font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              Enable monitoring
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
