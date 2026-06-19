import type { Metadata } from 'next';
import AgencyLandingPage from '@/components/landing/AgencyLandingPage';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'Website Monitoring for Agencies',
  description:
    'Monitor client websites for SSL, domain, security, uptime, and change issues. Agency plan $299/mo with client-ready reports.',
  path: '/agency',
  keywords: [
    'agency website monitoring',
    'client website monitoring',
    'WordPress agency monitoring',
    'Shopify agency monitoring',
  ],
});

export default async function AgencyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <AgencyLandingPage searchParams={params} />;
}
