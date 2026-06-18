'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  formatTimelineTimestamp,
  severityBadgeClass,
  type ChangeTimelineItem,
  type ChangeTimelinePeriod,
} from '@/lib/scanChanges/changeTimeline';

interface WebsiteChangeTimelineProps {
  websiteId: string;
  websiteLabel: string;
  websiteUrl: string;
  period: ChangeTimelinePeriod;
  changes: ChangeTimelineItem[];
}

function PeriodTabs({
  websiteId,
  active,
}: {
  websiteId: string;
  active: ChangeTimelinePeriod;
}) {
  const tabs: { key: ChangeTimelinePeriod; label: string }[] = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/app/websites/${websiteId}/changes?period=${tab.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? 'bg-blue-600 text-white'
                : 'border border-gray-700 bg-gray-900/60 text-gray-400 hover:border-gray-600 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function ChangeCard({ item }: { item: ChangeTimelineItem }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${severityBadgeClass(item.severity)}`}
            >
              {item.severity}
            </span>
            <span className="text-xs font-medium text-blue-400/90">{item.category}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-white">{item.summary}</p>
          <p className="mt-1 text-xs text-gray-500">{formatTimelineTimestamp(item.detectedAt)}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 self-start rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600 hover:bg-gray-800/60"
        >
          {open ? 'Hide details' : 'View details'}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-gray-800 pt-4 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-950/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Before</p>
            <p className="mt-1 break-words text-sm text-gray-300">{item.before}</p>
          </div>
          <div className="rounded-lg bg-gray-950/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">After</p>
            <p className="mt-1 break-words text-sm text-gray-300">{item.after}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export default function WebsiteChangeTimeline({
  websiteId,
  websiteLabel,
  websiteUrl,
  period,
  changes,
}: WebsiteChangeTimelineProps) {
  const periodLabel = period === 'day' ? '24 hours' : period === 'week' ? '7 days' : '30 days';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/app/websites"
          className="text-sm text-gray-500 transition-colors hover:text-gray-300"
        >
          ← Back to websites
        </Link>
        <h2 className="mt-3 text-xl font-bold text-white">Website Change Timeline</h2>
        <p className="mt-1 text-sm text-gray-400">
          {websiteLabel}
          <span className="mx-2 text-gray-600">·</span>
          <span className="text-gray-500">{websiteUrl}</span>
        </p>
        <p className="mt-2 text-sm text-gray-500">
          CyberShield compares each scan to the last one and records what changed on your site.
        </p>
      </div>

      <PeriodTabs websiteId={websiteId} active={period} />

      {changes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/20 px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-300">No changes in the last {periodLabel}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            That&apos;s good news — or monitoring may still be collecting baseline data. Keep
            monitoring enabled and we&apos;ll log the next meaningful change here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {changes.length} change{changes.length === 1 ? '' : 's'} detected
          </p>
          {changes.map((item) => (
            <ChangeCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
