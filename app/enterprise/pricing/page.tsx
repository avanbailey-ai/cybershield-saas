import type { Metadata } from 'next';
import Link from 'next/link';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import TrustSignals from '@/components/enterprise/TrustSignals';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { formatDisplayPrice } from '@/lib/billing/formatPrice';

export const metadata: Metadata = {
  title: 'Enterprise Pricing',
  description: 'CyberShield enterprise security monitoring — Growth, Enterprise, and Security Audit packages.',
  openGraph: {
    title: 'CyberShield Enterprise Pricing',
    description: 'Custom enterprise security monitoring, audit logs, and dedicated support.',
    type: 'website',
  },
};

export const revalidate = 3600;
export const runtime = 'nodejs';

export default async function EnterprisePricingPage() {
  const displayAmounts = await getPlanDisplayAmounts();
  const growthPrice = displayAmounts.growth;

  const tiers = [
    {
      name: 'Business',
      planKey: 'growth' as const,
      subtitle: 'For growing teams',
      price: growthPrice,
      custom: false,
      features: [
        `${PLAN_LIMITS.growth.websites} websites monitored`,
        'Daily automated scans',
        'Email alerts & digests',
        'Team dashboard access',
      ],
      cta: 'Get Started',
      ctaHref: '/pricing',
      highlighted: false,
    },
    {
      name: 'Enterprise',
      planKey: null,
      subtitle: 'For security-conscious organizations',
      price: null,
      custom: true,
      features: [
        'Unlimited websites & seats',
        'Multi-tenant org management',
        'SOC2-ready audit logs',
        'SSO / SAML integration path',
        'Dedicated security review',
        'Custom SLA & support',
      ],
      cta: 'Contact Sales',
      ctaHref: '/enterprise/lead',
      highlighted: true,
    },
    {
      name: 'Security Audit',
      planKey: null,
      subtitle: 'One-time comprehensive assessment',
      price: null,
      custom: true,
      auditPrice: 'From $2,500',
      features: [
        'Full vulnerability assessment',
        'Executive summary report',
        'Remediation roadmap',
        'Compliance gap analysis',
        'Optional ongoing monitoring handoff',
      ],
      cta: 'Request Audit',
      ctaHref: '/enterprise/lead?message=Security+Audit+inquiry',
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <EnterpriseHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white">Enterprise Security Pricing</h1>
          <p className="mt-3 text-lg text-gray-400">
            From self-serve Growth plans to custom enterprise deployments.
          </p>
        </div>

        <div className="mb-16 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
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
                  Most Popular
                </span>
              )}
              <h2 className="text-xl font-bold text-white">{tier.name}</h2>
              <p className="mt-1 text-sm text-gray-400">{tier.subtitle}</p>
              <div className="mt-4">
                {tier.custom ? (
                  <p className="text-3xl font-bold text-white">
                    {'auditPrice' in tier && tier.auditPrice ? tier.auditPrice : 'Custom'}
                  </p>
                ) : (
                  <p className="text-3xl font-bold text-white">
                    {formatDisplayPrice(tier.price)}
                    <span className="text-base font-normal text-gray-400">/mo</span>
                  </p>
                )}
              </div>
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
            href="/enterprise/lead"
            className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500"
          >
            Talk to Sales
          </Link>
          <Link
            href="/scan"
            className="rounded-lg border border-gray-700 px-8 py-3 font-semibold text-gray-300 hover:border-gray-600 hover:text-white"
          >
            Run Free Scan
          </Link>
        </div>
      </main>
    </div>
  );
}
