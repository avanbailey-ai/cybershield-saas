import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FeatureLandingPage from '@/components/seo/FeatureLandingPage';
import { FEATURE_PAGES, getFeatureBySlug } from '@/lib/seo/features';
import { buildPageMetadata } from '@/lib/seo/metadata';

export function generateStaticParams() {
  return FEATURE_PAGES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) return {};
  return buildPageMetadata({
    title: feature.title,
    description: feature.description,
    path: `/features/${feature.slug}`,
    keywords: feature.keywords,
  });
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) notFound();
  return <FeatureLandingPage feature={feature} />;
}
