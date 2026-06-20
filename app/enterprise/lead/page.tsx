import type { Metadata } from 'next';
import { Suspense } from 'react';
import EnterpriseLeadForm from './EnterpriseLeadForm';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Enterprise Security Review — CyberShield Cloud',
  description: 'Submit your domain for enterprise security review and analysis.',
  path: '/enterprise/lead',
  noIndex: true,
});

export default function EnterpriseLeadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1e]" />}>
      <EnterpriseLeadForm />
    </Suspense>
  );
}
