'use client';

import type { EmailHealthSummary } from '@/lib/owner/emailHealth';

const STATUS_STYLE = {
  healthy: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  critical: 'border-red-500/30 bg-red-500/5 text-red-300',
};

export default function EmailHealthSection({ health }: { health: EmailHealthSummary }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Email health
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Sending domain: {health.sendingDomain} · DNS · deliverability · Resend
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase ${STATUS_STYLE[health.overall]}`}
        >
          {health.overall}
        </span>
      </div>
      <ul className="mt-5 space-y-3">
        {health.checks.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border px-4 py-3 ${STATUS_STYLE[c.status]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{c.label}</p>
              <span className="text-[10px] uppercase tracking-wider opacity-80">{c.status}</span>
            </div>
            <p className="mt-1 text-xs opacity-90">{c.detail}</p>
            {c.fixRecommendation && (
              <p className="mt-2 text-xs text-violet-200">Fix: {c.fixRecommendation}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
