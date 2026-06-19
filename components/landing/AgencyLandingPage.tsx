import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { RECOMMENDED_PLAN_PRICES_USD } from '@/lib/billing/planFeatures';
import { appendAttributionQuery } from '@/lib/conversion/signupPlanContext';

const AGENCY_PRICE = RECOMMENDED_PLAN_PRICES_USD.agency;

const MONITORS = [
  'SSL certificate expiry and HTTPS configuration',
  'Domain and DNS-related issues',
  'Security header and configuration changes',
  'Uptime and availability shifts',
  'Unexpected website changes across client sites',
] as const;

const FAQ = [
  {
    q: 'Is this built for agencies managing many client sites?',
    a: 'Yes. The Agency plan supports up to 250 websites with portfolio-level visibility, priority monitoring slots, and client-ready reports.',
  },
  {
    q: 'Can we add this to existing care or maintenance plans?',
    a: 'Most agencies bundle CyberShield as monitoring infrastructure — continuous checks and monthly reports clients can understand.',
  },
  {
    q: 'Do clients need their own accounts?',
    a: 'You manage sites from your agency dashboard. Share reports with clients on your schedule without giving up control.',
  },
  {
    q: 'How is pricing structured?',
    a: `Agency monitoring is $${AGENCY_PRICE}/mo with self-serve checkout. Enterprise options are available for custom limits.`,
  },
] as const;

type AgencyLandingProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function paramOne(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const v = searchParams?.[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default function AgencyLandingPage({ searchParams }: AgencyLandingProps) {
  const plan = 'agency';
  const source = paramOne(searchParams, 'source');
  const prospect = paramOne(searchParams, 'prospect');

  const signupHref = appendAttributionQuery('/signup', { plan, source, prospect });
  const pricingHref = appendAttributionQuery('/pricing', { plan, source, prospect });
  const summaryHref = prospect
    ? appendAttributionQuery('/summary', { plan, source, prospect })
    : null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="pt-16">
        <section className="border-b border-gray-800/60 px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-500">
              For web, design, SEO & WordPress agencies
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Monitor every client website from one place
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
              CyberShield Cloud helps agencies monitor client websites for SSL issues, domain
              problems, security setting changes, uptime changes, and unexpected website changes —
              so you catch problems before clients notice and deliver better reports.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href={signupHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start agency monitoring — ${AGENCY_PRICE}/mo
              </Link>
              <Link
                href={pricingHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-700 px-8 py-3 text-sm font-medium text-gray-300 hover:border-gray-600 hover:text-white"
              >
                Compare plans
              </Link>
            </div>
            {summaryHref && (
              <p className="mt-4 text-sm text-gray-500">
                <Link href={summaryHref} className="text-blue-400 hover:text-blue-300">
                  View your personalized summary →
                </Link>
              </p>
            )}
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">What CyberShield monitors</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {MONITORS.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-gray-800 bg-gray-900/50 px-5 py-4 text-sm text-gray-300"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-gray-800/60 bg-gray-900/30 px-5 py-16">
          <div className="mx-auto max-w-5xl grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-white">Why agencies need this</h2>
              <p className="mt-4 text-gray-400 leading-relaxed">
                Client websites change constantly — certificates renew, plugins update, headers drift,
                and downtime happens. Manual quarterly checks miss issues that erode client trust.
                Continuous monitoring gives your team early warning and a clear story for retainers.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Fits care & maintenance plans</h2>
              <p className="mt-4 text-gray-400 leading-relaxed">
                Position CyberShield as monitoring infrastructure behind your care plan: automated
                checks, change history, and monthly client-ready reports your team does not have to
                assemble by hand.
              </p>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-white">Monthly client-ready reports</h2>
            <p className="mt-4 max-w-3xl text-gray-400">
              Health Center summaries, SSL status, and change timelines per client site — formatted
              for check-ins and QBR conversations.{' '}
              <Link href="/features/security-reports" className="text-blue-400 hover:text-blue-300">
                Learn about security reports →
              </Link>
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link href="/features/website-security-monitoring" className="text-gray-400 hover:text-white">
                Website monitoring
              </Link>
              <Link href="/features/ssl-monitoring" className="text-gray-400 hover:text-white">
                SSL monitoring
              </Link>
              <Link href="/features/domain-monitoring" className="text-gray-400 hover:text-white">
                Domain monitoring
              </Link>
              <Link href="/features/website-change-detection" className="text-gray-400 hover:text-white">
                Change detection
              </Link>
              <Link href="/features/agency-monitoring" className="text-gray-400 hover:text-white">
                Agency monitoring
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-800/60 px-5 py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border border-blue-500/30 bg-blue-500/5 p-8 text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-blue-400">Agency plan</p>
            <p className="mt-2 text-4xl font-bold text-white">${AGENCY_PRICE}<span className="text-lg text-gray-400">/mo</span></p>
            <p className="mt-3 text-gray-400">Up to 250 websites · priority monitoring · client reports</p>
            <Link
              href={signupHref}
              className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start agency monitoring
            </Link>
          </div>
        </section>

        <section className="px-5 pb-20 pt-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-white">FAQ</h2>
            <dl className="mt-6 space-y-6">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="font-medium text-white">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-gray-400">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
