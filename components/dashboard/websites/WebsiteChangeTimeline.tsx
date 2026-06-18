'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  formatTimelineTimestamp,
  groupedSeverityBadgeClass,
  TIMELINE_FILTERS,
  type ChangeTimelineItem,
  type ChangeTimelinePeriod,
  type GroupedTimelineEvent,
  type TimelineFilter,
} from '@/lib/scanChanges/changeTimeline';
import { filterTimelineEvents, normalizeScriptUrl } from '@/lib/scanChanges/transformTimelineEvents';

interface WebsiteChangeTimelineProps {
  websiteId: string;
  websiteLabel: string;
  websiteUrl: string;
  period: ChangeTimelinePeriod;
  events: GroupedTimelineEvent[];
  rawChangeCount: number;
  initialFilter?: TimelineFilter;
}

function PeriodTabs({
  websiteId,
  active,
  filter,
}: {
  websiteId: string;
  active: ChangeTimelinePeriod;
  filter: TimelineFilter;
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
            href={`/app/websites/${websiteId}/changes?period=${tab.key}&filter=${filter}`}
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

function FilterTabs({
  websiteId,
  period,
  active,
}: {
  websiteId: string;
  period: ChangeTimelinePeriod;
  active: TimelineFilter;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIMELINE_FILTERS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/app/websites/${websiteId}/changes?period=${period}&filter=${tab.key}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? 'border border-blue-500/40 bg-blue-500/10 text-blue-300'
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

function normalizedValueForItem(item: ChangeTimelineItem, websiteUrl: string): string | null {
  if (item.type !== 'script_added' && item.type !== 'script_removed') return null;
  const match = item.summary.match(/Script (?:added|removed): (.+)$/i);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  return normalizeScriptUrl(raw, websiteUrl).normalizedKey;
}

function TechnicalDetailRow({
  item,
  websiteUrl,
  emphasize,
}: {
  item: ChangeTimelineItem;
  websiteUrl: string;
  emphasize?: boolean;
}) {
  const normalized = normalizedValueForItem(item, websiteUrl);
  return (
    <div
      className={`rounded-lg p-3 ${emphasize ? 'border border-gray-700 bg-gray-950/90' : 'bg-gray-950/80'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.type}</span>
        <span className="text-xs text-blue-400/80">{item.category}</span>
        <span
          className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${groupedSeverityBadgeClass(item.severity as 'low' | 'medium' | 'high' | 'critical')}`}
        >
          {item.severity}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-300">{item.summary}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Before</p>
          <p className="mt-0.5 break-words text-xs text-gray-400">{item.before}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">After</p>
          <p className="mt-0.5 break-words text-xs text-gray-400">{item.after}</p>
        </div>
      </div>
      {normalized && (
        <p className="mt-2 text-[10px] text-gray-600">
          Normalized key: <span className="text-gray-500">{normalized}</span>
        </p>
      )}
      <p className="mt-1 text-[10px] text-gray-600">
        Detected · {formatTimelineTimestamp(item.detectedAt)}
      </p>
    </div>
  );
}

function GroupedEventCard({
  event,
  websiteUrl,
  defaultExpanded,
}: {
  event: GroupedTimelineEvent;
  websiteUrl: string;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded ?? false);

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${groupedSeverityBadgeClass(event.severity)}`}
            >
              {event.severity}
            </span>
            <span className="text-xs font-medium text-blue-400/90">{event.categoryLabel}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">{event.title}</h3>
          <p className="mt-1 text-sm text-gray-300">{event.summary}</p>
          {event.alsoDetected && (
            <p className="mt-1 text-xs text-gray-500">{event.alsoDetected}</p>
          )}
          {event.affectedAreas.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Affected: {event.affectedAreas.join(', ')}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">{formatTimelineTimestamp(event.detectedAt)}</p>
          <p className="mt-3 text-xs text-gray-400">{event.recommendation}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 self-start rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600 hover:bg-gray-800/60"
        >
          {open ? 'Hide technical details' : 'View technical details'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-2 border-t border-gray-800 pt-4">
          {event.technicalDetails.map((item) => (
            <TechnicalDetailRow
              key={item.id}
              item={item}
              websiteUrl={websiteUrl}
              emphasize={defaultExpanded}
            />
          ))}
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
  events,
  rawChangeCount,
  initialFilter = 'important',
}: WebsiteChangeTimelineProps) {
  const periodLabel = period === 'day' ? '24 hours' : period === 'week' ? '7 days' : '30 days';
  const filteredEvents = useMemo(
    () => filterTimelineEvents(events, initialFilter),
    [events, initialFilter],
  );

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
          CyberShield groups related scan changes into clear events so you can focus on what
          matters.
        </p>
      </div>

      <PeriodTabs websiteId={websiteId} active={period} filter={initialFilter} />
      <FilterTabs websiteId={websiteId} period={period} active={initialFilter} />

      {filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/20 px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-300">
            No {initialFilter === 'important' ? 'important ' : ''}events in the last {periodLabel}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            {events.length > 0 && initialFilter === 'important'
              ? 'Routine asset updates are hidden in Important only view. Switch to All activity to see everything.'
              : "That's good news — or monitoring may still be collecting baseline data."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
            {rawChangeCount > filteredEvents.length && (
              <span className="normal-case text-gray-600">
                {' '}
                · grouped from {rawChangeCount} raw change{rawChangeCount === 1 ? '' : 's'}
              </span>
            )}
          </p>
          {filteredEvents.map((event) => (
            <GroupedEventCard
              key={event.id}
              event={event}
              websiteUrl={websiteUrl}
              defaultExpanded={initialFilter === 'technical'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
