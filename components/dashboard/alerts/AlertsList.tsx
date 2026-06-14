"use client";

import { useState } from "react";

export interface AlertRow {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
  is_read: boolean;
  created_at: string;
  website_id: string | null;
  scan_id: string | null;
  websites: { url: string; label: string | null } | { url: string; label: string | null }[] | null;
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-500/10 text-red-400 border border-red-500/20";
    case "high":     return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
    case "medium":   return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
    default:         return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AlertsList({ initialAlerts }: { initialAlerts: AlertRow[] }) {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function markAsRead(id: string) {
    setMarkingId(id);
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
        );
      }
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllAsRead() {
    const unread = alerts.filter((a) => !a.is_read);
    for (const alert of unread) {
      await markAsRead(alert.id);
    }
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-500">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-300">No alerts</p>
        <p className="mt-1 text-xs text-gray-500">
          Alerts are created automatically when scans detect security issues.
        </p>
      </div>
    );
  }

  return (
    <div>
      {unreadCount > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">{unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}</span>
          <button
            onClick={markAllAsRead}
            className="text-xs text-blue-400 underline hover:text-blue-300"
          >
            Mark all as read
          </button>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-xl border p-5 transition-colors ${
              alert.is_read
                ? "border-gray-800 bg-gray-900/20"
                : "border-gray-700 bg-gray-900/60"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${severityBadgeClass(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  {!alert.is_read && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400 border border-blue-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      New
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{timeAgo(alert.created_at)}</span>
                </div>
                <h3 className={`mt-2 text-sm font-semibold ${alert.is_read ? "text-gray-400" : "text-white"}`}>
                  {alert.title}
                </h3>
                <p className="mt-1 text-xs text-gray-500">{alert.message}</p>
                {alert.websites && (() => {
                  const site = Array.isArray(alert.websites) ? alert.websites[0] : alert.websites;
                  return site ? (
                    <p className="mt-2 text-xs text-gray-600">
                      {site.label ?? site.url}
                    </p>
                  ) : null;
                })()}
              </div>

              {!alert.is_read && (
                <button
                  onClick={() => markAsRead(alert.id)}
                  disabled={markingId === alert.id}
                  className="flex-shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-60"
                >
                  {markingId === alert.id ? "…" : "Mark read"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
