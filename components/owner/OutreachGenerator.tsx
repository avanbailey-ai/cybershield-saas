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
  const [loading, setLoading] = useState(false);

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
      if (data.content) setContent(data.content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      id="outreach"
      title="Outreach Generator"
      subtitle="Template-based cold outreach using scan findings"
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        >
          {prospects.length === 0 && <option value="">No prospects</option>}
          {prospects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.business_name}
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

      {content ? (
        <div className="relative rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="absolute right-3 top-3">
            <CopyButton text={content} />
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-300">{content}</pre>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Select a prospect and generate outreach copy.</p>
      )}
    </SectionCard>
  );
}
