import Link from 'next/link';

const AGENCY_FEATURES = [
  {
    title: 'Multi-site monitoring',
    description:
      'Monitor up to 250 websites on Agency plans. Pro and Growth support 10 and 50 sites respectively — scale as your client roster grows.',
  },
  {
    title: 'Centralized management',
    description:
      'One dashboard for every client website. Security scores, SSL status, and alerts organized by property — no switching between tools.',
  },
  {
    title: 'Priority monitoring',
    description:
      'Mark critical client sites for 5-minute checks. Remaining sites checked hourly. Catch downtime and certificate issues before clients do.',
  },
  {
    title: 'Automated reports',
    description:
      'Executive-ready security reports per website. Share findings with clients or attach to monthly retainers without manual assembly.',
  },
  {
    title: 'Client visibility',
    description:
      'Health Center gives each website a clear executive summary — ideal for client check-ins and QBR conversations.',
  },
  {
    title: 'Time savings',
    description:
      'Change Timeline groups scan diffs into plain-language events. Spend less time investigating what changed and more time fixing it.',
  },
] as const;

export default function AgencySection() {
  return (
    <section id="agencies" className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-500">
            For Agencies
          </p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Monitor every client site from one place
          </h2>
          <p className="mx-auto max-w-2xl text-base text-gray-400">
            Agencies managing multiple client websites need continuous visibility — not quarterly
            manual checks. CyberShield automates monitoring so you can focus on delivery.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AGENCY_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-6"
            >
              <h3 className="text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            View Agency plans
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-700 px-7 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Enterprise & custom limits
          </Link>
        </div>
      </div>
    </section>
  );
}
