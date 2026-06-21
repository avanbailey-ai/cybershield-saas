import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import LegalSection from '@/components/legal/LegalSection';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Acceptable Use Policy — CyberShield Cloud',
  description: 'Rules for authorized website scanning and acceptable use of CyberShield Cloud.',
  path: '/acceptable-use',
});

export default function AcceptableUsePage() {
  return (
    <LegalPageLayout title="Acceptable Use Policy">
      <p className="text-sm text-gray-500">Last updated: June 2026</p>

      <LegalSection title="Authorized scanning only">
        <p>
          You may only scan, monitor, or test websites you own, manage, or have explicit written authorization
          to assess. Do not use CyberShield against third-party sites without permission.
        </p>
      </LegalSection>

      <LegalSection title="No illegal scanning">
        <p>
          You must comply with applicable laws and regulations. Do not use the service for unlawful
          surveillance, harassment, or unauthorized access attempts.
        </p>
      </LegalSection>

      <LegalSection title="No abuse or misuse">
        <p>
          Prohibited behavior includes: attacking or exploiting targets beyond authorized checks, scraping
          unrelated data, spamming, circumventing rate limits, reselling access without agreement, or
          interfering with platform operations.
        </p>
      </LegalSection>

      <LegalSection title="Account suspension">
        <p>
          We may suspend or terminate accounts that violate this policy or pose risk to the platform or
          third parties, with or without notice depending on severity.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Report abuse or ask questions:{' '}
          <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
            {SEO_SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
