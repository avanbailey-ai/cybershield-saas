'use client';

import EnterpriseLeadForm from '@/app/enterprise/lead/EnterpriseLeadForm';

/**
 * Enterprise review funnel — wraps the shared lead form with scan-review framing.
 * Query params: domain, score, source=scan_review
 */
export default function EnterpriseReviewForm() {
  return <EnterpriseLeadForm variant="review" />;
}
