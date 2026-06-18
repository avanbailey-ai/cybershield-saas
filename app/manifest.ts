import type { MetadataRoute } from 'next';
import { SEO_BRAND } from '@/lib/seo/constants';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SEO_BRAND,
    short_name: 'CyberShield',
    description: 'Website security monitoring for small businesses and agencies.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0f1e',
    theme_color: '#2563eb',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
