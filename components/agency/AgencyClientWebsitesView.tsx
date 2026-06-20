'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PortfolioHealthSummary } from '@/lib/agency/agencyInsights';
import { getScoreBand } from '@/lib/dashboard/dashboardCommandCenter';
import AgencyClientEditModal from '@/components/agency/AgencyClientEditModal';

interface AgencyPortfolioHealthCardProps {
  summary: PortfolioHealthSummary;
}

export default function AgencyPortfolioHealthCard({ summary }: AgencyPortfolioHealthCardProps) {
  const band = getScoreBand(summary.averageScore);

  return (
    <article className="rounded-xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/30 to-gray-900/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Client Portfolio Health</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        {summary.averageScore !== null && (
          <div>
            <p className="text-xs text-gray-500">Average score</p>
            <p className={`text-3xl font-bold ${band.textClass}`}>
              {summary.averageScore}
              <span className="text-lg text-gray-500">/100</span>
            </p>
          </div>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total websites" value={String(summary.totalWebsites)} />
        <Stat label="Healthy" value={String(summary.healthy)} tone="text-green-400" />
        <Stat label="Needs attention" value={String(summary.needsAttention)} tone="text-orange-400" />
        <Stat label="Critical" value={String(summary.critical)} tone="text-red-400" />
      </dl>
    </article>
  );
}

function Stat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className={`mt-1 text-xl font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

export interface AgencyClientWebsiteRow {
  id: string;
  clientName: string;
  clientNameRaw?: string | null;
  clientCompany?: string | null;
  clientContactName?: string | null;
  clientContactEmail?: string | null;
  clientNotes?: string | null;
  clientReportFrequency?: string | null;
  agencyInternalNotes?: string | null;
  displayName: string;
  url: string;
  score: number | null;
  healthCategory: string;
  lastScanLabel: string;
  recentChangesCount: number;
  openFindings: number;
  reportStatus: 'ready' | 'pending' | 'none';
  topIssue: string | null;
  scanId: string | null;
  sslStatus: string;
  clientStatus: string;
}

type FilterKey =
  | 'all'
  | 'critical'
  | 'needs_attention'
  | 'healthy'
  | 'report_ready'
  | 'recent_changes'
  | 'ssl_issue';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All clients' },
  { key: 'critical', label: 'Critical' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'report_ready', label: 'Report ready' },
  { key: 'recent_changes', label: 'Recent changes' },
  { key: 'ssl_issue', label: 'SSL issue' },
];

export function AgencyClientWebsitesTable({ rows: initialRows }: { rows: AgencyClientWebsiteRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [editingRow, setEditingRow] = useState<AgencyClientWebsiteRow | null>(null);
  const localClientEdits = useRef<Map<string, Partial<AgencyClientWebsiteRow>>>(new Map());

  useEffect(() => {
    setRows((prev) => {
      const prevById = new Map(prev.map((row) => [row.id, row]));
      return initialRows.map((row) => {
        const local = localClientEdits.current.get(row.id);
        if (local) return { ...row, ...local };
        return prevById.get(row.id) ?? row;
      });
    });
  }, [initialRows]);

  const handleSaved = (websiteId: string, updates: Partial<AgencyClientWebsiteRow>) => {
    localClientEdits.current.set(websiteId, updates);
    setRows((prev) =>
      prev.map((row) => (row.id === websiteId ? { ...row, ...updates } : row)),
    );
    setEditingRow((current) =>
      current?.id === websiteId ? { ...current, ...updates } : current,
    );
    router.refresh();
  };

  const mergedRows = useMemo(() => {
    return rows.map((row) => {
      const local = localClientEdits.current.get(row.id);
      if (!local) return row;
      const serverSynced =
        local.clientNameRaw === row.clientNameRaw &&
        local.clientCompany === row.clientCompany &&
        local.clientStatus === row.clientStatus;
      if (serverSynced) {
        localClientEdits.current.delete(row.id);
        return row;
      }
      return { ...row, ...local };
    });
  }, [rows, initialRows]);

  const filtered = useMemo(() => {
    return mergedRows.filter((row) => {
      switch (filter) {
        case 'critical':
          return row.healthCategory === 'critical';
        case 'needs_attention':
          return row.healthCategory === 'needs_attention';
        case 'healthy':
          return row.healthCategory === 'healthy';
        case 'report_ready':
          return row.reportStatus === 'ready';
        case 'recent_changes':
          return row.recentChangesCount > 0;
        case 'ssl_issue':
          return row.sslStatus === 'critical' || row.sslStatus === 'warning';
        default:
          return true;
      }
    });
  }, [mergedRows, filter]);

  if (mergedRows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-indigo-700/40 bg-indigo-950/20 px-5 py-12 text-center">
        <p className="text-sm font-medium text-indigo-200">Add your first client website</p>
        <p className="mt-2 text-sm text-gray-500">
          Start monitoring and generate client-ready reports after your first scan completes.
        </p>
        <Link
          href="/enterprise/portal/websites?add=1"
          className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Add client website
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-800 bg-gray-950/60 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Website</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Last scan</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Changes</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Report</th>
              <th className="px-4 py-3 font-medium">Next action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((row) => {
              const band = getScoreBand(row.score);
              const nextAction =
                row.healthCategory === 'critical' || row.healthCategory === 'needs_attention'
                  ? 'Review & export report'
                  : row.reportStatus === 'ready'
                    ? 'Export for client'
                    : 'Monitor';

              return (
                <tr key={row.id} className="bg-gray-900/30 hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium text-white">{row.clientName}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-300">{row.displayName}</p>
                    <p className="truncate text-xs text-gray-500">{row.url}</p>
                  </td>
                  <td className="px-4 py-3">
                    {row.score !== null ? (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${band.badgeClass}`}>
                        {row.score}/100
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 sm:table-cell">{row.lastScanLabel}</td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">{row.recentChangesCount}</td>
                  <td className="hidden px-4 py-3 text-xs capitalize text-gray-400 lg:table-cell">
                    {row.reportStatus}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingRow(row)}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        Edit client
                      </button>
                      <Link
                        href={`/app/websites/${row.id}/health`}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        Health
                      </Link>
                      {row.scanId && (
                        <Link
                          href={`/report/${row.scanId}`}
                          className="text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Report
                        </Link>
                      )}
                      <span className="text-xs text-gray-500">{nextAction}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AgencyClientEditModal
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
