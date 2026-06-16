'use client';

import { useState } from 'react';

interface EnterpriseExportPdfButtonProps {
  orgId: string;
  disabled?: boolean;
}

export default function EnterpriseExportPdfButton({
  orgId,
  disabled = false,
}: EnterpriseExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);

    try {
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
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'CyberShield-Security-Posture-Report.pdf';

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
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
        className="rounded-lg border border-emerald-700/50 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Generating PDF…' : 'Export SOC2 Report (PDF)'}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
