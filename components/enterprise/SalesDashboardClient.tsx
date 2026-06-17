'use client';

import { useMemo, useState } from 'react';
import {
  formatLeadDomainDisplay,
  isExcludedLeadStatus,
  OWNER_LEAD_STATUS_OPTIONS,
  type EnterpriseLeadStatus,
} from '@/lib/sales/leadValidation';
import { buildSuggestedResponseDraft } from '@/lib/sales/responseDraft';
import type { EnterpriseLeadRow } from '@/lib/sales/leadMetrics';

interface SalesStats {
  totalLeads: number;
  qualifiedCount: number;
  conversionRate: number;
  pipelineValue: number;
  upcomingDemos: Array<{
    id: string;
    email: string;
    name: string | null;
    scheduled_time: string;
  }>;
  topDomains: Array<{ domain: string; count: number }>;
  recentLeads: EnterpriseLeadRow[];
  excludedLeadCount: number;
  allLeads: EnterpriseLeadRow[];
}

interface SalesDashboardClientProps {
  email: string;
  stats: SalesStats;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusBadgeClass(status: string): string {
  if (status === 'qualified') return 'bg-green-500/15 text-green-300';
  if (status === 'spam' || status === 'test' || status === 'invalid') return 'bg-red-500/15 text-red-300';
  if (status === 'closed') return 'bg-gray-500/15 text-gray-400';
  return 'bg-blue-500/15 text-blue-300';
}

export default function SalesDashboardClient({ email, stats }: SalesDashboardClientProps) {
  const [showExcluded, setShowExcluded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [leads, setLeads] = useState(stats.allLeads);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleLeads = useMemo(
    () =>
      showExcluded ? leads : leads.filter((lead) => !isExcludedLeadStatus(lead.status)),
    [leads, showExcluded],
  );

  const displayLeads = visibleLeads.slice(0, 20);

  function getDraft(lead: EnterpriseLeadRow): string {
    if (drafts[lead.id]) return drafts[lead.id];
    return buildSuggestedResponseDraft({
      name: lead.name,
      company: lead.company,
      domain: lead.domain,
      company_size: lead.company_size,
      security_needs: lead.security_needs,
      message: lead.message,
      last_scan_score: lead.last_scan_score,
      risk_level: lead.risk_level,
    });
  }

  async function updateLead(id: string, payload: { status?: EnterpriseLeadStatus; admin_notes?: string }) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/enterprise/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to update lead');
        return;
      }
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l)));
    } catch {
      setError('Network error while saving lead');
    } finally {
      setSavingId(null);
    }
  }

  async function copyDraft(lead: EnterpriseLeadRow) {
    const text = getDraft(lead);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="border-b border-gray-800 bg-gray-900/50 px-4 py-4 sm:px-6">
        <h1 className="text-xl font-bold text-white">Sales Dashboard</h1>
        <p className="text-sm text-gray-500">Owner CRM — {email}</p>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Leads" value={stats.totalLeads} />
          <StatCard label="Qualified" value={stats.qualifiedCount} />
          <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} />
          <StatCard
            label="Pipeline Value"
            value={formatCurrency(stats.pipelineValue)}
            hint="Estimates based on qualified enterprise and security review opportunities."
          />
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold text-white">Upcoming Demos</h2>
            {stats.upcomingDemos.length === 0 ? (
              <p className="text-sm text-gray-500">No demos scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {stats.upcomingDemos.map((demo) => (
                  <li key={demo.id} className="rounded-lg bg-gray-800/40 px-4 py-3 text-sm">
                    <p className="font-medium text-white">{demo.name ?? demo.email}</p>
                    <p className="text-gray-400">{new Date(demo.scheduled_time).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold text-white">Top Domains</h2>
            {stats.topDomains.length === 0 ? (
              <p className="text-sm text-gray-500">No valid domains yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.topDomains.map(({ domain, count }) => (
                  <li key={domain} className="flex justify-between rounded-lg bg-gray-800/40 px-4 py-2 text-sm">
                    <span className="text-gray-300">{domain}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Leads</h2>
            {stats.excludedLeadCount > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={showExcluded}
                  onChange={(e) => setShowExcluded(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700"
                />
                Show spam/test leads ({stats.excludedLeadCount})
              </label>
            )}
          </div>

          {displayLeads.length === 0 ? (
            <p className="text-sm text-gray-500">
              No valid sales leads yet. Enterprise security review requests will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {displayLeads.map((lead) => {
                const expanded = expandedId === lead.id;
                const draft = getDraft(lead);
                const noteValue = notes[lead.id] ?? lead.admin_notes ?? '';

                return (
                  <div key={lead.id} className="rounded-lg border border-gray-800 bg-gray-800/30">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : lead.id)}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{lead.name}</p>
                        <p className="truncate text-xs text-gray-500">{lead.email}</p>
                        <p className="mt-1 text-sm text-gray-400">
                          {lead.company?.trim() || 'No company'} ·{' '}
                          {formatLeadDomainDisplay(lead.domain)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={`font-semibold ${lead.lead_score >= 70 ? 'text-green-400' : lead.lead_score >= 50 ? 'text-yellow-400' : 'text-gray-400'}`}
                        >
                          {lead.lead_score}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusBadgeClass(lead.status)}`}>
                          {lead.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="space-y-4 border-t border-gray-800 px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {OWNER_LEAD_STATUS_OPTIONS.map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={savingId === lead.id || lead.status === status}
                              onClick={() => updateLead(lead.id, { status })}
                              className="rounded-md border border-gray-700 px-2 py-1 text-xs capitalize text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-50"
                            >
                              Mark {status}
                            </button>
                          ))}
                        </div>

                        {lead.message && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-gray-500">Request message</p>
                            <p className="mt-1 text-sm text-gray-300">{lead.message}</p>
                          </div>
                        )}

                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase text-gray-500">Suggested response</p>
                            <button
                              type="button"
                              onClick={() => copyDraft(lead)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              {copiedId === lead.id ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <textarea
                            rows={8}
                            value={drafts[lead.id] ?? draft}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Edit before sending. Responses are not auto-emailed.
                          </p>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Owner notes</p>
                          <textarea
                            rows={3}
                            value={noteValue}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            placeholder="Internal notes (private to owner)"
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={savingId === lead.id}
                            onClick={() => updateLead(lead.id, { admin_notes: noteValue })}
                            className="mt-2 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50"
                          >
                            {savingId === lead.id ? 'Saving…' : 'Save notes'}
                          </button>
                        </div>

                        {lead.last_contacted_at && (
                          <p className="text-xs text-gray-500">
                            Last contacted: {new Date(lead.last_contacted_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
