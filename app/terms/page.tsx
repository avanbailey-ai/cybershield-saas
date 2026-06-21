import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import LegalSection from '@/components/legal/LegalSection';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Terms of Service — CyberShield Cloud',
  description:
    'Terms of Service for CyberShield Cloud website security monitoring, scanning, alerts, and reporting.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p className="text-sm text-gray-500">Last updated: June 2026</p>

      <LegalSection title="Acceptance of terms">
        <p>
          By accessing or using CyberShield Cloud (&quot;CyberShield,&quot; &quot;we,&quot; &quot;us&quot;), you agree
          to these Terms of Service. If you do not agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection title="Description of service">
        <p>
          CyberShield provides automated website security monitoring software. The service helps detect common
          configuration issues, monitor website changes, generate plain-English findings, send alerts, and
          produce reports. CyberShield improves security visibility and hygiene; it is not a guarantee of
          complete security.
        </p>
      </LegalSection>

      <LegalSection title="Account responsibility">
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all
          activity under your account. You must provide accurate account information and notify us promptly
          of unauthorized access.
        </p>
      </LegalSection>

      <LegalSection title="Subscriptions and billing">
        <p>
          Paid plans are billed monthly through Stripe unless otherwise stated at checkout. Fees are charged
          in advance for each billing period. Plan limits (websites, scan quotas, monitoring cadence) are
          described on the pricing page and may change with notice.
        </p>
      </LegalSection>

      <LegalSection title="Refunds and cancellations">
        <p>
          You may cancel anytime from billing settings or the Stripe customer portal. Cancellation stops
          future charges; access continues through the end of the paid period. See our{' '}
          <a href="/refund-policy" className="text-blue-400 hover:text-blue-300">
            Refund Policy
          </a>{' '}
          for refund eligibility.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          You may only scan and monitor websites you own, manage, or are explicitly authorized to test. See
          our{' '}
          <a href="/acceptable-use" className="text-blue-400 hover:text-blue-300">
            Acceptable Use Policy
          </a>{' '}
          for full rules. Abuse may result in suspension.
        </p>
      </LegalSection>

      <LegalSection title="Security scanning authorization">
        <p>
          By adding a website to CyberShield, you represent that you have authority to allow automated
          checks against that property. Unauthorized scanning is prohibited.
        </p>
      </LegalSection>

      <LegalSection title="No guarantee of complete security">
        <p>
          CyberShield does not guarantee that your website is secure, will remain secure, or is free from
          vulnerabilities. Automated checks may miss issues or produce false positives. See our{' '}
          <a href="/security-disclaimer" className="text-blue-400 hover:text-blue-300">
            Security Disclaimer
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, CyberShield is not liable for indirect, incidental,
          special, consequential, or punitive damages, or for loss of profits, data, or business arising
          from use of the service. Our total liability for any claim is limited to the fees you paid in the
          twelve months before the claim.
        </p>
      </LegalSection>

      <LegalSection title="Changes to service">
        <p>
          We may modify features, pricing, or these terms. Material changes will be posted on this page.
          Continued use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="Contact information">
        <p>
          Questions about these terms:{' '}
          <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
            {SEO_SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
