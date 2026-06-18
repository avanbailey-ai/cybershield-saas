'use client';

import { SectionCard } from './MetricCard';
import type { MarketingInsight } from '@/lib/owner/generators/insights';

const PRIORITY_STYLES = {
  high: 'border-red-500/30 bg-red-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-gray-700 bg-gray-950/50',
};

export default function MarketingInsights({
  insights,
  embedded,
}: {
  insights: MarketingInsight[];
  embedded?: boolean;
}) {
  const inner = (
    <>
      {insights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-400">Not enough data yet.</p>
          <p className="mt-1 text-xs text-gray-600">
            Insights appear when platform signups, scans, and CRM data reach minimum sample sizes.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`rounded-xl border p-4 ${PRIORITY_STYLES[insight.priority]}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] uppercase text-gray-400">
                  {insight.category}
                </span>
                <span
                  className={`text-[10px] uppercase ${
                    insight.priority === 'high'
                      ? 'text-red-400'
                      : insight.priority === 'medium'
                        ? 'text-amber-400'
                        : 'text-gray-500'
                  }`}
                >
                  {insight.priority}
                </span>
              </div>
              <h3 className="font-medium text-white">{insight.title}</h3>
              <p className="mt-1 text-sm text-gray-400">{insight.body}</p>
              <p className="mt-2 rounded-lg bg-violet-500/10 px-2 py-1.5 text-xs text-violet-300">
                → {insight.recommendation}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return <div id="insights">{inner}</div>;

  return (
    <SectionCard id="insights" title="Recommendations" subtitle="From real platform data">
      {inner}
    </SectionCard>
  );
}
