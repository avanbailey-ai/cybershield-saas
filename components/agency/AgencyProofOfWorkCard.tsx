'use client';

import { useState } from 'react';
import type { EnterpriseValueMetrics } from '@/lib/enterprise/enterpriseCommandCenter';

interface AgencyProofOfWorkCardProps {
  metrics: EnterpriseValueMetrics;
  reportsGenerated: number;
  orgId: string | null;
}

export default function AgencyProofOfWorkCard({
  metrics,
  reportsGenerated,
  orgId,
}: AgencyProofOfWorkCardProps) {
  const [copied, setCopied] = useState(false);

  const exportText = [
    'CyberShield Proof of Work — Last 30 Days',
    '',
    `Monitoring checks completed: ${metrics.checksCompleted}`,
    `Scans run: ${metrics.checksCompleted}`,
    `Changes detected: ${metrics.changesDetected}`,
    `SSL/domain checks: ${metrics.sslCertificatesProtected} certificates protected`,
    `Issues flagged: ${metrics.sslDomainIssues + metrics.domainRisksFlagged}`,
    `Reports generated: ${reportsGenerated}`,
    `Websites monitored: ${metrics.websitesMonitored}`,
    '',
    'Use this summary to document ongoing care-plan value for clients.',
  ].join('\n');

  async function copyProofOfWork() {
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Monthly Proof-of-Work</p>
        <button
          type="button"
          onClick={copyProofOfWork}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white"
        >
          {copied ? 'Copied' : 'Copy proof-of-work'}
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-400">Last 30 days across your client portfolio</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Scans completed" value={String(metrics.checksCompleted)} />
        <Metric label="Changes detected" value={String(metrics.changesDetected)} />
        <Metric label="SSL checks" value={String(metrics.sslCertificatesProtected)} />
        <Metric label="Reports generated" value={String(reportsGenerated)} />
        <Metric label="Issues found" value={String(metrics.sslDomainIssues + metrics.domainRisksFlagged)} />
        <Metric label="Sites monitored" value={String(metrics.websitesMonitored)} />
      </dl>
      {!orgId && (
        <p className="mt-4 text-xs text-gray-500">
          Proof-of-work appears after CyberShield monitors client sites over time.
        </p>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
    </div>
  );
}
