import type { Metadata } from 'next';

import { Suspense } from 'react';

import EnterpriseReviewForm from './EnterpriseReviewForm';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Request a Security Review — CyberShield Cloud',
  description:
    'Request a custom website security review for agencies, larger organizations, and compliance-focused teams.',
  path: '/enterprise/review',
});

export default function EnterpriseReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1e]" />}>
      <EnterpriseReviewForm />
    </Suspense>
  );
}
