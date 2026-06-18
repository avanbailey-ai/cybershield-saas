import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { FEATURE_PAGES } from '@/lib/seo/features';

export const metadata: Metadata = buildPageMetadata({
  title: 'Features',
  description:
    'Website security monitoring features: SSL monitoring, change detection, health scores, domain monitoring, and agency-ready reporting.',
  path: '/features',
});

export default function FeaturesIndexPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-24">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Platform features</h1>
        <p className="mt-4 text-lg text-gray-400">
          Purpose-built pages for how teams search for website security monitoring capabilities.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURE_PAGES.map((f) => (
            <li key={f.slug}>
              <Link
                href={`/features/${f.slug}`}
                className="block rounded-xl border border-gray-800 bg-gray-900/40 p-5 hover:border-gray-700"
              >
                <h2 className="font-semibold text-white">{f.title}</h2>
                <p className="mt-2 text-sm text-gray-500">{f.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  );
}
