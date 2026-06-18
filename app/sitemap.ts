import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';
import { FEATURE_PAGES } from '@/lib/seo/features';

const PUBLIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/scan', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/features', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/signup', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/enterprise', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/enterprise/case-studies', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/enterprise/pricing', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/enterprise/demo', priority: 0.65, changeFrequency: 'monthly' },
  { path: '/leaderboard', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/security', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/responsible-disclosure', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl();
  const lastModified = new Date();

  const staticEntries = PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));

  const featureEntries = FEATURE_PAGES.map((f) => ({
    url: `${base}/features/${f.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...featureEntries];
}
