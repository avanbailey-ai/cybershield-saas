import Link from 'next/link';
import {
  sslStatusBadgeClass,
  sslStatusLabel,
} from '@/lib/ssl/sslStatus';
import type { SslDashboardSummary } from '@/lib/ssl/fetchSslDashboardSummary';

interface SslStatusWidgetProps {
  summary: SslDashboardSummary;
}

function formatExpiry(days: number | null, expiresAt: string | null): string {
  if (days === null || expiresAt === null) return 'Not checked yet';
  if (days <= 0) return 'Expired';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days remaining`;
}

export default function SslStatusWidget({ summary }: SslStatusWidgetProps) {
  const attentionSites = summary.sites.filter(
    (s) => s.status === 'critical' || s.status === 'warning',
  ).slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">SSL Status</h3>
          <p className="mt-1 text-xs text-gray-500">
            Certificate health across your monitored websites
          </p>
        </div>
        <Link href="/app/websites" className="text-xs text-blue-400 hover:text-blue-300">
          View sites
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-center">
          <p className="text-lg font-bold text-green-300">{summary.healthy}</p>
          <p className="text-xs text-gray-500">Healthy</p>
        </div>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-center">
          <p className="text-lg font-bold text-yellow-300">{summary.warning}</p>
          <p className="text-xs text-gray-500">Warning</p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-center">
          <p className="text-lg font-bold text-red-300">{summary.critical}</p>
          <p className="text-xs text-gray-500">Critical</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-2 text-center">
          <p className="text-lg font-bold text-gray-300">{summary.unknown}</p>
          <p className="text-xs text-gray-500">Unknown</p>
        </div>
      </div>

      {attentionSites.length === 0 ? (
        <p className="text-sm text-gray-400">
          All checked certificates look healthy. CyberShield will alert you at 30, 14, 7, and 3 days
          before expiry.
        </p>
      ) : (
        <ul className="space-y-2">
          {attentionSites.map((site) => {
            const label = site.label ?? site.url;
            return (
              <li
                key={site.websiteId}
                className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-800/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-gray-500">{formatExpiry(site.daysUntilExpiry, site.expiresAt)}</p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${sslStatusBadgeClass(site.status)}`}
                >
                  {sslStatusLabel(site.status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
