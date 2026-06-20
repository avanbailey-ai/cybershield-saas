import type { Metadata } from 'next';
import { Suspense } from 'react';
import EnterpriseDemoForm from './EnterpriseDemoForm';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Book a Security Demo — CyberShield Cloud',
  description: 'Schedule a CyberShield enterprise security demo with our team.',
  path: '/enterprise/demo',
  noIndex: true,
});

export default function EnterpriseDemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1e]" />}>
      <EnterpriseDemoForm />
    </Suspense>
  );
}
