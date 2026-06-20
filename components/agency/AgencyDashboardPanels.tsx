'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AgencyInsightItem } from '@/lib/agency/agencyInsights';

export default function AgencyInsightsPanel({ insights }: { insights: AgencyInsightItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className={`rounded-lg border p-4 ${
            insight.tone === 'good'
              ? 'border-green-800/30 bg-green-950/20'
              : insight.tone === 'warn'
                ? 'border-orange-800/30 bg-orange-950/20'
                : 'border-gray-800 bg-gray-950/30'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              insight.tone === 'good'
                ? 'text-green-300'
                : insight.tone === 'warn'
                  ? 'text-orange-300'
                  : 'text-gray-300'
            }`}
          >
            {insight.message}
          </p>
          {insight.detail && <p className="mt-1 text-xs text-gray-500">{insight.detail}</p>}
        </div>
      ))}
    </div>
  );
}

export interface AgencyReportRow {
  scanId: string;
  clientName: string;
  websiteName: string;
  siteUrl: string;
  score: number | null;
  completedAt: string | null;
  isHistorical: boolean;
}

export function AgencyReportsReadyList({ reports }: { reports: AgencyReportRow[] }) {
  const ready = reports.filter((r) => !r.isHistorical && r.score !== null);

  if (ready.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Reports appear after scans are completed.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {ready.slice(0, 6).map((report) => (
        <li
          key={report.scanId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/30 p-4"
        >
          <div className="min-w-0">
            <p className="font-medium text-white">{report.clientName}</p>
            <p className="text-xs text-gray-500">
              {report.websiteName} · {report.score}/100
            </p>
          </div>
          <Link
            href={`/report/${report.scanId}`}
            className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/10"
          >
            Export / view
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface AgencyAlertGroup {
  websiteId: string;
  clientName: string;
  websiteName: string;
  alerts: Array<{
    id: string;
    title: string;
    message: string | null;
    severity: string;
    createdAt: string;
  }>;
}

export function AgencyAlertsGroupedView({ groups }: { groups: AgencyAlertGroup[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No client alerts right now. CyberShield will surface SSL, domain, uptime, security, and change events here.
      </p>
    );
  }

  async function copyClientNote(alert: AgencyAlertGroup['alerts'][0], clientName: string) {
    const note = [
      `Update for ${clientName}:`,
      alert.title,
      alert.message ?? 'Our monitoring detected a change worth reviewing.',
      '',
      'This is a preventive check — not a confirmed security incident.',
    ].join('\n');
    await navigator.clipboard.writeText(note);
    setCopiedId(alert.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.websiteId} className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <h3 className="font-semibold text-white">{group.clientName}</h3>
          <p className="text-xs text-gray-500">{group.websiteName}</p>
          <ul className="mt-4 space-y-4">
            {group.alerts.map((alert) => (
              <li key={alert.id} className="border-t border-gray-800 pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      alert.severity === 'critical'
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{alert.title}</p>
                <p className="mt-1 text-xs text-gray-400">{alert.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyClientNote(alert, group.clientName)}
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
                  >
                    {copiedId === alert.id ? 'Copied' : 'Copy client note'}
                  </button>
                  <Link
                    href="/app/alerts"
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Mark reviewed
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function AgencyUpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="rounded-xl border border-indigo-700/40 bg-indigo-950/30 p-6 text-center">
      <p className="text-sm font-medium text-indigo-200">Agency feature</p>
      <p className="mt-2 text-sm text-gray-400">
        {feature} is available on the Agency plan ($299/mo).
      </p>
      <Link
        href="/app/settings?upgrade=agency"
        className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        View upgrade options
      </Link>
    </div>
  );
}
