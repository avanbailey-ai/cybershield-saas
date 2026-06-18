'use client';

import type { ActivityFeedEvent } from '@/lib/owner/activityFeed';

const EVENT_STYLES: Partial<
  Record<ActivityFeedEvent['type'], { border: string; dot: string; label: string }>
> = {
  email_sent: { border: 'border-emerald-500/30', dot: 'bg-emerald-400', label: 'Sent' },
  email_approved: { border: 'border-violet-500/30', dot: 'bg-violet-400', label: 'Approved' },
  outreach_draft: { border: 'border-violet-500/20', dot: 'bg-violet-400', label: 'Draft' },
  follow_up_due: { border: 'border-amber-500/30', dot: 'bg-amber-400', label: 'Follow-up' },
  contact_found: { border: 'border-cyan-500/30', dot: 'bg-cyan-400', label: 'Contact' },
  discovery: { border: 'border-blue-500/20', dot: 'bg-blue-400', label: 'Discovery' },
  scan: { border: 'border-white/10', dot: 'bg-gray-400', label: 'Scan' },
  signup: { border: 'border-emerald-500/20', dot: 'bg-emerald-300', label: 'Signup' },
};

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
      {events.map((e) => {
        const style = EVENT_STYLES[e.type] ?? {
          border: 'border-white/[0.06]',
          dot: 'bg-gray-500',
          label: 'Event',
        };
        return (
          <li
            key={e.id}
            className={`flex items-start gap-3 rounded-lg border ${style.border} ${
              compact ? 'px-3 py-2' : 'px-4 py-3'
            } bg-black/20`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
            <span className="shrink-0 text-xs tabular-nums text-gray-500">{e.timeLabel}</span>
            <div className="min-w-0 flex-1">
              <p className={`${compact ? 'text-sm' : 'text-sm font-medium'} text-white`}>
                {e.label}
              </p>
              {e.detail && <p className="mt-0.5 text-xs text-gray-500">{e.detail}</p>}
            </div>
            {!compact && (
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-gray-600">
                {style.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
