import type { Metadata } from 'next';
import ProspectSummaryView, {
  GenericProspectSummaryFallback,
} from '@/components/prospect/ProspectSummaryView';
import { loadPublicProspectSummary } from '@/lib/prospect/publicProspectSummary';
import { isValidAttributionToken } from '@/lib/owner/prospectAttribution';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'Your Website Review Summary',
  description: 'A brief summary of what CyberShield Cloud reviewed and how monitoring can help.',
  path: '/summary',
  noIndex: true,
});

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.prospect;
  const token = Array.isArray(raw) ? raw[0] : raw;

  if (!token || !isValidAttributionToken(token)) {
    return <GenericProspectSummaryFallback />;
  }

  const summary = await loadPublicProspectSummary(token);
  if (!summary) {
    return <GenericProspectSummaryFallback />;
  }

  return <ProspectSummaryView summary={summary} />;
}
