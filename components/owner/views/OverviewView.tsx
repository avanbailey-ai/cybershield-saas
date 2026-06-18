'use client';

import { useFounderNav } from '../FounderNavContext';
import type { FounderSectionId } from '@/lib/owner/founderNav';
import type { FounderBriefing } from '@/lib/owner/briefing';
import type { BusinessOverviewMetrics, TrendWindow } from '@/lib/owner/types';
import MetricCard from '../MetricCard';

interface Props {
  briefing: FounderBriefing;
  windows: Record<TrendWindow, BusinessOverviewMetrics>;
}

export default function OverviewView({ briefing, windows }: Props) {
  const { setSection } = useFounderNav();
  const m = windows['30d'];

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Today</h1>
        <p className="mt-2 text-gray-500">
          {new Date(briefing.generatedAt).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          Next actions
        </h2>
        {briefing.topActions.length === 0 ? (
          <p className="text-gray-500">Import prospects to see your first priorities.</p>
        ) : (
          <ol className="space-y-3">
            {briefing.topActions.map((action) => (
              <li
                key={action.id}
                className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-sm font-semibold text-violet-300">
                  {action.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{action.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{action.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSection(action.module as FounderSectionId)}
                  className="shrink-0 text-sm font-medium text-violet-400 hover:text-violet-300"
                >
                  {action.cta} →
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          At a glance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="New signups" value={briefing.newSignups} accent="text-blue-400" />
          <MetricCard label="HOT prospects" value={briefing.hotProspects} accent="text-red-400" />
          <MetricCard
            label="MRR"
            value={`$${briefing.revenueMrr.toLocaleString()}`}
            accent="text-emerald-400"
          />
          <MetricCard label="Recent wins" value={briefing.newCustomers} accent="text-violet-400" />
        </div>
      </section>

      {briefing.newCustomers > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
            Recent wins
          </h2>
          <p className="text-white">
            {briefing.newCustomers} new customer{briefing.newCustomers !== 1 ? 's' : ''} in the last
            24 hours
          </p>
        </section>
      )}

      {m.mrrGrowthPct !== 0 && (
        <p className="text-sm text-gray-600">
          30-day MRR trend: {m.mrrGrowthPct >= 0 ? '+' : ''}
          {m.mrrGrowthPct}%
        </p>
      )}
    </div>
  );
}
