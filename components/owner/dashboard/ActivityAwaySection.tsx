'use client';

import ActivityFeed from '../ActivityFeed';
import type { ActivityFeedSummary } from '@/lib/owner/activityFeed';

export default function ActivityAwaySection({ feed }: { feed: ActivityFeedSummary }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
        What happened while you were away
      </h2>
      <p className="mt-1 text-xs text-gray-600">
        Real execution events — discovery, scans, outreach, signups, risks (last 24h)
      </p>
      <div className="mt-4">
        <ActivityFeed events={feed.events} />
      </div>
    </section>
  );
}
