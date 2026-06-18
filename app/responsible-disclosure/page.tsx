import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Responsible Disclosure',
  description:
    'Report security vulnerabilities in CyberShield Cloud through our responsible disclosure process.',
  path: '/responsible-disclosure',
});

export default function ResponsibleDisclosurePage() {
  return (
    <LegalPageLayout title="Responsible Disclosure">
      <p>
        We appreciate researchers and customers who report security issues responsibly. Please email{' '}
        <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
          {SEO_SUPPORT_EMAIL}
        </a>{' '}
        with a clear description, reproduction steps, and impact assessment.
      </p>
      <h2 className="text-xl font-semibold text-white">Please do not</h2>
      <ul className="list-inside list-disc space-y-2">
        <li>Access or modify data that does not belong to you</li>
        <li>Perform denial-of-service testing against production</li>
        <li>Publicly disclose issues before we have had reasonable time to remediate</li>
      </ul>
      <p>We aim to acknowledge valid reports promptly and keep reporters informed of remediation status.</p>
    </LegalPageLayout>
  );
}
