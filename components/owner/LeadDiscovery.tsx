'use client';

import { useState, useMemo } from 'react';
import { SectionCard } from './MetricCard';
import { leadScoreColor } from '@/lib/owner/leadScore';
import { scoreOpportunity, opportunityTierColor } from '@/lib/owner/opportunityScore';
import type { OwnerProspect } from '@/lib/owner/types';

export default function LeadDiscovery({ initialProspects }: { initialProspects: OwnerProspect[] }) {
  const [prospects, setProspects] = useState(initialProspects);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [batchUrls, setBatchUrls] = useState('');
  const [tab, setTab] = useState<'search' | 'manual' | 'batch'>('search');
  const [search, setSearch] = useState({
    industry: 'healthcare',
    city: '',
    state: '',
    country: 'US',
    autoScan: true,
  });
  const [form, setForm] = useState({
    business_name: '',
    website: '',
    industry: '',
    city: '',
    state: '',
    country: '',
  });

  const sorted = useMemo(() => {
    return [...prospects].sort((a, b) => {
      const pa = a.opportunity_priority ?? scoreOpportunity({
        leadScore: a.lead_score,
        scanScore: a.scan_score,
        industry: a.industry,
      }).priority;
      const pb = b.opportunity_priority ?? scoreOpportunity({
        leadScore: b.lead_score,
        scanScore: b.scan_score,
        industry: b.industry,
      }).priority;
      return pb - pa;
    });
  }, [prospects]);

  async function runDiscovery() {
    setDiscovering(true);
    try {
      const res = await fetch('/api/owner/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'search', ...search, limit: 8 }),
      });
      const data = await res.json();
      if (data.prospects?.length) {
        setProspects((p) => [...data.prospects, ...p]);
      }
    } finally {
      setDiscovering(false);
    }
  }

  async function runBatchImport() {
    if (!batchUrls.trim()) return;
    setDiscovering(true);
    try {
      const res = await fetch('/api/owner/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'batch',
          urls: batchUrls,
          industry: search.industry,
          autoScan: search.autoScan,
        }),
      });
      const data = await res.json();
      if (data.prospects?.length) {
        setProspects((p) => [...data.prospects, ...p]);
        setBatchUrls('');
      }
    } finally {
      setDiscovering(false);
    }
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

  return (
    <SectionCard
      id="prospects"
      title="Prospect Discovery Workspace"
      subtitle="Search by market, batch import URLs, auto-scan and score opportunities"
    >
      <div className="mb-4 flex gap-2">
        {(['search', 'manual', 'batch'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === t ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t === 'search' ? 'Market Search' : t === 'manual' ? 'Manual Add' : 'URL Batch'}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input
            placeholder="Industry"
            value={search.industry}
            onChange={(e) => setSearch({ ...search, industry: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <input
            placeholder="City"
            value={search.city}
            onChange={(e) => setSearch({ ...search, city: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <input
            placeholder="State"
            value={search.state}
            onChange={(e) => setSearch({ ...search, state: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <input
            placeholder="Country"
            value={search.country}
            onChange={(e) => setSearch({ ...search, country: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={search.autoScan}
              onChange={(e) => setSearch({ ...search, autoScan: e.target.checked })}
            />
            Auto-scan
          </label>
          <button
            type="button"
            onClick={runDiscovery}
            disabled={discovering}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {discovering ? 'Discovering…' : 'Run Discovery'}
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

      {tab === 'batch' && (
        <div className="mb-6 space-y-3">
          <textarea
            placeholder="Paste URLs (one per line) or Name|URL format"
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={runBatchImport}
            disabled={discovering || !batchUrls.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {discovering ? 'Importing…' : 'Import & Scan'}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-400">No prospects yet.</p>
          <button
            type="button"
            onClick={() => { setTab('search'); runDiscovery(); }}
            className="mt-3 text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            Run discovery →
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <th className="pb-3 pr-4">Business</th>
                <th className="pb-3 pr-4">Market</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Tier</th>
                <th className="pb-3 pr-4">Est. MRR</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const opp = scoreOpportunity({
                  leadScore: p.lead_score,
                  scanScore: p.scan_score,
                  scanRiskLevel: p.scan_risk_level,
                  industry: p.industry,
                });
                return (
                  <tr key={p.id} className="border-b border-gray-800/50">
                    <td className="py-3 pr-4">
                      <p className="text-white">{p.business_name}</p>
                      <p className="text-xs text-gray-500">{p.website}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {[p.city, p.state, p.country].filter(Boolean).join(', ') || p.industry || '—'}
                    </td>
                    <td className="py-3 pr-4">
                      {p.scan_score !== null ? (
                        <span className="text-white">{p.scan_score}/100</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {p.lead_score && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${leadScoreColor(p.lead_score)}`}
                        >
                          {p.lead_score}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-emerald-400">
                      ${(p.estimated_mrr ?? opp.estimatedMrr).toLocaleString()}
                      <span className="ml-1 text-[10px] text-gray-500">
                        {p.conversion_likelihood ?? opp.conversionLikelihood}%
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => runScan(p.id)}
                        disabled={scanning === p.id}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
                      >
                        {scanning === p.id ? 'Scanning…' : p.scan_status === 'completed' ? 'Re-scan' : 'Run Scan'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
