'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ProblemReportRow {
  id: string;
  created_at: string;
  status: string;
  problem_type: string;
  severity: string;
  message: string;
  contact_email: string | null;
  can_contact: boolean;
  page_url: string | null;
  plan: string | null;
  scan_id: string | null;
  report_id: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
}

function severityClass(severity: string): string {
  switch (severity) {
    case 'Critical':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'High':
      return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'Medium':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}

export default function ProblemReportsAdmin() {
  const [reports, setReports] = useState<ProblemReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/beta/problem-reports');
      if (!res.ok) {
        setError('Failed to load reports');
        return;
      }
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch {
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateReport = async (id: string, status?: string, adminNotes?: string) => {
    const res = await fetch(`/api/beta/problem-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNotes }),
    });
    if (res.ok) void load();
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Loading problem reports…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-5 py-8 text-center">
        <p className="text-sm font-medium text-gray-200">No beta reports yet.</p>
        <p className="mt-2 text-sm text-gray-500">
          Reports submitted through the Report a Problem button will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reports.map((r) => {
        const expanded = expandedId === r.id;
        return (
          <li key={r.id} className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severityClass(r.severity)}`}
                  >
                    {r.severity}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-gray-500">{r.status}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="font-medium text-white">{r.problem_type}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-400">{r.message}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {r.contact_email ?? 'No email'}
                  {r.plan ? ` · ${r.plan}` : ''}
                </p>
                {r.page_url && (
                  <a
                    href={r.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-indigo-400 hover:underline"
                  >
                    {r.page_url}
                  </a>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {r.report_id && (
                    <Link href={`/report/${r.report_id}`} className="text-indigo-400 hover:underline">
                      Report →
                    </Link>
                  )}
                  {r.scan_id && <span className="text-gray-500">Scan: {r.scan_id.slice(0, 8)}…</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
                >
                  {expanded ? 'Hide' : 'Details'}
                </button>
                {r.status !== 'reviewed' && (
                  <button
                    type="button"
                    onClick={() => updateReport(r.id, 'reviewed')}
                    className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-300 hover:bg-yellow-500/10"
                  >
                    Mark reviewed
                  </button>
                )}
                {r.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => updateReport(r.id, 'resolved', notesDraft[r.id] ?? r.admin_notes ?? '')}
                    className="rounded-lg border border-green-500/30 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/10"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            </div>

            {expanded && (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <p className="whitespace-pre-wrap text-sm text-gray-300">{r.message}</p>
                <label className="mt-4 block text-sm">
                  <span className="mb-1 block text-gray-400">Admin notes</span>
                  <textarea
                    value={notesDraft[r.id] ?? r.admin_notes ?? ''}
                    onChange={(e) =>
                      setNotesDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateReport(r.id, undefined, notesDraft[r.id] ?? r.admin_notes ?? '')
                  }
                  className="mt-2 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
                >
                  Save notes
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
