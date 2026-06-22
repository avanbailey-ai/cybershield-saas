'use client';

import type { MetricValue } from '@/lib/owner/founderCommandCenterTypes';

export function FounderMetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c1220] p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function FounderEmptyMetric({ metric }: { metric: MetricValue }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0f18] p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{metric.label}</p>
      <p className="mt-2 text-sm font-medium text-gray-400">No data yet</p>
      {metric.emptyReason && <p className="mt-2 text-xs text-gray-500">{metric.emptyReason}</p>}
      {metric.emptySource && (
        <p className="mt-1 text-xs text-gray-600">
          Source: <span className="text-gray-500">{metric.emptySource}</span>
        </p>
      )}
      {metric.emptyAction && (
        <p className="mt-2 text-xs text-violet-400/90">Next: {metric.emptyAction}</p>
      )}
    </div>
  );
}

export function FounderMetricOrEmpty({ metric }: { metric: MetricValue }) {
  if (!metric.available || metric.value == null) {
    return <FounderEmptyMetric metric={metric} />;
  }
  return <FounderMetricCard label={metric.label} value={metric.value} />;
}

export function FounderSectionHeader({
  title,
  subtitle,
  updatedAt,
}: {
  title: string;
  subtitle?: string;
  updatedAt?: string;
}) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-gray-500">{subtitle}</p>}
      {updatedAt && (
        <p className="mt-2 text-xs text-gray-600">
          Last updated {new Date(updatedAt).toLocaleString()}
        </p>
      )}
    </header>
  );
}

export function FounderPanel({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-6 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">{title}</h2>}
      {children}
    </section>
  );
}
