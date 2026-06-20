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
  const fullTitle = input.title.includes(SEO_BRAND)
    ? input.title
    : `${input.title} | ${SEO_BRAND}`;

  return {
    title: { absolute: fullTitle },
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description: input.description,
      url: canonical,
      siteName: SEO_BRAND,
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: input.description,
    },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: 'CyberShield Cloud — Website Security Monitoring for Businesses and Agencies',
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
    title: 'CyberShield Cloud — Website Security Monitoring for Businesses and Agencies',
    description: SEO_DEFAULT_DESCRIPTION,
    url: resolveSiteUrl(),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CyberShield Cloud — Website Security Monitoring for Businesses and Agencies',
    description: SEO_DEFAULT_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
  },
};
