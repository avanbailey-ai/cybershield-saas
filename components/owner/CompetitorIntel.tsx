'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import HygieneControls from './HygieneControls';
import type { OwnerCompetitor } from '@/lib/owner/types';

export default function CompetitorIntel({
  initialCompetitors,
  embedded,
}: {
  initialCompetitors: OwnerCompetitor[];
  embedded?: boolean;
}) {
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [form, setForm] = useState({
    name: '',
    website: '',
    pricing_notes: '',
    features: '',
    positioning: '',
  });

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/owner/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        advantages: 'CyberShield: continuous monitoring, SMB-friendly pricing, agency white-label',
        gaps: form.features ? `Gap vs ${form.name}: evaluate feature parity` : null,
        opportunities: 'Position as affordable alternative with faster onboarding',
        last_reviewed_at: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    if (data.competitor) {
      setCompetitors((c) => [...c, data.competitor].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: '', website: '', pricing_notes: '', features: '', positioning: '' });
    }
  }

  async function hygieneCompetitor(id: string, body: Record<string, boolean>) {
    const res = await fetch(`/api/owner/competitors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.competitor) {
      setCompetitors((c) => c.map((x) => (x.id === id ? data.competitor : x)));
    }
  }

  async function deleteCompetitor(id: string) {
    const res = await fetch(`/api/owner/competitors/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) setCompetitors((c) => c.filter((x) => x.id !== id));
  }

  const visible = competitors.filter((c) => (view === 'archived' ? c.archived_at : !c.archived_at));

  const inner = (
    <>
      <div className="mb-4 flex gap-2">
        {(['active', 'archived'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1 text-xs ${
              view === v ? 'bg-violet-600 text-white' : 'text-gray-400'
            }`}
          >
            {v === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>
      <form onSubmit={addCompetitor} className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          placeholder="Competitor name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          required
        />
        <input
          placeholder="Website"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <input
          placeholder="Pricing notes"
          value={form.pricing_notes}
          onChange={(e) => setForm({ ...form, pricing_notes: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <input
          placeholder="Key features"
          value={form.features}
          onChange={(e) => setForm({ ...form, features: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white lg:col-span-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Add Competitor
        </button>
      </form>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-500">No competitors tracked. Add your top 3 alternatives.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-white">{c.name}</h3>
                  {c.website && <p className="text-xs text-gray-500">{c.website}</p>}
                </div>
                <div className="text-right">
                  {c.last_reviewed_at && (
                    <span className="block text-[10px] text-gray-600">
                      Reviewed {new Date(c.last_reviewed_at).toLocaleDateString()}
                    </span>
                  )}
                  <HygieneControls
                    compact
                    archived={!!c.archived_at}
                    onArchive={() => hygieneCompetitor(c.id, { archive: true })}
                    onUnarchive={() => hygieneCompetitor(c.id, { unarchive: true })}
                    onDelete={() => deleteCompetitor(c.id)}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {c.pricing_notes && (
                  <p>
                    <span className="text-gray-500">Pricing: </span>
                    <span className="text-gray-300">{c.pricing_notes}</span>
                  </p>
                )}
                {c.features && (
                  <p>
                    <span className="text-gray-500">Features: </span>
                    <span className="text-gray-300">{c.features}</span>
                  </p>
                )}
                {c.advantages && (
                  <p className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-300">
                    ✓ Advantage: {c.advantages}
                  </p>
                )}
                {c.gaps && (
                  <p className="rounded-lg bg-amber-500/10 px-2 py-1 text-amber-300">
                    Gap: {c.gaps}
                  </p>
                )}
                {c.opportunities && (
                  <p className="rounded-lg bg-violet-500/10 px-2 py-1 text-violet-300">
                    Opportunity: {c.opportunities}
                  </p>
                )}
                {c.changes_notes && (
                  <p className="rounded-lg bg-gray-800/50 px-2 py-1 text-xs text-gray-400">
                    Changes: {c.changes_notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return <div id="competitors">{inner}</div>;

  return (
    <SectionCard id="competitors" title="Competitors" subtitle="Market intelligence">
      {inner}
    </SectionCard>
  );
}
