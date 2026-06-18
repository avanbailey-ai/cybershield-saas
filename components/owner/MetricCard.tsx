'use client';

import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  accent?: string;
}

export default function MetricCard({ label, value, delta, accent = 'text-white' }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-gray-900/80 to-gray-950/80 p-5 backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
      {delta && <p className="mt-1 text-xs text-gray-500">{delta}</p>}
    </div>
  );
}

export function SectionCard({
  id,
  title,
  subtitle,
  children,
  action,
  bare,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  /** Omit card chrome when nested inside a tab view */
  bare?: boolean;
}) {
  if (bare) {
    return (
      <section id={id} className="scroll-mt-8">
        {(title || subtitle) && (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              {title && <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>}
              {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </section>
    );
  }

  return (
    <section id={id} className="scroll-mt-8 rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/80 p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
