'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import { leadScoreColor } from '@/lib/owner/leadScore';
import { CRM_STAGES, type OwnerCrmLead, type CrmStage } from '@/lib/owner/types';

export default function LeadCrm({ initialLeads }: { initialLeads: OwnerCrmLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [form, setForm] = useState({
    business_name: '',
    website: '',
    industry: '',
    contact_name: '',
    potential_revenue: '',
  });

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/owner/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        potential_revenue: form.potential_revenue ? Number(form.potential_revenue) : null,
      }),
    });
    const data = await res.json();
    if (data.lead) {
      setLeads((l) => [data.lead, ...l]);
      setForm({ business_name: '', website: '', industry: '', contact_name: '', potential_revenue: '' });
    }
  }

  async function updateStage(id: string, stage: CrmStage) {
    const res = await fetch(`/api/owner/crm/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, last_contact_at: new Date().toISOString() }),
    });
    const data = await res.json();
    if (data.lead) setLeads((l) => l.map((x) => (x.id === id ? data.lead : x)));
  }

  return (
    <SectionCard id="crm" title="Lead CRM" subtitle="Pipeline from New Lead to Customer">
      <form onSubmit={addLead} className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <input
          placeholder="Business"
          value={form.business_name}
          onChange={(e) => setForm({ ...form, business_name: e.target.value })}
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
          placeholder="Industry"
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <input
          placeholder="Contact"
          value={form.contact_name}
          onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <input
          placeholder="Revenue $"
          value={form.potential_revenue}
          onChange={(e) => setForm({ ...form, potential_revenue: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Add Lead
        </button>
      </form>

      {leads.length === 0 ? (
        <p className="text-sm text-gray-500">No CRM leads yet.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-800 bg-gray-950/50 p-4"
            >
              <div className="min-w-[140px] flex-1">
                <p className="font-medium text-white">{lead.business_name}</p>
                <p className="text-xs text-gray-500">
                  {lead.website ?? '—'} · {lead.industry ?? '—'}
                </p>
              </div>
              {lead.lead_score && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${leadScoreColor(lead.lead_score)}`}
                >
                  {lead.lead_score}
                </span>
              )}
              {lead.potential_revenue && (
                <span className="text-sm text-emerald-400">
                  ${Number(lead.potential_revenue).toLocaleString()}
                </span>
              )}
              <select
                value={lead.stage}
                onChange={(e) => updateStage(lead.id, e.target.value as CrmStage)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white"
              >
                {CRM_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
