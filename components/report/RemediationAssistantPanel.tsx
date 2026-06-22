'use client';

import { useMemo } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { enrichFinding } from '@/lib/findings';

interface RemediationAssistantPanelProps {
  finding: SecurityFinding;
}

export default function RemediationAssistantPanel({ finding }: RemediationAssistantPanelProps) {
  const enriched = useMemo(() => enrichFinding(finding), [finding]);

  if (enriched.remediationSteps.length === 0) return null;

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-400/90">
        Developer steps
      </h4>
      <ol className="space-y-2">
        {enriched.remediationSteps.map((step, index) => (
          <li key={step} className="flex gap-2 text-sm text-gray-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-bold text-blue-300">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
