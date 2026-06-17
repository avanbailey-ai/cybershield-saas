import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Contact — CyberShield',
  description: 'Contact CyberShield support.',
};

export default function ContactPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@cybershield.app';

  return (
    <LegalPageLayout title="Contact Support">
      <p>
        For product support, billing questions, or enterprise inquiries, email us at{' '}
        <a href={`mailto:${supportEmail}`} className="font-medium text-blue-400 hover:text-blue-300">
          {supportEmail}
        </a>
        .
      </p>
      <p>
        Enterprise security reviews and agency onboarding: use the{' '}
        <a href="/enterprise/review" className="text-blue-400 hover:text-blue-300">
          Request Security Review
        </a>{' '}
        form and our team will follow up.
      </p>
      <p className="text-sm text-gray-500">
        Signed-in users can also report issues from the Report a Problem widget in the dashboard.
      </p>
    </LegalPageLayout>
  );
}
