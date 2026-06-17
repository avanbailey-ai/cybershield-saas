'use client';

import { useState } from 'react';

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}

export function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  children,
  badge,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {badge && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{badge}</span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <span className="text-xs text-gray-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="border-t border-gray-800 px-6 pb-6 pt-4">{children}</div>}
    </div>
  );
}

interface IntelligenceSignalsClientProps {
  signals: Array<{
    id: string;
    typeLabel: string;
    severity: string;
    title: string;
    detail: string;
    relatedCount: number;
    latestAt: string;
  }>;
  total: number;
  hasMore: boolean;
}

export function IntelligenceSignalsClient({
  signals,
  total,
  hasMore,
}: IntelligenceSignalsClientProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? signals : signals.slice(0, 5);

  if (signals.length === 0) {
    return (
      <p className="text-sm text-gray-500">No new intelligence signals in the last 24 hours.</p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {visible.map((signal) => (
          <li
            key={signal.id}
            className="rounded-lg border border-gray-800 bg-gray-950/40 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {signal.typeLabel}
                </p>
                <p className="mt-1 text-sm font-medium text-gray-100">{signal.title}</p>
                <p className="mt-1 text-xs text-gray-400">{signal.detail}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {new Date(signal.latestAt).toLocaleString()}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  signal.severity === 'critical'
                    ? 'bg-red-500/15 text-red-400'
                    : signal.severity === 'high'
                      ? 'bg-orange-500/15 text-orange-400'
                      : signal.severity === 'medium'
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : 'bg-gray-800 text-gray-400'
                }`}
              >
                {signal.severity}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
        >
          View all intelligence signals ({total})
        </button>
      )}
    </div>
  );
}

interface LowerPriorityAlertsProps {
  alerts: Array<{
    id: string;
    title: string;
    siteLabel: string;
    severity: string;
    createdAt: string;
  }>;
}

export function LowerPriorityAlerts({ alerts }: LowerPriorityAlertsProps) {
  const [open, setOpen] = useState(false);

  if (alerts.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-gray-400 hover:text-gray-300"
      >
        {open ? 'Hide' : 'View'} lower priority findings ({alerts.length})
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-lg bg-gray-800/30 px-3 py-2 text-sm text-gray-400">
              <span className="capitalize text-gray-500">{alert.severity}</span>
              {' · '}
              {alert.siteLabel}: {alert.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
