'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import type { OwnerCompetitor } from '@/lib/owner/types';

export default function CompetitorIntel({
  initialCompetitors,
}: {
  initialCompetitors: OwnerCompetitor[];
}) {
  const [competitors, setCompetitors] = useState(initialCompetitors);
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

  return (
    <SectionCard
      id="competitors"
      title="Competitor Watch"
      subtitle="Advantages, gaps, opportunities, and change tracking"
    >
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

      {competitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-500">No competitors tracked. Add your top 3 alternatives.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {competitors.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-white">{c.name}</h3>
                  {c.website && <p className="text-xs text-gray-500">{c.website}</p>}
                </div>
                {c.last_reviewed_at && (
                  <span className="text-[10px] text-gray-600">
                    Reviewed {new Date(c.last_reviewed_at).toLocaleDateString()}
                  </span>
                )}
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
    </SectionCard>
  );
}
