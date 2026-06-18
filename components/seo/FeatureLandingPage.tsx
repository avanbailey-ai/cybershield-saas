import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { JsonLd } from '@/components/seo/JsonLd';
import type { FeaturePageDef } from '@/lib/seo/features';
import { getFeatureBySlug } from '@/lib/seo/features';
import { breadcrumbSchema, featurePageSchema } from '@/lib/seo/structured-data';

export default function FeatureLandingPage({ feature }: { feature: FeaturePageDef }) {
  const path = `/features/${feature.slug}`;
  const related = feature.relatedSlugs
    .map((slug) => getFeatureBySlug(slug))
    .filter(Boolean) as FeaturePageDef[];

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <JsonLd
        data={[
          featurePageSchema({ title: feature.title, description: feature.description, path }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Features', path: '/features' },
            { name: feature.title, path },
          ]),
        ]}
      />
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-24">
        <p className="text-sm font-medium text-blue-400">Feature</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {feature.headline}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-gray-400">{feature.intro}</p>

        <ul className="mt-8 space-y-3">
          {feature.benefits.map((b) => (
            <li key={b} className="flex gap-3 text-gray-300">
              <span className="mt-1 text-blue-400">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/scan"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Scan a website free
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:border-gray-600"
          >
            View pricing
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:border-gray-600"
          >
            Create account
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-16 border-t border-gray-800 pt-10">
            <h2 className="text-lg font-semibold text-white">Related capabilities</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/features/${r.slug}`}
                    className="block rounded-lg border border-gray-800 bg-gray-900/40 p-4 hover:border-gray-700"
                  >
                    <p className="font-medium text-white">{r.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{r.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
