import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import LegalSection from '@/components/legal/LegalSection';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Refund Policy — CyberShield Cloud',
  description: 'CyberShield Cloud subscription billing, cancellation, and refund policy.',
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy">
      <p className="text-sm text-gray-500">Last updated: June 2026</p>

      <LegalSection title="Monthly subscription billing">
        <p>
          CyberShield paid plans are billed monthly through Stripe. Charges recur each billing period until
          you cancel. Free public scans do not require payment.
        </p>
      </LegalSection>

      <LegalSection title="Cancel anytime">
        <p>
          You may cancel from Settings → Manage billing in your dashboard or the Stripe customer portal.
          Cancellation stops future charges. Access continues through the end of the current paid period.
        </p>
      </LegalSection>

      <LegalSection title="Refund review process">
        <p>
          If you believe you were charged in error (duplicate charge, wrong plan, or billing mistake),
          contact support within 30 days with your account email and charge details. We review requests
          case-by-case.
        </p>
      </LegalSection>

      <LegalSection title="No guaranteed refunds after active usage">
        <p>
          Except where required by law or at our discretion for clear billing errors, we do not guarantee
          refunds after you have actively used paid monitoring during a billing period. Promotional guarantees
          shown at checkout apply only as stated on that offer.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Billing and refund questions:{' '}
          <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
            {SEO_SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
