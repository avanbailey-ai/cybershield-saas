import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { appendAttributionQuery } from '@/lib/conversion/signupPlanContext';
import type { PublicProspectSummary } from '@/lib/prospect/publicProspectSummary';
import { RECOMMENDED_PLAN_PRICES_USD } from '@/lib/billing/planFeatures';

export function GenericProspectSummaryFallback() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-28">
        <h1 className="text-3xl font-bold text-white">Website monitoring summary</h1>
        <p className="mt-4 text-gray-400 leading-relaxed">
          CyberShield Cloud monitors websites for SSL issues, domain problems, security
          configuration changes, uptime shifts, and unexpected changes — with clear alerts and
          reports.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Continue to CyberShield Cloud
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-medium text-gray-300 hover:border-gray-600"
          >
            View monitoring options
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ProspectSummaryView({ summary }: { summary: PublicProspectSummary }) {
  const signupHref = appendAttributionQuery('/signup', {
    plan: summary.ctaPlan,
    source: summary.source,
    prospect: summary.prospectToken,
  });
  const agencyHref = appendAttributionQuery('/agency', {
    plan: 'agency',
    source: summary.source,
    prospect: summary.prospectToken,
  });
  const price =
    summary.ctaPlan === 'agency'
      ? RECOMMENDED_PLAN_PRICES_USD.agency
      : RECOMMENDED_PLAN_PRICES_USD.pro;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-28">
        <p className="text-sm font-medium uppercase tracking-wider text-blue-400">
          {summary.kind === 'agency' ? 'Agency review summary' : 'Website review summary'}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">{summary.businessName}</h1>
        <p className="mt-2 text-gray-500">Website reviewed: {summary.websiteHost}</p>

        <section className="mt-10 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">
            What we checked
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-gray-300">
            {summary.checkedAreas.map((area) => (
              <li key={area} className="flex gap-2">
                <span className="text-blue-400">✓</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">
            {summary.kind === 'agency' ? 'Opportunities for your agency' : 'Observations'}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-300">
            {summary.findings.map((f) => (
              <li key={f} className="leading-relaxed">
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 text-gray-400 leading-relaxed">
          <p>{summary.valueProposition}</p>
          {summary.kind === 'agency' && (
            <p className="mt-4 text-sm text-gray-500">
              Agency monitoring from ${price}/mo — built for portfolios and client-ready reports.
            </p>
          )}
        </section>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={signupHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Continue to CyberShield Cloud
          </Link>
          <Link
            href={summary.kind === 'agency' ? agencyHref : '/pricing'}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-700 px-6 py-3 text-sm font-medium text-gray-300 hover:border-gray-600"
          >
            View monitoring options
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
