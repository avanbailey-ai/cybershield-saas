'use client';

import { useMemo, useState } from 'react';
import EmptyState from './EmptyState';
import HygieneControls from './HygieneControls';
import { scoreOpportunity, opportunityTierColor } from '@/lib/owner/opportunityScore';
import { prospectNextStep, prospectsForTab, PIPELINE_TABS, type ProspectTabId } from '@/lib/owner/pipeline';
import type { OwnerProspect } from '@/lib/owner/types';

export default function ProspectPipeline({
  prospects,
  onProspectsChange,
}: {
  prospects: OwnerProspect[];
  onProspectsChange: (next: OwnerProspect[]) => void;
}) {
  const [tab, setTab] = useState<ProspectTabId>('new');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => prospectsForTab(prospects, tab), [prospects, tab]);
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runScan(id: string) {
    setScanning(id);
    try {
      const res = await fetch(`/api/owner/prospects/${id}/scan`, { method: 'POST' });
      const data = await res.json();
      if (data.prospect) {
        onProspectsChange(prospects.map((p) => (p.id === id ? data.prospect : p)));
      }
    } finally {
      setScanning(null);
    }
  }

  async function patchProspect(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/owner/prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.prospect) {
      onProspectsChange(prospects.map((p) => (p.id === id ? data.prospect : p)));
    }
  }

  async function deleteProspect(id: string) {
    const res = await fetch(`/api/owner/prospects/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      onProspectsChange(prospects.filter((p) => p.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function bulkAction(
    action: 'archive' | 'delete' | 'unarchive' | 'set_state' | 'generate_outreach',
    pipeline_state?: string,
  ) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/owner/prospects/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids, pipeline_state }),
      });
      const data = await res.json();
      if (!data.ok) return;

      if (action === 'delete') {
        onProspectsChange(prospects.filter((p) => !ids.includes(p.id)));
      } else if (action === 'archive') {
        onProspectsChange(
          prospects.map((p) =>
            ids.includes(p.id)
              ? { ...p, pipeline_state: 'archived', archived_at: new Date().toISOString() }
              : p,
          ),
        );
      } else if (action === 'unarchive') {
        onProspectsChange(
          prospects.map((p) =>
            ids.includes(p.id)
              ? { ...p, pipeline_state: pipeline_state ?? 'scanned', archived_at: null }
              : p,
          ),
        );
      } else if (action === 'set_state' && pipeline_state) {
        onProspectsChange(
          prospects.map((p) => (ids.includes(p.id) ? { ...p, pipeline_state } : p)),
        );
      }
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(PIPELINE_TABS) as ProspectTabId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setSelected(new Set());
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {PIPELINE_TABS[id].label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2">
          <span className="text-xs text-violet-300">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkAction('archive')}
            className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
          >
            Archive
          </button>
          {tab === 'archived' && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => bulkAction('unarchive', 'scanned')}
              className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
            >
              Unarchive
            </button>
          )}
          {tab === 'outreach_ready' && (
            <>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => bulkAction('generate_outreach')}
                className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
              >
                Generate outreach
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => bulkAction('set_state', 'contacted')}
                className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
              >
                Mark contacted
              </button>
            </>
          )}
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => {
              if (window.confirm(`Delete ${selected.size} prospect(s)? This cannot be undone.`)) {
                bulkAction('delete');
              }
            }}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="No prospects discovered yet."
          description="Run automated discovery to find real businesses from public sources. Prospects are validated and scanned before entering your pipeline."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <th className="pb-3 pr-2">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="pb-3 pr-4">Business</th>
                <th className="pb-3 pr-4">Source</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Tier</th>
                <th className="pb-3 pr-4">Next step</th>
                <th className="pb-3 pr-4">Scan</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const opp = scoreOpportunity({
                  leadScore: p.lead_score,
                  scanScore: p.scan_score,
                  scanRiskLevel: p.scan_risk_level,
                  industry: p.industry,
                  scanCompleted: p.scan_status === 'completed',
                });
                const nextStep = prospectNextStep(p);
                return (
                  <tr key={p.id} className="border-b border-gray-800/50">
                    <td className="py-3 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-white">{p.business_name}</p>
                      <p className="text-xs text-gray-500">{p.website}</p>
                      {p.top_issue && (
                        <p className="mt-0.5 text-xs text-amber-500/80">{p.top_issue}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-500">
                      {p.discovery_source?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="py-3 pr-4">
                      {p.scan_score !== null ? (
                        <span className="text-white">{p.scan_score}/100</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {opp.tier ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${opportunityTierColor(opp.tier)}`}
                        >
                          {opp.tier}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] py-3 pr-4 text-xs text-gray-500">{nextStep}</td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => runScan(p.id)}
                        disabled={scanning === p.id}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
                      >
                        {scanning === p.id
                          ? 'Scanning…'
                          : p.scan_status === 'completed'
                            ? 'Re-scan'
                            : 'Run scan'}
                      </button>
                    </td>
                    <td className="py-3">
                      <HygieneControls
                        compact
                        archived={p.pipeline_state === 'archived'}
                        onArchive={() => patchProspect(p.id, { archive: true })}
                        onUnarchive={() => patchProspect(p.id, { unarchive: true })}
                        onDelete={() => deleteProspect(p.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
