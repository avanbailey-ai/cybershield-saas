import type { Metadata } from 'next';
import Link from 'next/link';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import { CASE_STUDIES, CASE_STUDIES_DISCLAIMER } from '@/lib/sales/caseStudies';

export const metadata: Metadata = {
  title: 'Enterprise Use Cases — CyberShield Cloud',
  description:
    'Illustrative scenarios for how teams use CyberShield monitoring — not verified customer outcomes.',
  openGraph: {
    title: 'CyberShield Enterprise Use Cases',
    description: 'Planning scenarios for multi-site monitoring, agencies, and custom enterprise inquiries.',
  },
};

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <EnterpriseHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white">Enterprise Use Cases</h1>
          <p className="mt-2 text-gray-400">{CASE_STUDIES_DISCLAIMER}</p>
        </div>

        <div className="grid gap-8">
          {CASE_STUDIES.map((study) => (
            <article
              key={study.id}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 sm:p-8"
            >
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-blue-400">
                  {study.industry}
                </span>
                <h2 className="mt-1 text-xl font-bold text-white">{study.title}</h2>
                <p className="text-sm text-gray-500">{study.companySize}</p>
              </div>

              <p className="mt-4 text-gray-300">{study.summary}</p>

              <ul className="mt-6 space-y-2">
                {study.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/enterprise/review"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500"
          >
            Discuss your use case
          </Link>
        </div>
      </main>
    </div>
  );
}
