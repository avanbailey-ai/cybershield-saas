import type { CommandCenterData } from '@/lib/dashboard/dashboardCommandCenter';
import Link from 'next/link';

interface DashboardMonitoringOverviewProps {
  data: CommandCenterData;
}

function trendClass(trend: number | null): string {
  if (trend === null) return 'text-gray-400';
  if (trend > 0) return 'text-green-400';
  if (trend < 0) return 'text-red-400';
  return 'text-gray-300';
}

function trendLabel(trend: number | null, label: string): string {
  if (trend === null) return label;
  if (trend > 0) return `↑ ${label}`;
  if (trend < 0) return `↓ ${label}`;
  return label;
}

export default function DashboardMonitoringOverview({ data }: DashboardMonitoringOverviewProps) {
  const { activeMonitoring, orgHealth, valueSummary, websites } = data;
  const totalRecentChanges = websites.reduce((sum, w) => sum + w.recentChangesCount, 0);
  const sitesWithChanges = websites.filter((w) => w.recentChangesCount > 0);

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Monitoring at a glance</h3>
          <p className="mt-1 text-sm text-gray-500">
            CyberShield remembers your websites — SSL, uptime, changes, and score trends.
          </p>
        </div>
        {sitesWithChanges.length > 0 && (
          <Link
            href={`/app/websites/${sitesWithChanges[0].id}/changes`}
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            View Change Timeline →
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <OverviewCell
          label="Security score trend"
          value={
            orgHealth.overallScore !== null ? `${orgHealth.overallScore}/100` : '—'
          }
          detail={trendLabel(orgHealth.monthlyTrend, orgHealth.monthlyTrendLabel)}
          detailClass={trendClass(orgHealth.monthlyTrend)}
        />
        <OverviewCell
          label="SSL warnings"
          value={String(activeMonitoring.sslWarnings)}
          detail={
            activeMonitoring.sslWarnings > 0
              ? 'Certificates need attention'
              : 'All certificates healthy'
          }
          detailClass={activeMonitoring.sslWarnings > 0 ? 'text-orange-400' : 'text-green-400'}
        />
        <OverviewCell
          label="Domain warnings"
          value={String(activeMonitoring.domainWarnings)}
          detail={
            activeMonitoring.domainWarnings > 0
              ? 'Registration expiry risk'
              : 'Registrations healthy'
          }
          detailClass={activeMonitoring.domainWarnings > 0 ? 'text-orange-400' : 'text-green-400'}
        />
        <OverviewCell
          label="Uptime (7d)"
          value={`${valueSummary.sitesAllOnline}/${valueSummary.websitesMonitored}`}
          detail={
            valueSummary.downtimeEvents > 0
              ? `${valueSummary.downtimeEvents} downtime event${valueSummary.downtimeEvents === 1 ? '' : 's'}`
              : 'All sites online'
          }
          detailClass={valueSummary.downtimeEvents > 0 ? 'text-red-400' : 'text-green-400'}
        />
        <OverviewCell
          label="Recent changes"
          value={String(totalRecentChanges)}
          detail={
            totalRecentChanges > 0
              ? 'Review on Change Timeline'
              : 'No changes detected recently'
          }
          detailClass={totalRecentChanges > 0 ? 'text-yellow-400' : 'text-gray-400'}
        />
      </div>
    </section>
  );
}

function OverviewCell({
  label,
  value,
  detail,
  detailClass,
}: {
  label: string;
  value: string;
  detail: string;
  detailClass?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/30 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className={`mt-1 text-xs ${detailClass ?? 'text-gray-400'}`}>{detail}</p>
    </div>
  );
}
