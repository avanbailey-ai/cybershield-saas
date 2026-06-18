'use client';

import Link from 'next/link';
import {
  formatTimelineTimestamp,
  severityBadgeClass,
} from '@/lib/scanChanges/changeTimeline';
import {
  sslStatusBadgeClass,
  sslStatusLabel,
} from '@/lib/ssl/sslStatus';
import type { WebsiteHealthCenterData } from '@/lib/websiteHealth/fetchWebsiteHealthCenter';
import {
  domainStatusBadgeClass,
  domainStatusLabel,
  monitoringEnabledBadgeClass,
  monitoringEnabledLabel,
  riskLevelLabel,
  scanKindLabel,
  securityScoreBadgeClass,
  securityScoreLabel,
  sslExpirySummary,
  uptimeStatusBadgeClass,
  uptimeStatusLabel,
} from '@/lib/websiteHealth/healthStatus';

interface WebsiteHealthCenterProps {
  data: WebsiteHealthCenterData;
  displayLabel: string;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function alertSeverityClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

function StatusCard({
  title,
  subtitle,
  badge,
  badgeClass,
  detail,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeClass: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${badgeClass}`}
        >
          {badge}
        </span>
        {dataHasScore(subtitle) ? (
          <span className="text-2xl font-bold text-white">{subtitle}</span>
        ) : (
          <span className="text-sm font-medium text-gray-300">{subtitle}</span>
        )}
      </div>
      {detail && <p className="mt-2 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

function dataHasScore(text: string): boolean {
  return /^\d+\/100$/.test(text);
}

export default function WebsiteHealthCenter({ data, displayLabel }: WebsiteHealthCenterProps) {
  const { website, security, ssl, domain, uptime, monitoring, recentChanges, alerts } = data;

  const monitoringDetail = monitoring.enabled
    ? monitoring.priorityMonitoring
      ? 'Priority monitoring — checked every 5 minutes'
      : 'Standard monitoring — checked hourly'
    : 'Monitoring is paused for this website';

  const lastCheckDetail = monitoring.lastCheckAt
    ? `Last check ${formatRelativeTime(monitoring.lastCheckAt)}${
        monitoring.scanKind ? ` · ${scanKindLabel(monitoring.scanKind)}` : ''
      }`
    : 'No checks recorded yet';

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/app/websites"
          className="text-sm text-gray-500 transition-colors hover:text-gray-300"
        >
          ← Back to websites
        </Link>
        <h2 className="mt-3 text-xl font-bold text-white">Website Health Center</h2>
        <p className="mt-1 text-sm text-gray-400">
          {displayLabel}
          <span className="mx-2 text-gray-600">·</span>
          <span className="text-gray-500">{website.url}</span>
        </p>
        <p className="mt-2 text-sm text-gray-500">
          One place to see security, SSL, uptime, and alerts for this site.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard
          title="Security Score"
          subtitle={security.score !== null ? `${security.score}/100` : 'Not scanned'}
          badge={securityScoreLabel(security.score)}
          badgeClass={securityScoreBadgeClass(security.score)}
          detail={
            security.completedAt
              ? `Last full scan ${formatRelativeTime(security.completedAt)}${
                  security.riskLevel ? ` · ${riskLevelLabel(security.riskLevel)}` : ''
                }`
              : 'Run a scan to get your security score'
          }
        />

        <StatusCard
          title="SSL Status"
          subtitle={sslStatusLabel(ssl.status)}
          badge={ssl.status === 'healthy' ? 'OK' : sslStatusLabel(ssl.status)}
          badgeClass={sslStatusBadgeClass(ssl.status)}
          detail={sslExpirySummary(ssl.daysUntilExpiry, ssl.status)}
        />

        <StatusCard
          title="Domain Status"
          subtitle={domainStatusLabel(domain.status)}
          badge="Coming soon"
          badgeClass={domainStatusBadgeClass(domain.status)}
          detail={domain.message}
        />

        <StatusCard
          title="Uptime Status"
          subtitle={uptimeStatusLabel(uptime.status)}
          badge={uptime.httpStatus !== null ? `HTTP ${uptime.httpStatus}` : uptimeStatusLabel(uptime.status)}
          badgeClass={uptimeStatusBadgeClass(uptime.status)}
          detail={
            uptime.httpStatus !== null
              ? `HTTP ${uptime.httpStatus}${
                  uptime.responseTimeMs ? ` · ${uptime.responseTimeMs}ms response` : ''
                }`
              : uptime.lastCheckedAt
                ? `Checked ${formatRelativeTime(uptime.lastCheckedAt)}`
                : 'No uptime data yet'
          }
        />

        <StatusCard
          title="Monitoring"
          subtitle={monitoringEnabledLabel(monitoring.enabled)}
          badge={monitoring.priorityMonitoring ? 'Priority' : monitoring.enabled ? 'Standard' : 'Off'}
          badgeClass={monitoringEnabledBadgeClass(monitoring.enabled)}
          detail={`${monitoringDetail}. ${lastCheckDetail}`}
        />

        <StatusCard
          title="Active Alerts"
          subtitle={alerts.unreadCount === 0 ? 'All clear' : `${alerts.unreadCount} unread`}
          badge={alerts.unreadCount === 0 ? 'None' : `${alerts.unreadCount}`}
          badgeClass={
            alerts.unreadCount === 0
              ? 'bg-green-500/15 text-green-300 border-green-500/30'
              : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
          }
          detail={
            alerts.unreadCount === 0
              ? 'No open alerts for this website'
              : 'Review alerts below or visit the alerts page'
          }
        />
      </div>

      {security.scanId && (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/report/${security.scanId}`}
            className="inline-flex items-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
          >
            View latest security report →
          </Link>
          <Link
            href={`/app/websites/${website.id}/changes`}
            className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800/80"
          >
            View change timeline →
          </Link>
        </div>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Changes</h3>
            <p className="mt-1 text-xs text-gray-500">
              What CyberShield detected on this site in the last 30 days
            </p>
          </div>
          <Link
            href={`/app/websites/${website.id}/changes`}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View all
          </Link>
        </div>

        {recentChanges.length === 0 ? (
          <p className="text-sm text-gray-400">
            No recent changes detected. That&apos;s good news — or we may still be collecting
            baseline data.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentChanges.map((change) => (
              <li
                key={change.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-800/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${severityBadgeClass(change.severity)}`}
                    >
                      {change.severity}
                    </span>
                    <span className="text-xs text-blue-400/90">{change.category}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-white">{change.summary}</p>
                  <p className="text-xs text-gray-500">{formatTimelineTimestamp(change.detectedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Active Alerts</h3>
            <p className="mt-1 text-xs text-gray-500">Unread alerts for this website</p>
          </div>
          <Link href="/app/alerts" className="text-xs text-blue-400 hover:text-blue-300">
            All alerts
          </Link>
        </div>

        {alerts.recent.length === 0 ? (
          <p className="text-sm text-gray-400">
            No unread alerts. CyberShield will notify you when something needs attention.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.recent.map((alert) => (
              <li
                key={alert.id}
                className="rounded-lg border border-gray-800 bg-gray-800/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${alertSeverityClass(alert.severity)}`}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-500">{formatRelativeTime(alert.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-white">{alert.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{alert.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
