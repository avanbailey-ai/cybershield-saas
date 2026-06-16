'use client';

import ReportProblemWidget from '@/components/beta/ReportProblemWidget';

interface ReportProblemOnReportProps {
  reportId: string;
  websiteId?: string;
  userEmail?: string | null;
}

export default function ReportProblemOnReport({
  reportId,
  websiteId,
  userEmail,
}: ReportProblemOnReportProps) {
  return (
    <ReportProblemWidget
      userEmail={userEmail}
      context={{ reportId, websiteId, scanId: reportId }}
    />
  );
}
