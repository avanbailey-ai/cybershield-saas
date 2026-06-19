import type { Metadata } from 'next';

import { Suspense } from 'react';

import EnterpriseReviewForm from './EnterpriseReviewForm';



export const metadata: Metadata = {

  title: 'Enterprise Security Review — CyberShield Enterprise',

  description:

    'Request an enterprise security review for regulated teams, SSO/audit-log requirements, custom SLA needs, or complex multi-site environments.',

};



export default function EnterpriseReviewPage() {

  return (

    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1e]" />}>

      <EnterpriseReviewForm />

    </Suspense>

  );

}


