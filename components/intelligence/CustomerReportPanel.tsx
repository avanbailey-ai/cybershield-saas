'use client';

import { useMemo, useState } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import {
  formatCustomerReportPlainText,
  generateCustomerReport,
} from '@/lib/intelligence/customerReport';
import type { SecurityIntelligenceReport } from '@/lib/securityIntelligence/types';

interface CustomerReportPanelProps {
  siteLabel: string;
  siteUrl: string;
  report: SecurityIntelligenceReport;
  findings: SecurityFinding[];
  sslValid?: boolean | null;
  planLevel?: 'free' | 'pro' | 'growth' | 'agency' | 'enterprise';
}

export default function CustomerReportPanel(props: CustomerReportPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const generated = useMemo(
    () =>
      generateCustomerReport({
        siteLabel: props.siteLabel,
        siteUrl: props.siteUrl,
        report: props.report,
        findings: props.findings,
        sslValid: props.sslValid,
        planLevel: props.planLevel,
      }),
    [props],
  );

  const plainText = useMemo(() => formatCustomerReportPlainText(generated), [generated]);

  async function copyReport() {
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/20"
      >
        Plain-English summary
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Plain-English report</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyReport}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
          >
            {copied ? 'Copied' : 'Copy full report'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400"
          >
            Close
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-300">{generated.executiveSummary}</p>
      <p className="mt-2 text-sm text-gray-400">{generated.healthStatement}</p>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Fix this first</p>
        <ul className="mt-2 space-y-1 text-sm text-gray-300">
          {generated.fixThisFirst.items.map((item) => (
            <li key={item.id}>
              {item.rank}. {item.title} — {item.whyItMatters}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
