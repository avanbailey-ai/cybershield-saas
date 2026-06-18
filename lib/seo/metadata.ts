import type { Metadata } from 'next';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';
import { SEO_BRAND, SEO_DEFAULT_DESCRIPTION } from './constants';

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const base = resolveSiteUrl();
  const canonical = `${base}${input.path}`;
  const title = input.title.includes(SEO_BRAND) ? input.title : `${input.title} | ${SEO_BRAND}`;

  return {
    title,
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description: input.description,
      url: canonical,
      siteName: SEO_BRAND,
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: input.description,
    },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: `${SEO_BRAND} — Website Security Monitoring`,
    template: `%s | ${SEO_BRAND}`,
  },
  description: SEO_DEFAULT_DESCRIPTION,
  keywords: [
    'website security monitoring',
    'website security scanner',
    'SSL monitoring',
    'website change detection',
    'website health monitoring',
    'website security alerts',
  ],
  alternates: { canonical: resolveSiteUrl() },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SEO_BRAND,
    title: `${SEO_BRAND} — Website Security Monitoring`,
    description: SEO_DEFAULT_DESCRIPTION,
    url: resolveSiteUrl(),
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SEO_BRAND} — Website Security Monitoring`,
    description: SEO_DEFAULT_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};
