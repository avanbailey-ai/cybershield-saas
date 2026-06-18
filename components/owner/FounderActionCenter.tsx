'use client';

import type { FounderAction } from '@/lib/owner/founderActions';

const IMPACT_STYLES = {
  critical: 'border-red-500/40 bg-gradient-to-br from-red-500/10 to-violet-500/5',
  high: 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-violet-500/5',
  medium: 'border-violet-500/20 bg-violet-500/5',
};

export default function FounderActionCenter({ actions }: { actions: FounderAction[] }) {
  function scrollToModule(moduleId: string) {
    document.getElementById(moduleId)?.scrollIntoView({ behavior: 'smooth' });
  }

  if (actions.length === 0) {
    return (
      <div
        id="action-center"
        className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/10 to-fuchsia-600/5 p-6"
      >
        <h2 className="text-lg font-bold text-white">Founder Action Center</h2>
        <p className="mt-2 text-sm text-gray-400">
          No priority actions yet. Run prospect discovery to unlock ranked recommendations.
        </p>
        <button
          type="button"
          onClick={() => scrollToModule('prospects')}
          className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Run discovery
        </button>
      </div>
    );
  }

  return (
    <div
      id="action-center"
      className="rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-600/15 via-gray-900/80 to-fuchsia-600/10 p-6 shadow-lg shadow-violet-500/5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Founder Action Center
          </p>
          <h2 className="text-xl font-bold text-white">Top 3 things to do today</h2>
        </div>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
          Ranked by impact
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {actions.map((action) => (
          <div
            key={action.id}
            className={`rounded-xl border p-4 ${IMPACT_STYLES[action.impact]}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                {action.rank}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                {action.impact}
              </span>
            </div>
            <h3 className="font-semibold text-white">{action.title}</h3>
            <p className="mt-1 text-sm text-gray-400">{action.description}</p>
            <button
              type="button"
              onClick={() => scrollToModule(action.module)}
              className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300"
            >
              {action.cta} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
