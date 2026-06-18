'use client';

import type { ActivityFeedEvent } from '@/lib/owner/activityFeed';

export default function ActivityFeed({
  events,
  compact,
}: {
  events: ActivityFeedEvent[];
  compact?: boolean;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Quiet period — no automated activity in the last 24 hours.
      </p>
    );
  }

  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'}>
      {events.map((e) => (
        <li
          key={e.id}
          className={`flex items-start gap-3 rounded-lg border border-white/[0.06] ${
            compact ? 'px-3 py-2' : 'px-4 py-3'
          } bg-black/20`}
        >
          <span className="shrink-0 text-xs tabular-nums text-violet-400/80">{e.timeLabel}</span>
          <div className="min-w-0 flex-1">
            <p className={`${compact ? 'text-sm' : 'text-sm font-medium'} text-white`}>{e.label}</p>
            {e.detail && <p className="mt-0.5 text-xs text-gray-500">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
