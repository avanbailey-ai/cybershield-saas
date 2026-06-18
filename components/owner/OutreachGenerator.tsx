'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import CopyButton from './CopyButton';
import { OUTREACH_TYPES, type OutreachType } from '@/lib/owner/generators/outreach';
import type { OwnerProspect } from '@/lib/owner/types';

export default function OutreachGenerator({ prospects }: { prospects: OwnerProspect[] }) {
  const [type, setType] = useState<OutreachType>('cold_email');
  const [selectedId, setSelectedId] = useState(prospects[0]?.id ?? '');
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'approved' | 'sent'>('draft');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const prospect = prospects.find((p) => p.id === selectedId);
  const findings = prospect?.scan_findings as { issues?: string[] } | null;

  async function generate() {
    if (!prospect) return;
    setLoading(true);
    try {
      const res = await fetch('/api/owner/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          businessName: prospect.business_name,
          website: prospect.website,
          industry: prospect.industry,
          city: prospect.city,
          scanScore: prospect.scan_score,
          riskLevel: prospect.scan_risk_level,
          issues: findings?.issues,
        }),
      });
      const data = await res.json();
      if (data.content) {
        setContent(data.content);
        setEditing(true);
        setDraftId(null);
        setStatus('draft');
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft(approve = false) {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        prospect_id: prospect?.id,
        outreach_type: type,
        business_name: prospect?.business_name,
        content,
        status: approve ? 'approved' : status,
      };
      const res = await fetch('/api/owner/outreach/drafts', {
        method: draftId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftId ? { id: draftId, ...payload } : payload),
      });
      const data = await res.json();
      if (data.draft) {
        setDraftId(data.draft.id);
        setStatus(data.draft.status);
        if (approve) setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      id="outreach"
      title="AI Outreach Engine"
      subtitle="Findings-based copy · Copy, edit, approve, and save drafts"
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        >
          {prospects.length === 0 && <option value="">No prospects — run discovery first</option>}
          {prospects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.business_name} {p.lead_score ? `(${p.lead_score})` : ''}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as OutreachType)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        >
          {OUTREACH_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={!prospect || loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {prospect?.scan_findings && (
        <p className="mb-3 text-xs text-gray-500">
          Using scan findings: {(findings?.issues ?? []).slice(0, 2).join(' · ') || 'general security gaps'}
        </p>
      )}

      {content ? (
        <div className="relative rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="absolute right-3 top-3 flex gap-2">
            <CopyButton text={content} />
            {status === 'approved' && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">
                Approved
              </span>
            )}
          </div>
          {editing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full bg-transparent text-sm text-gray-300 outline-none"
            />
          ) : (
            <pre className="whitespace-pre-wrap pr-16 text-sm text-gray-300">{content}</pre>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-800 pt-4">
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
            >
              {editing ? 'Preview' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={() => saveDraft(false)}
              disabled={saving}
              className="rounded-lg border border-violet-500/30 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-500/10 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => saveDraft(true)}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-500">
            {prospects.length === 0
              ? 'Add prospects via discovery, then generate findings-based outreach.'
              : 'Select a prospect and generate outreach copy.'}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
