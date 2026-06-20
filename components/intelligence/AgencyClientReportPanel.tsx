'use client';

import { useMemo, useState } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import {
  formatAgencyReportPlainText,
  generateAgencyClientReport,
} from '@/lib/intelligence/agencyReport';
import {
  buildClientOwnerEmail,
  buildClientOwnerReport,
  formatClientEmailForClipboard,
} from '@/lib/agency/clientOwnerExport';
import { buildDeveloperHandoff } from '@/lib/intelligence/prioritization';

interface AgencyClientReportPanelProps {
  clientName: string;
  siteUrl: string;
  siteLabel: string;
  securityScore: number;
  findings: SecurityFinding[];
  sslValid?: boolean | null;
  scansThisMonth?: number;
  alertsThisMonth?: number;
  agencyName?: string | null;
  contactName?: string | null;
}

export default function AgencyClientReportPanel(props: AgencyClientReportPanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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
  const ownerReport = useMemo(
    () =>
      buildClientOwnerReport({
        clientName: props.clientName,
        contactName: props.contactName ?? 'there',
        websiteLabel: props.siteLabel,
        siteUrl: props.siteUrl,
        securityScore: props.securityScore,
        agencyName: props.agencyName,
        report,
        sslStatus:
          props.sslValid === true
            ? 'healthy'
            : props.sslValid === false
              ? 'critical'
              : 'unknown',
      }),
    [props, report],
  );
  const clientEmail = useMemo(
    () =>
      buildClientOwnerEmail({
        clientName: props.clientName,
        contactName: props.contactName ?? 'there',
        websiteLabel: props.siteLabel,
        siteUrl: props.siteUrl,
        securityScore: props.securityScore,
        agencyName: props.agencyName,
        report,
      }),
    [props, report],
  );
  const developerHandoff = useMemo(() => buildDeveloperHandoff(props.findings), [props.findings]);

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadText(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
          Client-ready report
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/10"
          >
            {previewOpen ? 'Hide preview' : 'Preview report'}
          </button>
          <button
            type="button"
            onClick={() => copyText(report.clientSummary, 'summary')}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
          >
            {copied === 'summary' ? 'Copied' : 'Copy summary'}
          </button>
          <button
            type="button"
            onClick={() => copyText(ownerReport, 'owner')}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
          >
            {copied === 'owner' ? 'Copied' : 'Export for website owner'}
          </button>
          <button
            type="button"
            onClick={() =>
              copyText(formatClientEmailForClipboard(clientEmail), 'email')
            }
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
          >
            {copied === 'email' ? 'Copied' : 'Copy client email'}
          </button>
          <button
            type="button"
            onClick={() => copyText(developerHandoff, 'dev')}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
          >
            {copied === 'dev' ? 'Copied' : 'Copy fix list'}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(`${props.siteLabel.replace(/\s+/g, '-')}-client-report.txt`, ownerReport)
            }
            className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/10"
          >
            Download report
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-300">{report.clientSummary}</p>
      <p className="mt-2 text-xs text-gray-500">
        Copy only — CyberShield does not send emails automatically.
      </p>
      {previewOpen && (
        <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-gray-800 bg-gray-950/80 p-3 text-xs whitespace-pre-wrap text-gray-400">
          {plain}
        </pre>
      )}
    </div>
  );
}
