import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact',
  description: 'Contact CyberShield Cloud support for product, billing, and enterprise inquiries.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <LegalPageLayout title="Contact Support">
      <p>
        For product support, billing questions, or enterprise inquiries, email us at{' '}
        <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="font-medium text-blue-400 hover:text-blue-300">
          {SEO_SUPPORT_EMAIL}
        </a>
        .
      </p>
      <h2 className="text-xl font-semibold text-white">Business information</h2>
      <p>CyberShield Cloud — website security monitoring software (remote-first).</p>
      <p className="text-sm text-gray-500">
        For local business visibility, maintain consistent name, address, and phone (NAP) on your Google
        Business Profile and major citations when applicable.
      </p>
      <p>
        Enterprise security reviews for SSO, audit-log, custom SLA, or regulated requirements: use the{' '}
        <a href="/enterprise/review" className="text-blue-400 hover:text-blue-300">
          Enterprise Review
        </a>{' '}
        form and our team will follow up.
      </p>
      <p className="text-sm text-gray-500">
        Signed-in users can also report issues from the Report a Problem widget in the dashboard.
      </p>
    </LegalPageLayout>
  );
}
