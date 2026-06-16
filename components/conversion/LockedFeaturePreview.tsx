'use client';

interface LockedFeaturePreviewProps {
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  ctaHref?: string;
  previewLines?: string[];
  badge?: string;
}

export default function LockedFeaturePreview({
  title,
  description,
  ctaLabel = 'Enable protection',
  onCtaClick,
  previewLines = ['Hidden risk detected', 'Additional vulnerability detail', 'Remediation steps locked'],
  badge = 'Not enabled on Free plan',
}: LockedFeaturePreviewProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-700/50">
      <div className="space-y-2 p-4 blur-sm select-none" aria-hidden="true">
        {previewLines.slice(0, 4).map((line, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-gray-500">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
            {line}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 px-4 py-6">
        <span className="mb-2 rounded-full border border-gray-600 bg-gray-800/80 px-2.5 py-0.5 text-xs font-medium text-gray-400">
          {badge}
        </span>
        <p className="text-center text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 max-w-sm text-center text-xs text-gray-400">{description}</p>
        {onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className="mt-4 w-full max-w-xs rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
