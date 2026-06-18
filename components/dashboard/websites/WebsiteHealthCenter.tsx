'use client';

import { useState } from 'react';
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
  buildExecutiveSummary,
  domainDisplay,
  formatAlertForHealthCenter,
  formatRelativeScanTime,
  retentionMessage,
  rewriteHealthVerdict,
  securityScorePresentation,
  securityTrend,
  uptimeDisplay,
} from '@/lib/websiteHealth/healthCenterCopy';
import {
  monitoringEnabledBadgeClass,
  monitoringEnabledLabel,
  scanKindLabel,
  securityScoreBadgeClass,
  sslExpirySummary,
  computeHealthVerdict,
} from '@/lib/websiteHealth/healthStatus';

interface WebsiteHealthCenterProps {
  data: WebsiteHealthCenterData;
  displayLabel: string;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  return formatRelativeScanTime(iso);
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

function executiveToneClass(tone: 'good' | 'warn' | 'bad' | 'neutral'): string {
  switch (tone) {
    case 'good':
      return 'text-green-300';
    case 'warn':
      return 'text-yellow-300';
    case 'bad':
      return 'text-red-300';
    default:
      return 'text-gray-300';
  }
}

function executiveBannerClass(tone: 'good' | 'warn' | 'bad' | 'neutral'): string {
  switch (tone) {
    case 'good':
      return 'border-green-500/30 bg-green-500/10';
    case 'warn':
      return 'border-yellow-500/30 bg-yellow-500/10';
    case 'bad':
      return 'border-red-500/30 bg-red-500/10';
    default:
      return 'border-gray-700 bg-gray-900/50';
  }
}

function trendDirectionClass(direction: 'improving' | 'stable' | 'declining' | 'unknown'): string {
  switch (direction) {
    case 'improving':
      return 'text-green-300';
    case 'declining':
      return 'text-red-300';
    case 'stable':
      return 'text-gray-300';
    default:
      return 'text-gray-400';
  }
}

function trendDirectionIcon(direction: 'improving' | 'stable' | 'declining' | 'unknown'): string {
  switch (direction) {
    case 'improving':
      return '↑';
    case 'declining':
      return '↓';
    case 'stable':
      return '→';
    default:
      return '—';
  }
}

function verdictBannerClass(verdict: string): string {
  switch (verdict) {
    case 'all_clear':
      return 'border-green-500/30 bg-green-500/10';
    case 'minor_issues':
      return 'border-yellow-500/30 bg-yellow-500/10';
    case 'attention_needed':
      return 'border-orange-500/30 bg-orange-500/10';
    default:
      return 'border-red-500/30 bg-red-500/10';
  }
}

function verdictTextClass(verdict: string): string {
  switch (verdict) {
    case 'all_clear':
      return 'text-green-300';
    case 'minor_issues':
      return 'text-yellow-300';
    case 'attention_needed':
      return 'text-orange-300';
    default:
      return 'text-red-300';
  }
}

export default function WebsiteHealthCenter({ data, displayLabel }: WebsiteHealthCenterProps) {
  const { website, security, ssl, domain, uptime, monitoring, recentChanges, alerts } = data;
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const hasCriticalAlerts = alerts.recent.some((a) => a.severity === 'critical');
  const verdictResult = computeHealthVerdict({
    securityScore: security.score,
    sslStatus: ssl.status,
    domainStatus: domain.status,
    uptimeStatus: uptime.status,
    unreadAlerts: alerts.unreadCount,
    hasCriticalAlerts,
  });

  const domainView = domainDisplay(domain.status, domain.checkedAt, domain.message);
  const uptimeView = uptimeDisplay(uptime.status, uptime.httpStatus);
  const securityView = securityScorePresentation(security.score);
  const trend = securityTrend(security.score, security.previousScore);
  const rewrittenVerdict = rewriteHealthVerdict({
    verdict: verdictResult.verdict,
    securityScore: security.score,
    unreadAlerts: alerts.unreadCount,
    uptimeCollecting: uptimeView.isCollecting,
    domainInitializing: domainView.isInitializing,
    recentChangeCount: recentChanges.length,
  });
  const executiveSummary = buildExecutiveSummary(data, rewrittenVerdict.label, verdictResult.verdict);
  const retention = retentionMessage(data);

  const monitoringDetail = monitoring.enabled
    ? monitoring.priorityMonitoring
      ? 'Priority monitoring — checked every 5 minutes'
      : 'Standard monitoring — checked hourly'
    : 'Monitoring is paused for this website';

  const lastCheckDetail = monitoring.lastCheckAt
    ? `Last check ${formatRelativeTime(monitoring.lastCheckAt)}${
        monitoring.scanKind ? ` · ${scanKindLabel(monitoring.scanKind)}` : ''
      }`
    : 'Checks begin automatically after onboarding';

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
          Mission control for this website — protection score, SSL, domain, uptime, changes, and
          recommended actions in one place.
        </p>
      </div>

      <section className={`rounded-xl border p-6 ${executiveBannerClass(executiveSummary.overallTone)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Overall Website Health
        </p>
        <p className={`mt-2 text-lg font-semibold ${executiveToneClass(executiveSummary.overallTone)}`}>
          {executiveSummary.overallLabel}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Last full scan: {executiveSummary.lastFullScanLabel}
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {executiveSummary.rows.map((row) => (
            <div key={row.label} className="rounded-lg border border-gray-800/80 bg-gray-900/40 px-3 py-2.5">
              <dt className="text-xs text-gray-500">{row.label}</dt>
              <dd className={`mt-1 text-sm font-semibold ${executiveToneClass(row.tone)}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Security Score
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {securityView.score !== null ? (
                <span className="text-3xl font-bold text-white">{securityView.score}/100</span>
              ) : (
                <span className="text-sm font-medium text-gray-300">Awaiting first scan</span>
              )}
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${securityScoreBadgeClass(securityView.score)}`}
              >
                {securityView.band}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-gray-300">{securityView.explanation}</p>
            {securityView.contributors.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-gray-500">
                {securityView.contributors.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Estimated effort to improve:{' '}
              <span className="font-medium text-gray-300">{securityView.effort}</span>
            </p>
            {security.completedAt && (
              <p className="mt-2 text-xs text-gray-500">
                Last full scan {formatRelativeTime(security.completedAt)}
              </p>
            )}
          </div>
          {security.scanId && (
            <Link
              href={`/report/${security.scanId}`}
              className="inline-flex shrink-0 items-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
            >
              Improve Score →
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Domain</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${domainView.badgeClass}`}
            >
              {domainView.badge}
            </span>
            <span className="text-lg font-semibold text-white">{domainView.headline}</span>
          </div>
          <p className="mt-2 text-sm text-gray-300">{domainView.message}</p>
          {domain.domain && !domainView.isInitializing && (
            <p className="mt-2 text-xs text-gray-500">
              {domain.domain}
              {domain.registrar ? ` · ${domain.registrar}` : ''}
              {domain.daysUntilExpiry !== null
                ? ` · ${domain.daysUntilExpiry} day${domain.daysUntilExpiry === 1 ? '' : 's'} until expiry`
                : ''}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Uptime</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${uptimeView.badgeClass}`}
            >
              {uptimeView.badge}
            </span>
            <span className="text-lg font-semibold text-white">{uptimeView.headline}</span>
          </div>
          <p className="mt-2 text-sm text-gray-300">{uptimeView.message}</p>
          {!uptimeView.isCollecting && uptime.responseTimeMs != null && (
            <p className="mt-2 text-xs text-gray-500">
              Response time {uptime.responseTimeMs}ms
              {uptime.lastCheckedAt ? ` · Checked ${formatRelativeTime(uptime.lastCheckedAt)}` : ''}
            </p>
          )}
        </section>
      </div>

      <section className={`rounded-xl border p-5 ${verdictBannerClass(verdictResult.verdict)}`}>
        <p className={`text-sm font-semibold ${verdictTextClass(verdictResult.verdict)}`}>
          {rewrittenVerdict.label}
        </p>
        <p className="mt-2 text-sm text-gray-300">{rewrittenVerdict.intro}</p>
        {rewrittenVerdict.attentionAreas.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-gray-400">
            {rewrittenVerdict.attentionAreas.map((area) => (
              <li key={area}>· {area}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-400">
          <span className="font-medium text-gray-300">Next step:</span> {rewrittenVerdict.nextStep}
        </p>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Security Trend
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {trend.currentScore !== null ? (
            <span className="text-2xl font-bold text-white">{trend.currentScore}/100</span>
          ) : (
            <span className="text-sm text-gray-400">No score yet</span>
          )}
          <span className={`text-lg font-semibold ${trendDirectionClass(trend.direction)}`}>
            {trendDirectionIcon(trend.direction)}
          </span>
        </div>
        <p className={`mt-2 text-sm ${trendDirectionClass(trend.direction)}`}>{trend.deltaLabel}</p>
        {trend.previousScore !== null && (
          <p className="mt-1 text-xs text-gray-500">
            Previous full scan: {trend.previousScore}/100
          </p>
        )}
      </section>

      {retention && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-5 py-4">
          <p className="text-sm text-green-300">{retention}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SSL</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${sslStatusBadgeClass(ssl.status)}`}
            >
              {sslStatusLabel(ssl.status)}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-300">{sslExpirySummary(ssl.daysUntilExpiry, ssl.status)}</p>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Monitoring</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${monitoringEnabledBadgeClass(monitoring.enabled)}`}
            >
              {monitoringEnabledLabel(monitoring.enabled)}
            </span>
            <span className="text-sm text-gray-400">
              {monitoring.priorityMonitoring ? 'Priority' : monitoring.enabled ? 'Standard' : 'Paused'}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {monitoringDetail}. {lastCheckDetail}
          </p>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        {security.scanId && (
          <Link
            href={`/report/${security.scanId}`}
            className="inline-flex items-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
          >
            View latest security report →
          </Link>
        )}
        <Link
          href={`/app/websites/${website.id}/changes`}
          className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800/80"
        >
          View Website Memory →
        </Link>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Changes</h3>
            <p className="mt-1 text-xs text-gray-500">
              Important changes CyberShield detected in the last 30 days
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
            No important changes detected in the last 30 days. CyberShield continues monitoring
            automatically and will surface meaningful updates here.
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
                    <span className="text-xs text-blue-400/90">{change.categoryLabel}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-white">{change.title}</p>
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
            <h3 className="text-sm font-semibold text-white">Recommended Actions</h3>
            <p className="mt-1 text-xs text-gray-500">Unread alerts and improvements to review</p>
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
          <ul className="space-y-3">
            {alerts.recent.map((alert) => {
              const view = formatAlertForHealthCenter(alert);
              const isExpanded = expandedAlertId === alert.id;

              return (
                <li
                  key={alert.id}
                  className="rounded-lg border border-gray-800 bg-gray-800/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${alertSeverityClass(view.severity)}`}
                    >
                      {view.severity}
                    </span>
                    <span className="text-xs text-gray-500">{formatRelativeTime(alert.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{view.title}</p>
                  <p className="mt-1 text-sm text-gray-400">{view.summary}</p>
                  <button
                    type="button"
                    onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                    className="mt-2 text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    {isExpanded ? 'Hide details' : 'Why this matters'}
                  </button>
                  {isExpanded && (
                    <div className="mt-3 space-y-2 rounded-lg border border-gray-700/80 bg-gray-900/50 px-3 py-3">
                      <p className="text-xs text-gray-400">{view.whyItMatters}</p>
                      <p className="text-xs text-gray-300">
                        <span className="font-medium text-gray-200">Recommended action:</span>{' '}
                        {view.recommendedAction}
                      </p>
                      {alert.scanId && (
                        <Link
                          href={`/report/${alert.scanId}`}
                          className="inline-block text-xs text-blue-400 hover:text-blue-300"
                        >
                          View related report →
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
