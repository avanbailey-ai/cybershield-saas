'use client';

import { useState } from 'react';

interface EnterpriseExportPdfButtonProps {
  orgId: string;
  disabled?: boolean;
}

async function requestPdfExport(orgId: string): Promise<{ ok: true; blob: Blob; filename: string } | { ok: false; status: number }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  const res = await fetch('/api/enterprise/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_id: orgId,
      date_range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    }),
  });

  if (!res.ok) {
    return { ok: false, status: res.status };
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'CyberShield-Security-Posture-Report.pdf';

  return { ok: true, blob, filename };
}

export default function EnterpriseExportPdfButton({
  orgId,
  disabled = false,
}: EnterpriseExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let result = await requestPdfExport(orgId);

      if (!result.ok && result.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        result = await requestPdfExport(orgId);
      }

      if (!result.ok) {
        throw new Error('export_failed');
      }

      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setSuccess('Security posture report downloaded.');
    } catch {
      setError('Export failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || loading || !orgId}
        aria-label="Export organization security posture report as PDF"
        className="rounded-lg border border-emerald-700/50 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Generating PDF…' : 'Export security posture report (PDF)'}
      </button>
      {disabled && !loading && (
        <p className="max-w-xs text-right text-xs text-gray-500">Requires organization admin access and scan data.</p>
      )}
      {success && (
        <div className="max-w-xs text-right">
          <p className="text-xs text-emerald-400">{success}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Includes the last 30 days of scans, alerts, and organization risk trends.
          </p>
        </div>
      )}
      {error && (
        <p className="max-w-xs text-right text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
