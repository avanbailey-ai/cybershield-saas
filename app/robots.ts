import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/app/', '/api/', '/auth/callback'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
