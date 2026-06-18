import Link from 'next/link';
import {
  COMMAND_CENTER_COPY,
  type ActivityFeedItem,
} from '@/lib/dashboard/dashboardCommandCenter';

function activityToneClass(tone: string): string {
  if (tone === 'good') return 'border-green-500/20 bg-green-500/5';
  if (tone === 'warn') return 'border-orange-500/20 bg-orange-500/5';
  if (tone === 'bad') return 'border-red-500/20 bg-red-500/5';
  return 'border-gray-800 bg-gray-800/40';
}

interface RecentActivityFeedProps {
  items: ActivityFeedItem[];
  title?: string;
  viewAllHref?: string;
  emptyMessage?: string;
}

export default function RecentActivityFeed({
  items,
  title = COMMAND_CENTER_COPY.recentActivityTitle,
  viewAllHref,
  emptyMessage = 'Activity will appear here after your first security check.',
}: RecentActivityFeedProps) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
      <div className="mb-4 flex flex-row items-center justify-between">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {viewAllHref && items.length > 0 && (
          <Link href={viewAllHref} className="text-xs text-blue-400 hover:text-blue-300">
            View all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg border px-4 py-3 ${activityToneClass(item.tone)}`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-gray-500">{item.timeLabel}</span>
                  {item.href && (
                    <Link href={item.href} className="text-xs text-blue-400 hover:text-blue-300">
                      Details →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
