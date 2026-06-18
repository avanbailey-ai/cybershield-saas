import {
  VALUE_SUMMARY_COPY,
  type ValueSummaryMetrics,
} from '@/lib/dashboard/dashboardCommandCenter';

interface CyberShieldValueSummaryProps {
  metrics: ValueSummaryMetrics;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

function MetricCell({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/30 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500">{suffix}</span>}
      </p>
    </div>
  );
}

export default function CyberShieldValueSummary({
  metrics,
  title = VALUE_SUMMARY_COPY.title,
  subtitle = VALUE_SUMMARY_COPY.subtitle,
  compact = false,
}: CyberShieldValueSummaryProps) {
  if (metrics.websitesMonitored === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      <div
        className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}
      >
        <MetricCell label="Security checks" value={metrics.checksCompleted} />
        <MetricCell label="Changes detected" value={metrics.changesDetected} />
        <MetricCell label="SSL / domain issues" value={metrics.sslDomainIssues} />
        <MetricCell label="Downtime events" value={metrics.downtimeEvents} />
        <MetricCell
          label="Sites online"
          value={metrics.sitesAllOnline}
          suffix={` / ${metrics.websitesMonitored}`}
        />
      </div>
    </section>
  );
}
