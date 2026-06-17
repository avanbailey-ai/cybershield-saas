'use client';

import type { PartialAiPreviewContent } from '@/lib/conversion/partialAiPreview';

interface PartialAiInsightPreviewProps {
  content: PartialAiPreviewContent;
  className?: string;
}

export default function PartialAiInsightPreview({
  content,
  className = '',
}: PartialAiInsightPreviewProps) {
  return (
    <div
      className={`rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-blue-500/5 p-5 ${className}`}
      data-testid="partial-ai-preview"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-300">
          AI
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
          Security insight preview
        </p>
      </div>
      <ul className="space-y-2 text-sm text-gray-200">
        <li>{content.headline}</li>
        <li className="text-violet-100/90">{content.topConcern}</li>
        <li className="text-gray-300">{content.riskSummary}</li>
        <li className="text-gray-400">{content.unlockHint}</li>
      </ul>
    </div>
  );
}
