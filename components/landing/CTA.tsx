import Link from "next/link";

export default function CTA() {
  return (
    <section className="relative py-24 px-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-3xl text-center">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-8 py-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your Website Is Either Secure or Exposed. Find Out Now.
          </h2>
          <p className="mb-10 mx-auto max-w-xl text-gray-400">
            Free instant scan — no credit card, no signup. See your score in under 30 seconds.
          </p>
          <a
            href="/#scan"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
          >
            Scan your website for free
          </a>
        </div>
      </div>
    </section>
  );
}
