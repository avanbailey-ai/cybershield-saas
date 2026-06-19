'use client';

import { useMemo, useState } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import { enrichFinding } from '@/lib/findings';
import { buildDeveloperEmailPayload, type FindingActionContext } from '@/lib/findings/findingActions';

interface FindingIntelligencePanelProps {
  finding: SecurityFinding;
  actionContext?: FindingActionContext;
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-xs font-medium text-gray-300 hover:border-blue-500/40 hover:text-white"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function FindingIntelligencePanel({
  finding,
  actionContext,
}: FindingIntelligencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const enriched = useMemo(() => enrichFinding(finding), [finding]);

  const devPayload =
    actionContext &&
    buildDeveloperEmailPayload(finding, actionContext, enriched);

  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
          Intelligence assistant
        </h4>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-violet-300 hover:text-violet-200"
        >
          {expanded ? 'Hide explanation' : 'Explain this finding'}
        </button>
      </div>

      <p className="mt-2 text-sm text-gray-300">{enriched.plainEnglish}</p>

      {expanded && (
        <div className="mt-4 space-y-3 text-sm text-gray-300">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Why this matters
            </p>
            <p className="mt-1">{enriched.businessImpact}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Recommended next step
            </p>
            <p className="mt-1">{enriched.recommendedNextStep}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-400">
            <span className="rounded-full border border-gray-700 px-2 py-0.5">
              Urgency: {enriched.urgency}
            </span>
            <span className="rounded-full border border-gray-700 px-2 py-0.5">
              Difficulty: {enriched.difficulty}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton label="Copy message for developer" text={enriched.developerMessage} />
        {devPayload && (
          <CopyButton label="Copy full developer email" text={devPayload.body} />
        )}
        <CopyButton
          label="Plain-English summary"
          text={[enriched.plainEnglish, enriched.businessImpact, enriched.ownerAction].join('\n\n')}
        />
      </div>
    </div>
  );
}
