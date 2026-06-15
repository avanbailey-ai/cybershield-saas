import type { Metadata } from 'next';
import Link from 'next/link';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import { CASE_STUDIES } from '@/lib/sales/caseStudies';

export const metadata: Metadata = {
  title: 'Enterprise Case Studies',
  description: 'See how organizations reduced security risk with CyberShield enterprise monitoring.',
  openGraph: {
    title: 'CyberShield Enterprise Case Studies',
    description: 'Real outcomes: up to 62% risk reduction in 90 days.',
  },
};

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <EnterpriseHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white">Enterprise Case Studies</h1>
          <p className="mt-2 text-gray-400">
            Anonymized outcomes from teams using CyberShield at scale.
          </p>
        </div>

        <div className="grid gap-8">
          {CASE_STUDIES.map((study) => (
            <article
              key={study.id}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-blue-400">
                    {study.industry}
                  </span>
                  <h2 className="mt-1 text-xl font-bold text-white">{study.title}</h2>
                  <p className="text-sm text-gray-500">{study.companySize}</p>
                </div>
                <div className="rounded-lg bg-green-500/10 px-4 py-2 text-center">
                  <p className="text-2xl font-bold text-green-400">{study.riskReductionPercent}%</p>
                  <p className="text-xs text-gray-400">risk reduction</p>
                </div>
              </div>

              <p className="mt-4 text-gray-300">{study.summary}</p>

              <div className="mt-6 flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <p className="text-xs uppercase text-gray-500">Before</p>
                  <p className={`text-2xl font-bold ${scoreColor(study.beforeScore)}`}>
                    {study.beforeScore}
                  </p>
                </div>
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="text-center">
                  <p className="text-xs uppercase text-gray-500">After</p>
                  <p className={`text-2xl font-bold ${scoreColor(study.afterScore)}`}>
                    {study.afterScore}
                  </p>
                </div>
                <div className="text-sm text-gray-400">Timeline: {study.timeline}</div>
              </div>

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
            href="/enterprise/lead"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500"
          >
            Get Similar Results
          </Link>
        </div>
      </main>
    </div>
  );
}
