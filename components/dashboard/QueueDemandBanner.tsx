'use client';

interface QueueDemandBannerProps {
  show: boolean;
  onDismiss?: () => void;
}

export default function QueueDemandBanner({ show, onDismiss }: QueueDemandBannerProps) {
  if (!show) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div className="flex-1">
        <p className="font-medium">High demand — scans may take longer</p>
        <p className="mt-0.5 text-xs text-amber-400/80">
          Upgrade to Pro+ for priority processing and faster scan throughput.
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs text-amber-400 underline hover:text-amber-300"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
