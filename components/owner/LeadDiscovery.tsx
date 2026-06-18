'use client';

import { useState, useMemo, useRef } from 'react';
import { SectionCard } from './MetricCard';
import EmptyState from './EmptyState';
import { scoreOpportunity, opportunityTierColor } from '@/lib/owner/opportunityScore';
import type { OwnerProspect } from '@/lib/owner/types';

type ImportTab = 'urls' | 'csv' | 'manual';

export default function LeadDiscovery({
  initialProspects,
  embedded,
}: {
  initialProspects: OwnerProspect[];
  embedded?: boolean;
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [batchUrls, setBatchUrls] = useState('');
  const [csvText, setCsvText] = useState('');
  const [tab, setTab] = useState<ImportTab>('urls');
  const [autoScan, setAutoScan] = useState(true);
  const [defaultIndustry, setDefaultIndustry] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    business_name: '',
    website: '',
    industry: '',
    city: '',
    state: '',
    country: '',
  });

  const stats = useMemo(() => {
    const hot = prospects.filter((p) => p.lead_score === 'HOT').length;
    const warm = prospects.filter((p) => p.lead_score === 'WARM').length;
    const pending = prospects.filter((p) => p.scan_status === 'pending').length;
    const scanned = prospects.filter((p) => p.scan_status === 'completed').length;
    return { hot, warm, pending, scanned, total: prospects.length };
  }, [prospects]);

  const sorted = useMemo(() => {
    return [...prospects].sort((a, b) => {
      const pa =
        a.opportunity_priority ??
        scoreOpportunity({
          leadScore: a.lead_score,
          scanScore: a.scan_score,
          scanRiskLevel: a.scan_risk_level,
          industry: a.industry,
          scanCompleted: a.scan_status === 'completed',
        }).priority;
      const pb =
        b.opportunity_priority ??
        scoreOpportunity({
          leadScore: b.lead_score,
          scanScore: b.scan_score,
          scanRiskLevel: b.scan_risk_level,
          industry: b.industry,
          scanCompleted: b.scan_status === 'completed',
        }).priority;
      return pb - pa;
    });
  }, [prospects]);

  async function runImport(mode: 'batch' | 'csv', payload: string) {
    if (!payload.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('/api/owner/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          urls: mode === 'batch' ? payload : undefined,
          csv: mode === 'csv' ? payload : undefined,
          industry: defaultIndustry || undefined,
          autoScan,
        }),
      });
      const data = await res.json();
      if (data.prospects?.length) {
        setProspects((p) => [...data.prospects, ...p]);
        if (mode === 'batch') setBatchUrls('');
        if (mode === 'csv') setCsvText('');
      }
    } finally {
      setImporting(false);
    }
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      runImport('csv', text);
    };
    reader.readAsText(file);
  }

  async function addProspect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/owner/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.prospect) {
        setProspects((p) => [data.prospect, ...p]);
        setForm({ business_name: '', website: '', industry: '', city: '', state: '', country: '' });
      }
    } finally {
      setLoading(false);
    }
  }

  async function runScan(id: string) {
    setScanning(id);
    try {
      const res = await fetch(`/api/owner/prospects/${id}/scan`, { method: 'POST' });
      const data = await res.json();
      if (data.prospect) {
        setProspects((p) => p.map((x) => (x.id === id ? data.prospect : x)));
      }
    } finally {
      setScanning(null);
    }
  }

  async function scanAllPending() {
    const pending = prospects.filter((p) => p.scan_status === 'pending');
    for (const p of pending) {
      await runScan(p.id);
    }
  }

  const body = (
    <>
      {stats.pending > 0 && embedded && (
        <div className="mb-4">
          <button
            type="button"
            onClick={scanAllPending}
            className="text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            Scan {stats.pending} pending →
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: 'urls' as const, label: 'URL Import' },
            { id: 'csv' as const, label: 'CSV Import' },
            { id: 'manual' as const, label: 'Manual Add' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === t.id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={autoScan}
            onChange={(e) => setAutoScan(e.target.checked)}
          />
          Auto-scan after import
        </label>
        <input
          placeholder="Default industry (optional)"
          value={defaultIndustry}
          onChange={(e) => setDefaultIndustry(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-white"
        />
      </div>

      {tab === 'urls' && (
        <div className="mb-6 space-y-3">
          <textarea
            placeholder="Paste URLs (one per line) or Name|URL|Industry format"
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => runImport('batch', batchUrls)}
            disabled={importing || !batchUrls.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import URLs'}
          </button>
        </div>
      )}

      {tab === 'csv' && (
        <div className="mb-6 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-violet-500/50"
          >
            Upload CSV file
          </button>
          <textarea
            placeholder="Or paste CSV with headers: website, name, industry, city, state, country"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => runImport('csv', csvText)}
            disabled={importing || !csvText.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
        </div>
      )}

      {tab === 'manual' && (
        <form onSubmit={addProspect} className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Business name"
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            required
          />
          <input
            placeholder="Website URL"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            required
          />
          <input
            placeholder="Industry"
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 lg:col-span-4"
          >
            {loading ? 'Adding…' : 'Add Prospect'}
          </button>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title="No prospects imported yet"
          description="Import websites to begin prospect discovery. Run scans to unlock opportunity scoring."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <th className="pb-3 pr-4">Business</th>
                <th className="pb-3 pr-4">Industry</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Tier</th>
                <th className="pb-3 pr-4">Next step</th>
                <th className="pb-3">Scan</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const opp = scoreOpportunity({
                  leadScore: p.lead_score,
                  scanScore: p.scan_score,
                  scanRiskLevel: p.scan_risk_level,
                  industry: p.industry,
                  scanCompleted: p.scan_status === 'completed',
                });
                const nextStep =
                  p.scan_status === 'pending'
                    ? 'Run scan'
                    : opp.tier === 'HOT'
                      ? 'Generate outreach'
                      : opp.tier === 'WARM'
                        ? 'Send audit summary'
                        : opp.rationale;
                return (
                  <tr key={p.id} className="border-b border-gray-800/50">
                    <td className="py-3 pr-4">
                      <p className="text-white">{p.business_name}</p>
                      <p className="text-xs text-gray-500">{p.website}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">{p.industry || '—'}</td>
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
                    <td className="py-3">
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div id="prospects">{body}</div>;
  }

  return (
    <SectionCard
      id="prospects"
      title="Prospects"
      subtitle="Import websites · run scans · score opportunities"
    >
      {body}
    </SectionCard>
  );
}
