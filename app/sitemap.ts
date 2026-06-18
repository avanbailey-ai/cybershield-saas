import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

const PUBLIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/scan', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/enterprise', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/enterprise/case-studies', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/leaderboard', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl();
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
