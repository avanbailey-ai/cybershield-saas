import type { Metadata } from 'next';
import { Suspense } from 'react';
import EnterpriseDemoForm from './EnterpriseDemoForm';

export const metadata: Metadata = {
  title: 'Book a Security Demo',
  description: 'Schedule a 30-minute CyberShield enterprise security demo with our team.',
};

export default function EnterpriseDemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1e]" />}>
      <EnterpriseDemoForm />
    </Suspense>
  );
}
