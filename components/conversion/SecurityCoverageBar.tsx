'use client';

interface SecurityCoverageBarProps {
  percent: number;
  className?: string;
}

export default function SecurityCoverageBar({ percent, className = '' }: SecurityCoverageBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-400">Security coverage unlocked</span>
        <span className="font-semibold tabular-nums text-blue-400">{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {clamped < 100 && (
        <p className="mt-1.5 text-xs text-gray-500">
          Enable protection to unlock the remaining {100 - clamped}% of your security report
        </p>
      )}
    </div>
  );
}
