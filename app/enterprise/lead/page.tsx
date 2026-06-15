import type { Metadata } from 'next';
import { Suspense } from 'react';
import EnterpriseLeadForm from './EnterpriseLeadForm';

export const metadata: Metadata = {
  title: 'Contact Enterprise Sales',
  description: 'Talk to the CyberShield security team about enterprise monitoring, compliance, and custom deployments.',
};

export default function EnterpriseLeadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1e]" />}>
      <EnterpriseLeadForm />
    </Suspense>
  );
}
