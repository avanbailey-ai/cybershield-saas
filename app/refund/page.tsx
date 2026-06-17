import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Refund & Cancellation — CyberShield',
  description: 'CyberShield billing, cancellation, and refund policy.',
};

export default function RefundPage() {
  return (
    <LegalPageLayout title="Refund & Cancellation Policy">
      <p>
        CyberShield subscriptions are billed monthly through Stripe. You can cancel anytime from Settings → Manage
        billing in your dashboard. Cancellation stops future charges; access continues through the end of the paid
        period.
      </p>
      <p>
        If you believe you were charged in error, contact support within 30 days and we will review the charge. Refunds
        are issued at our discretion for duplicate charges or clear billing errors, consistent with our 30-day satisfaction
        guarantee shown at checkout.
      </p>
      <p>
        Free public scans do not require payment. Monitoring and alert emails are included with paid plans only.
      </p>
    </LegalPageLayout>
  );
}
