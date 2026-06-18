import { COMMAND_CENTER_COPY } from '@/lib/dashboard/dashboardCommandCenter';

interface RetentionBannerProps {
  variant?: 'monitoring' | 'protection';
  detail?: string;
}

export default function RetentionBanner({
  variant = 'monitoring',
  detail,
}: RetentionBannerProps) {
  const title =
    variant === 'protection'
      ? 'CyberShield Protection Active'
      : COMMAND_CENTER_COPY.monitoringActive;

  const subtitle =
    detail ??
    (variant === 'protection'
      ? 'Your websites are protected with continuous monitoring and alerts.'
      : COMMAND_CENTER_COPY.monitoringActiveDetail);

  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 sm:px-5">
      <p className="text-sm font-medium text-green-300">{title}</p>
      <p className="mt-1 text-xs text-green-400/80">{subtitle}</p>
    </div>
  );
}
