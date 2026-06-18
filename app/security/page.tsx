import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_BRAND } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Security',
  description: `How ${SEO_BRAND} approaches platform security, data handling, and customer trust.`,
  path: '/security',
});

export default function SecurityPolicyPage() {
  return (
    <LegalPageLayout title="Security Policy">
      <p>
        {SEO_BRAND} is a website security monitoring platform. We treat customer website data,
        scan results, and account information as sensitive business data.
      </p>
      <h2 className="text-xl font-semibold text-white">Platform security practices</h2>
      <ul className="list-inside list-disc space-y-2">
        <li>HTTPS enforced for the application and public marketing site</li>
        <li>Authenticated access to dashboards and administrative functions</li>
        <li>Role-based access for organization and enterprise accounts</li>
        <li>Scan and alert processing designed for reliability and auditability</li>
      </ul>
      <h2 className="text-xl font-semibold text-white">Vulnerability reports</h2>
      <p>
        If you believe you have found a security issue in our platform, please see our{' '}
        <a href="/responsible-disclosure" className="text-blue-400 hover:text-blue-300">
          Responsible Disclosure
        </a>{' '}
        policy.
      </p>
    </LegalPageLayout>
  );
}
