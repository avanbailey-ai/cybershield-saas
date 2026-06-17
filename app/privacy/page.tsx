import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy — CyberShield',
  description: 'How CyberShield handles your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p>
        CyberShield collects account information (email, organization details), website URLs you add for monitoring,
        scan results, and billing data processed by Stripe. We use this data to provide security monitoring and
        alerts.
      </p>
      <p>
        Scan results are stored securely and scoped to your account. We do not sell personal data. Email alerts are
        sent only to addresses associated with your account according to your notification preferences.
      </p>
      <p>
        We use industry-standard providers (hosting, database, email, payments) to operate the service. You may
        request account deletion by contacting support.
      </p>
      <p>
        For privacy questions contact us via the{' '}
        <a href="/contact" className="text-blue-400 hover:text-blue-300">
          contact page
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
