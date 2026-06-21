import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import LegalSection from '@/components/legal/LegalSection';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_SUPPORT_EMAIL } from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Security Disclaimer — CyberShield Cloud',
  description:
    'Important limitations of CyberShield Cloud automated security monitoring and scanning.',
  path: '/security-disclaimer',
});

export default function SecurityDisclaimerPage() {
  return (
    <LegalPageLayout title="Security Disclaimer">
      <p className="text-sm text-gray-500">Last updated: June 2026</p>

      <LegalSection title="Automated checks and monitoring">
        <p>
          CyberShield provides automated checks and ongoing monitoring based on publicly observable signals
          and configured baselines. Results are intended to improve security visibility, not to certify
          security.
        </p>
      </LegalSection>

      <LegalSection title="No guarantee of security">
        <p>
          CyberShield does not guarantee that your website is secure, will remain secure, or cannot be
          hacked. Monitoring may not detect all vulnerabilities, misconfigurations, or active compromises.
        </p>
      </LegalSection>

      <LegalSection title="Not a substitute for professional review">
        <p>
          CyberShield does not replace a professional penetration test, SOC 2 audit, compliance audit, legal
          review, or managed security service provider (MSSP). Engage qualified professionals for formal
          assessments and regulated environments.
        </p>
      </LegalSection>

      <LegalSection title="Incomplete or inaccurate results">
        <p>
          Findings may be incomplete, outdated, or include false positives and false negatives. Always
          validate results in context before taking action.
        </p>
      </LegalSection>

      <LegalSection title="Your responsibility">
        <p>
          You are responsible for reviewing findings, prioritizing remediation, and implementing fixes on
          your systems. CyberShield provides guidance; implementation remains your responsibility.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this disclaimer:{' '}
          <a href={`mailto:${SEO_SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
            {SEO_SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
