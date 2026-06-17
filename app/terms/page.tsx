import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service — CyberShield',
  description: 'CyberShield terms of service for website security monitoring.',
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p>
        CyberShield provides website security scanning and monitoring software. By using our service you agree to
        use it lawfully and only on websites you own or are authorized to test.
      </p>
      <p>
        Scans analyze publicly observable signals. CyberShield is not a penetration testing service and does not
        guarantee that all vulnerabilities will be detected.
      </p>
      <p>
        Paid plans renew monthly until canceled. You may cancel anytime from billing settings or the Stripe customer
        portal. See our{' '}
        <a href="/refund" className="text-blue-400 hover:text-blue-300">
          refund policy
        </a>{' '}
        for billing questions.
      </p>
      <p>
        We may update these terms as the product evolves. Continued use after changes constitutes acceptance of the
        updated terms.
      </p>
    </LegalPageLayout>
  );
}
