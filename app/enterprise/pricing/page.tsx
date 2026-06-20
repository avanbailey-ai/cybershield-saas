import type { Metadata } from 'next';
import Link from 'next/link';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import TrustSignals from '@/components/enterprise/TrustSignals';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Enterprise Security — CyberShield Cloud',
  description: 'Enterprise security monitoring, compliance reporting, and dedicated support for regulated teams.',
  path: '/enterprise/pricing',
  noIndex: true,
});

export const revalidate = 3600;
export const runtime = 'nodejs';

export default function EnterprisePricingPage() {
  const offerings = [
    {
      name: 'Enterprise Protection',
      subtitle: 'For security-conscious organizations',
      features: [
        'Unlimited websites & seats',
        'Multi-tenant org management',
        'SOC2-ready audit logs',
        'SSO / SAML integration path',
        'Dedicated security review',
        'Custom SLA & support',
      ],
      cta: 'Request security review',
      ctaHref: '/enterprise/review',
      highlighted: true,
    },
    {
      name: 'Security Audit',
      subtitle: 'One-time comprehensive assessment',
      features: [
        'Full vulnerability assessment',
        'Executive summary report',
        'Remediation roadmap',
        'Compliance gap analysis',
        'Optional ongoing monitoring handoff',
      ],
      cta: 'Request audit',
      ctaHref: '/enterprise/lead?message=Security+Audit+inquiry',
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <EnterpriseHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white">Enterprise Security</h1>
          <p className="mt-3 text-lg text-gray-400">
            Custom coverage for regulated teams — scoped by our security experts.
          </p>
        </div>

        <div className="mb-16 grid gap-6 lg:grid-cols-2">
          {offerings.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-6 ${
                tier.highlighted
                  ? 'border-blue-500/50 bg-blue-600/5 ring-1 ring-blue-500/30'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Recommended
                </span>
              )}
              <h2 className="text-xl font-bold text-white">{tier.name}</h2>
              <p className="mt-1 text-sm text-gray-400">{tier.subtitle}</p>
              <p className="mt-4 text-3xl font-bold text-white">Custom</p>
              <p className="mt-1 text-xs text-gray-500">Scoped to your environment</p>
              <ul className="mt-6 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaHref}
                className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold ${
                  tier.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mb-12">
          <h2 className="mb-6 text-center text-xl font-semibold text-white">Built for Enterprise Trust</h2>
          <TrustSignals />
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/enterprise/review"
            className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500"
          >
            Request security review
          </Link>
          <Link
            href="/scan"
            className="rounded-lg border border-gray-700 px-8 py-3 font-semibold text-gray-300 hover:border-gray-600 hover:text-white"
          >
            Run free scan first
          </Link>
        </div>
      </main>
    </div>
  );
}
