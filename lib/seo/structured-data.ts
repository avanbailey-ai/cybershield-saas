import { resolveSiteUrl } from '@/lib/site/getSiteUrl';
import {
  SEO_BRAND,
  SEO_DEFAULT_DESCRIPTION,
  SEO_LEGAL_NAME,
  SEO_SUPPORT_EMAIL,
} from './constants';

export function organizationSchema() {
  const url = resolveSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SEO_BRAND,
    legalName: SEO_LEGAL_NAME,
    url,
    email: SEO_SUPPORT_EMAIL,
    logo: `${url}/icon.svg`,
    sameAs: [] as string[],
  };
}

export function webSiteSchema() {
  const url = resolveSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO_BRAND,
    url,
    description: SEO_DEFAULT_DESCRIPTION,
    publisher: { '@type': 'Organization', name: SEO_BRAND },
  };
}

export function softwareApplicationSchema() {
  const url = resolveSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SEO_BRAND,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free scan; paid plans for continuous monitoring',
      url: `${url}/pricing`,
    },
    description: SEO_DEFAULT_DESCRIPTION,
    url,
  };
}

export function productSchema() {
  const url = resolveSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${SEO_BRAND} — Website Security Monitoring`,
    description: SEO_DEFAULT_DESCRIPTION,
    brand: { '@type': 'Brand', name: SEO_BRAND },
    url: `${url}/pricing`,
  };
}

export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  const base = resolveSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  };
}

export function featurePageSchema(input: {
  title: string;
  description: string;
  path: string;
}) {
  const url = `${resolveSiteUrl()}${input.path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.title,
    description: input.description,
    url,
    isPartOf: { '@type': 'WebSite', name: SEO_BRAND, url: resolveSiteUrl() },
  };
}
