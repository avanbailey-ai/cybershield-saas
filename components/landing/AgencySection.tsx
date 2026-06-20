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
    <section id="agencies" className="relative px-4 py-10 sm:px-4 sm:py-24 md:px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center sm:mb-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500 sm:mb-3 sm:text-sm">
            For Agencies
          </p>
          <h2 className="mb-3 text-xl font-bold tracking-tight text-white sm:mb-4 sm:text-4xl">
            Monitor every client site from one place
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-gray-400 sm:text-base">
            Agencies managing multiple client websites need continuous visibility — not quarterly
            manual checks. CyberShield automates monitoring so you can focus on delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {AGENCY_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 sm:rounded-xl sm:p-6"
            >
              <h3 className="text-sm font-semibold text-white sm:text-base">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400 sm:mt-2">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-center">
          <Link
            href="/agency"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto sm:px-7"
          >
            View Agency plans
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-gray-700 px-6 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white sm:w-auto sm:px-7"
          >
            Enterprise & custom limits
          </Link>
        </div>
      </div>
    </section>
  );
}
