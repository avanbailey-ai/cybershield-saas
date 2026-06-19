'use client';

import { useMemo, useState } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import {
  formatAgencyReportPlainText,
  generateAgencyClientReport,
} from '@/lib/intelligence/agencyReport';

interface AgencyClientReportPanelProps {
  clientName: string;
  siteUrl: string;
  siteLabel: string;
  securityScore: number;
  findings: SecurityFinding[];
  sslValid?: boolean | null;
  scansThisMonth?: number;
  alertsThisMonth?: number;
}

export default function AgencyClientReportPanel(props: AgencyClientReportPanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const report = useMemo(
    () =>
      generateAgencyClientReport({
        clientName: props.clientName,
        siteUrl: props.siteUrl,
        siteLabel: props.siteLabel,
        securityScore: props.securityScore,
        findings: props.findings,
        sslValid: props.sslValid,
        scansThisMonth: props.scansThisMonth,
        alertsThisMonth: props.alertsThisMonth,
      }),
    [props],
  );

  const plain = useMemo(() => formatAgencyReportPlainText(report), [report]);

  async function copyClientSummary() {
    await navigator.clipboard.writeText(report.clientSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
          Client-ready intelligence
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/10"
          >
            {previewOpen ? 'Hide monthly preview' : 'Monthly report preview'}
          </button>
          <button
            type="button"
            onClick={copyClientSummary}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
          >
            {copied ? 'Copied' : 'Copy client explanation'}
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-300">{report.clientSummary}</p>
      {previewOpen && (
        <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-gray-800 bg-gray-950/80 p-3 text-xs whitespace-pre-wrap text-gray-400">
          {plain}
        </pre>
      )}
    </div>
  );
}
