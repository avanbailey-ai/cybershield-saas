import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import LegalSection from '@/components/legal/LegalSection';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy — CyberShield Cloud',
  description: 'How CyberShield Cloud collects, uses, and protects your data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p className="text-sm text-gray-500">Last updated: June 2026</p>

      <LegalSection title="Information collected">
        <p>
          We collect information you provide (account email, organization name, website URLs), data generated
          by scans and monitoring (findings, scores, change history), usage data, and support communications.
        </p>
      </LegalSection>

      <LegalSection title="Account information">
        <p>
          Account data is used to authenticate you, provide the dashboard, enforce plan limits, and deliver
          alerts to addresses you configure.
        </p>
      </LegalSection>

      <LegalSection title="Website scan data">
        <p>
          Scan and monitoring data is stored securely and scoped to your account or organization. We analyze
          publicly observable signals and stored baselines to detect changes and report findings.
        </p>
      </LegalSection>

      <LegalSection title="Payment data handled by Stripe">
        <p>
          Payment card and billing details are processed by Stripe. CyberShield does not store full payment
          card numbers on our servers. Stripe&apos;s privacy policy governs payment data handling.
        </p>
      </LegalSection>

      <LegalSection title="Email communications">
        <p>
          We send transactional emails (alerts, digests, account notices) and optional product messages.
          You can adjust notification preferences in your account where available.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and analytics">
        <p>
          We use cookies and similar technologies for authentication, session management, and product
          analytics to improve the service. You may control cookies through your browser settings.
        </p>
      </LegalSection>

      <LegalSection title="How data is used">
        <p>
          Data is used to operate monitoring, generate reports, improve detection quality, provide support,
          prevent abuse, and comply with legal obligations. We do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection title="Data sharing">
        <p>
          We share data with service providers (hosting, database, email, payments) who process it on our
          behalf under contractual safeguards. We may disclose information if required by law or to protect
          rights and safety.
        </p>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>
          We retain account and scan data while your account is active and as needed for backups, legal
          compliance, and dispute resolution. You may request account deletion by contacting support.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use industry-standard measures including HTTPS, access controls, and secure infrastructure
          providers. No system is perfectly secure; see our{' '}
          <a href="/security" className="text-blue-400 hover:text-blue-300">
            Security Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="User rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export personal
          data. Contact us to exercise these rights.
        </p>
      </LegalSection>

      <LegalSection title="Contact information">
        <p>
          Privacy questions:{' '}
          <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
            {SEO_SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
