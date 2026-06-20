import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/app/',
        '/api/',
        '/auth/',
        '/checkout/',
        '/onboarding/',
        '/login',
        '/signup',
        '/reset-password',
        '/report/',
        '/scan-result/',
        '/summary/',
        '/enterprise/login',
        '/enterprise/portal/',
        '/enterprise/onboarding/',
        '/enterprise/lead',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
