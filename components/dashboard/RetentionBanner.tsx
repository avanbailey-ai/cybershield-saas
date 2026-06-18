interface RetentionBannerProps {
  variant?: 'monitoring' | 'protection' | 'memory';
  detail?: string;
}

export default function RetentionBanner({
  variant = 'monitoring',
  detail,
}: RetentionBannerProps) {
  const title =
    variant === 'protection'
      ? 'CyberShield Protection Active'
      : variant === 'memory'
        ? 'Your website memory is active'
        : 'CyberShield Monitoring Active';

  const subtitle =
    detail ??
    (variant === 'protection'
      ? 'Your websites are protected with continuous monitoring and alerts.'
      : variant === 'memory'
        ? 'SSL, uptime, security posture, and changes are tracked continuously — so you always have context when something shifts.'
        : 'Your websites are being checked automatically. We will alert you if anything changes.');

  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 sm:px-5">
      <p className="text-sm font-medium text-green-300">{title}</p>
      <p className="mt-1 text-xs text-green-400/80">{subtitle}</p>
    </div>
  );
}
