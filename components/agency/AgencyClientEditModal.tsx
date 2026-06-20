'use client';

import { useEffect, useState } from 'react';
import type { AgencyClientWebsiteRow } from '@/components/agency/AgencyClientWebsitesView';

const REPORT_FREQUENCIES = [
  { value: '', label: 'Not set' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
] as const;

const CLIENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
] as const;

type ClientContextForm = {
  client_name: string;
  client_company: string;
  client_contact_name: string;
  client_contact_email: string;
  client_report_frequency: string;
  client_status: string;
  client_notes: string;
  agency_internal_notes: string;
};

function rowToForm(row: AgencyClientWebsiteRow): ClientContextForm {
  return {
    client_name: row.clientNameRaw ?? '',
    client_company: row.clientCompany ?? '',
    client_contact_name: row.clientContactName ?? '',
    client_contact_email: row.clientContactEmail ?? '',
    client_report_frequency: row.clientReportFrequency ?? '',
    client_status: row.clientStatus ?? 'active',
    client_notes: row.clientNotes ?? '',
    agency_internal_notes: row.agencyInternalNotes ?? '',
  };
}

function isValidEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

interface AgencyClientEditModalProps {
  row: AgencyClientWebsiteRow | null;
  onClose: () => void;
  onSaved: (websiteId: string, updates: Partial<AgencyClientWebsiteRow>) => void;
}

export default function AgencyClientEditModal({ row, onClose, onSaved }: AgencyClientEditModalProps) {
  const [form, setForm] = useState<ClientContextForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (row) {
      setForm(rowToForm(row));
      setError(null);
      setSuccess(false);
    } else {
      setForm(null);
    }
  }, [row]);

  if (!row || !form) return null;

  const setField = (field: keyof ClientContextForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(form.client_contact_email)) {
      setError('Enter a valid contact email or leave blank.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: Record<string, string | null> = {
        client_name: form.client_name.trim() || null,
        client_company: form.client_company.trim() || null,
        client_contact_name: form.client_contact_name.trim() || null,
        client_contact_email: form.client_contact_email.trim() || null,
        client_report_frequency: form.client_report_frequency.trim() || null,
        client_status: form.client_status.trim() || 'active',
        client_notes: form.client_notes.trim() || null,
        agency_internal_notes: form.agency_internal_notes.trim() || null,
      };

      const res = await fetch(`/api/websites/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as Record<string, string | null> & { error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Failed to save client context.');
        return;
      }

      setSuccess(true);
      onSaved(row.id, {
        clientName: data.client_name?.trim() || row.displayName,
        clientNameRaw: data.client_name ?? '',
        clientCompany: data.client_company ?? '',
        clientContactName: data.client_contact_name ?? '',
        clientContactEmail: data.client_contact_email ?? '',
        clientReportFrequency: data.client_report_frequency ?? '',
        clientStatus: data.client_status ?? 'active',
        clientNotes: data.client_notes ?? '',
        agencyInternalNotes: data.agency_internal_notes ?? '',
      });
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-edit-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-700 bg-gray-950 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="client-edit-title" className="text-lg font-semibold text-white">
              Edit client
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {row.displayName} · {row.url}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Client name" id="client_name">
            <input
              id="client_name"
              type="text"
              value={form.client_name}
              onChange={(e) => setField('client_name', e.target.value)}
              className={inputClass}
              placeholder="Acme Corp"
            />
          </Field>

          <Field label="Client company" id="client_company">
            <input
              id="client_company"
              type="text"
              value={form.client_company}
              onChange={(e) => setField('client_company', e.target.value)}
              className={inputClass}
              placeholder="Acme Inc."
            />
          </Field>

          <Field label="Contact name" id="client_contact_name">
            <input
              id="client_contact_name"
              type="text"
              value={form.client_contact_name}
              onChange={(e) => setField('client_contact_name', e.target.value)}
              className={inputClass}
              placeholder="Jane Smith"
            />
          </Field>

          <Field label="Contact email" id="client_contact_email">
            <input
              id="client_contact_email"
              type="email"
              value={form.client_contact_email}
              onChange={(e) => setField('client_contact_email', e.target.value)}
              className={inputClass}
              placeholder="client@example.com"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Report frequency" id="client_report_frequency">
              <select
                id="client_report_frequency"
                value={form.client_report_frequency}
                onChange={(e) => setField('client_report_frequency', e.target.value)}
                className={inputClass}
              >
                {REPORT_FREQUENCIES.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Client status" id="client_status">
              <select
                id="client_status"
                value={form.client_status}
                onChange={(e) => setField('client_status', e.target.value)}
                className={inputClass}
              >
                {CLIENT_STATUSES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Client notes" id="client_notes" hint="Visible in agency context — not auto-sent to clients">
            <textarea
              id="client_notes"
              rows={3}
              value={form.client_notes}
              onChange={(e) => setField('client_notes', e.target.value)}
              className={inputClass}
              placeholder="QBR talking points, renewal date, etc."
            />
          </Field>

          <Field
            label="Agency internal notes"
            id="agency_internal_notes"
            hint="Internal only — never included in client exports"
          >
            <textarea
              id="agency_internal_notes"
              rows={3}
              value={form.agency_internal_notes}
              onChange={(e) => setField('agency_internal_notes', e.target.value)}
              className={inputClass}
              placeholder="Internal workflow notes"
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-lg border border-green-800/50 bg-green-950/40 px-3 py-2 text-sm text-green-300" role="status">
              Client context saved.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wider text-gray-400">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-600">{hint}</p>}
    </div>
  );
}
