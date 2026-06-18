'use client';

import type { AutomationHealthSummary } from '@/lib/owner/automationHealth';

const STATUS_STYLES = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  broken: 'text-red-400 bg-red-500/10 border-red-500/30',
};

export default function AutomationHealthSection({ health }: { health: AutomationHealthSummary }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Automation health
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Discovery, scans, email, follow-ups, Stripe, Supabase
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[health.overall]}`}
        >
          {health.overall}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {health.checks.map((check) => (
          <li
            key={check.id}
            className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-white">{check.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{check.detail}</p>
                {check.fixRecommendation && (
                  <p className="mt-2 text-xs text-amber-200/90">Fix: {check.fixRecommendation}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${STATUS_STYLES[check.status]}`}
              >
                {check.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
