import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_BRAND, SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'About CyberShield Cloud — Website Security Monitoring',
  description:
    'CyberShield Cloud helps businesses and agencies scan, monitor, and report website security issues.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <LegalPageLayout title={`About ${SEO_BRAND}`}>
      <p>
        {SEO_BRAND} helps businesses monitor website security continuously — not just with one-time
        scans. We focus on SSL monitoring, security headers, change detection, health scores, and
        actionable alerts teams can understand without a dedicated security department.
      </p>
      <p>
        Our product is built for owners, operators, and agencies who need to know when a website
        becomes risky or unavailable before customers notice.
      </p>
      <h2 className="text-xl font-semibold text-white">What we monitor</h2>
      <ul className="list-inside list-disc space-y-2 text-gray-300">
        <li>Website security scores and risk signals</li>
        <li>SSL/TLS certificates and HTTPS configuration</li>
        <li>Security headers and common misconfigurations</li>
        <li>Website changes, including scripts and header removals</li>
        <li>Domain and availability signals alongside security posture</li>
      </ul>
      <h2 className="text-xl font-semibold text-white">Contact</h2>
      <p>
        Questions or partnership inquiries:{' '}
        <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
          {SEO_SUPPORT_EMAIL}
        </a>
      </p>
    </LegalPageLayout>
  );
}
