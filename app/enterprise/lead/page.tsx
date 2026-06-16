import type { Metadata } from 'next';
import { Suspense } from 'react';
import EnterpriseLeadForm from './EnterpriseLeadForm';

export const metadata: Metadata = {
  title: 'Enterprise Security Review',
  description:
    'Escalate scan findings to the CyberShield security team for remediation planning, compliance alignment, and continuous coverage.',
};

export default function EnterpriseLeadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1e]" />}>
      <EnterpriseLeadForm />
    </Suspense>
  );
}
