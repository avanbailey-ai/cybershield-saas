'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import { leadScoreColor } from '@/lib/owner/leadScore';
import type { OwnerProspect } from '@/lib/owner/types';

export default function LeadDiscovery({ initialProspects }: { initialProspects: OwnerProspect[] }) {
  const [prospects, setProspects] = useState(initialProspects);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [form, setForm] = useState({
    business_name: '',
    website: '',
    industry: '',
    city: '',
  });

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
        setForm({ business_name: '', website: '', industry: '', city: '' });
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
      title="Lead Discovery Engine"
      subtitle="Add prospects and run security scans to compute lead scores"
    >
      <form onSubmit={addProspect} className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? 'Adding…' : 'Add Prospect'}
        </button>
      </form>

      {prospects.length === 0 ? (
        <p className="text-sm text-gray-500">No prospects yet. Add your first target above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <th className="pb-3 pr-4">Business</th>
                <th className="pb-3 pr-4">Website</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Lead</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50">
                  <td className="py-3 pr-4 text-white">{p.business_name}</td>
                  <td className="py-3 pr-4 text-gray-400">{p.website}</td>
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
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => runScan(p.id)}
                      disabled={scanning === p.id}
                      className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
                    >
                      {scanning === p.id ? 'Scanning…' : 'Run Scan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
