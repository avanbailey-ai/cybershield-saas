'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from './EmptyState';
import ProspectCard from './ProspectCard';
import OutreachApprovalCard from './OutreachApprovalCard';
import {
  prospectsForTab,
  PIPELINE_TABS,
  countByStage,
  hasActiveProspects,
  stageEmptyMessage,
  type ProspectTabId,
} from '@/lib/owner/pipeline';
import {
  applyProspectFilter,
  PROSPECT_FILTERS,
  type ProspectFilterId,
} from '@/lib/owner/prospectFilters';
import type { OwnerOutreachDraft, OwnerProspect } from '@/lib/owner/types';
import {
  effectiveOutreachEmail,
  hasOutreachContact,
  filterProspectsByKind,
  type ProspectKindView,
} from '@/lib/owner/prospectDisplay';

export default function ProspectPipeline({
  prospects,
  onProspectsChange,
  kindView = 'smb',
}: {
  prospects: OwnerProspect[];
  onProspectsChange: (next: OwnerProspect[]) => void;
  kindView?: ProspectKindView;
}) {
  const kindProspects = useMemo(
    () => filterProspectsByKind(prospects, kindView),
    [prospects, kindView],
  );
  const [tab, setTab] = useState<ProspectTabId>('outreach_ready');
  const [filter, setFilter] = useState<ProspectFilterId>('highest_opportunity');
  const [filterValue, setFilterValue] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [drafts, setDrafts] = useState<OwnerOutreachDraft[]>([]);
  const initialTabSet = useRef(false);

  useEffect(() => {
    if (initialTabSet.current || kindProspects.length === 0) return;
    initialTabSet.current = true;
    const counts = countByStage(kindProspects);
    if (counts.outreach_ready > 0) setTab('outreach_ready');
    else if (counts.qualified > 0) setTab('qualified');
    else if (counts.new_discovery > 0) setTab('new_discovery');
  }, [prospects]);

  useEffect(() => {
    if (tab !== 'outreach_ready') return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/owner/outreach/drafts?view=active');
      const data = await res.json();
      if (!cancelled && data.drafts) {
        setDrafts(
          (data.drafts as OwnerOutreachDraft[]).filter(
            (d) => d.status === 'draft' || d.status === 'approved',
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, prospects]);

  const draftByProspect = useMemo(() => {
    const map = new Map<string, OwnerOutreachDraft>();
    for (const d of drafts) {
      if (d.prospect_id && !map.has(d.prospect_id)) map.set(d.prospect_id, d);
    }
    return map;
  }, [drafts]);

  async function refreshDrafts() {
    const res = await fetch('/api/owner/outreach/drafts?view=active');
    const data = await res.json();
    if (data.drafts) {
      setDrafts(
        (data.drafts as OwnerOutreachDraft[]).filter(
          (d) => d.status === 'draft' || d.status === 'approved',
        ),
      );
    }
  }

  async function sendDraft(draftId: string, prospectId: string) {
    const res = await fetch(`/api/owner/outreach/${draftId}/send`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      window.alert(data.error ?? 'Send failed');
      return;
    }
    onProspectsChange(
      prospects.map((p) => (p.id === prospectId ? { ...p, pipeline_state: 'contacted' } : p)),
    );
    await refreshDrafts();
  }

  async function editDraft(draftId: string, content: string) {
    await fetch(`/api/owner/outreach/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    await refreshDrafts();
  }

  async function regenerateDraft(draftId: string) {
    const res = await fetch(`/api/owner/outreach/${draftId}/regenerate`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      window.alert(data.error ?? 'Regenerate failed');
      return;
    }
    await refreshDrafts();
  }

  const globalHasProspects = hasActiveProspects(kindProspects);
  const stageCounts = useMemo(() => countByStage(kindProspects), [kindProspects]);

  const filtered = useMemo(() => {
    const inTab = prospectsForTab(kindProspects, tab, tab === 'archived');
    return applyProspectFilter(inTab, filter, filterValue || undefined);
  }, [kindProspects, tab, filter, filterValue]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const empty = stageEmptyMessage(tab, globalHasProspects);

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

  async function findContact(id: string) {
    setScanning(id);
    try {
      const res = await fetch(`/api/owner/prospects/${id}/contact`, { method: 'POST' });
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

  if (!globalHasProspects) {
    return null;
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
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              tab === id ? 'bg-violet-600 text-white' : 'bg-white/[0.03] text-gray-400 hover:text-white'
            }`}
          >
            {PIPELINE_TABS[id].label}
            <span className="ml-1.5 opacity-70">({stageCounts[id]})</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Filter:</span>
        {PROSPECT_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              filter === f.id
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        {(filter === 'by_industry' || filter === 'by_location') && (
          <input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder={filter === 'by_industry' ? 'Industry…' : 'City or state…'}
            className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white"
          />
        )}
        {filter === 'by_plan_fit' && (
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white"
          >
            <option value="">All plans</option>
            <option value="79">Starter ($79)</option>
            <option value="149">Growth ($149)</option>
            <option value="299">Agency ($299)</option>
          </select>
        )}
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
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('archive')} className="text-xs text-gray-300 hover:text-white disabled:opacity-50">Archive</button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('ignore_forever')} className="text-xs text-gray-300 hover:text-white disabled:opacity-50">Ignore forever</button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('mark_contacted')} className="text-xs text-gray-300 hover:text-white disabled:opacity-50">Mark contacted</button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('mark_customer')} className="text-xs text-gray-300 hover:text-white disabled:opacity-50">Mark customer</button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkAction('generate_outreach')} className="text-xs text-gray-300 hover:text-white disabled:opacity-50">Generate outreach</button>
          {tab === 'archived' && (
            <button type="button" disabled={bulkBusy} onClick={() => bulkAction('unarchive', 'new_discovery')} className="text-xs text-gray-300 hover:text-white disabled:opacity-50">Unarchive</button>
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
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <ul className="space-y-5">
          {filtered.map((p) => {
            const draft = tab === 'outreach_ready' ? draftByProspect.get(p.id) : undefined;
            const showApproval =
              tab === 'outreach_ready' &&
              draft &&
              Boolean(effectiveOutreachEmail(p, draft.recipient_email));

            return (
              <li key={p.id}>
                {showApproval ? (
                  <OutreachApprovalCard
                    prospect={{
                      ...p,
                      contact_email:
                        effectiveOutreachEmail(p, draft.recipient_email) ?? p.contact_email,
                    }}
                    draft={draft}
                    onApproveSend={() => sendDraft(draft.id, p.id)}
                    onEditDraft={(content) => editDraft(draft.id, content)}
                    onRegenerate={() => regenerateDraft(draft.id)}
                    onArchive={() => patchProspect(p.id, { archive: true })}
                    onIgnoreForever={() => patchProspect(p.id, { ignore_forever: true })}
                  />
                ) : (
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
                    onFindContact={() => findContact(p.id)}
                    onArchive={() => patchProspect(p.id, { archive: true })}
                    onIgnoreForever={() => patchProspect(p.id, { ignore_forever: true })}
                    onUnarchive={() => patchProspect(p.id, { unarchive: true })}
                    onDelete={() => deleteProspect(p.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
