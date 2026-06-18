'use client';

import { useMemo, useState } from 'react';
import EmptyState from './EmptyState';
import ProspectCard from './ProspectCard';
import { prospectsForTab, PIPELINE_TABS, type ProspectTabId } from '@/lib/owner/pipeline';
import type { OwnerProspect } from '@/lib/owner/types';

export default function ProspectPipeline({
  prospects,
  onProspectsChange,
}: {
  prospects: OwnerProspect[];
  onProspectsChange: (next: OwnerProspect[]) => void;
}) {
  const [tab, setTab] = useState<ProspectTabId>('new_discovery');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => prospectsForTab(prospects, tab), [prospects, tab]);
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
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
    action:
      | 'archive'
      | 'ignore_forever'
      | 'delete'
      | 'unarchive'
      | 'set_state'
      | 'generate_outreach'
      | 'mark_contacted'
      | 'mark_customer',
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
      } else if (action === 'ignore_forever') {
        onProspectsChange(
          prospects.map((p) =>
            ids.includes(p.id)
              ? { ...p, pipeline_state: 'ignore_forever', archived_at: new Date().toISOString() }
              : p,
          ),
        );
      } else if (action === 'mark_contacted') {
        onProspectsChange(
          prospects.map((p) => (ids.includes(p.id) ? { ...p, pipeline_state: 'contacted' } : p)),
        );
      } else if (action === 'mark_customer') {
        onProspectsChange(
          prospects.map((p) => (ids.includes(p.id) ? { ...p, pipeline_state: 'customer' } : p)),
        );
      } else if (action === 'unarchive') {
        onProspectsChange(
          prospects.map((p) =>
            ids.includes(p.id)
              ? { ...p, pipeline_state: pipeline_state ?? 'new_discovery', archived_at: null }
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

      {filtered.length > 0 && (
        <label className="mb-3 flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Select all in view
        </label>
      )}

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
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkAction('ignore_forever')}
            className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
          >
            Ignore forever
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkAction('mark_contacted')}
            className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
          >
            Mark contacted
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkAction('mark_customer')}
            className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
          >
            Mark customer
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkAction('generate_outreach')}
            className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
          >
            Generate outreach
          </button>
          {tab === 'archived' && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => bulkAction('unarchive', 'new_discovery')}
              className="text-xs text-gray-300 hover:text-white disabled:opacity-50"
            >
              Unarchive
            </button>
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
          title="No prospects in this stage."
          description="Run discovery to find qualified businesses. Archived and ignored prospects are hidden from active pipeline tabs."
        />
      ) : (
        <ul className="space-y-4">
          {filtered.map((p) => (
            <li key={p.id}>
              <ProspectCard
                prospect={p}
                selected={selected.has(p.id)}
                scanning={scanning === p.id}
                onToggle={() => toggleOne(p.id)}
                onScan={() => runScan(p.id)}
                onGenerateOutreach={() => {
                  setSelected(new Set([p.id]));
                  void bulkAction('generate_outreach');
                }}
                onArchive={() => patchProspect(p.id, { archive: true })}
                onIgnoreForever={() => patchProspect(p.id, { ignore_forever: true })}
                onUnarchive={() => patchProspect(p.id, { unarchive: true })}
                onDelete={() => deleteProspect(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
