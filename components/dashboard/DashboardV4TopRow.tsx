import Link from 'next/link';
import {
  DASHBOARD_V4_COPY,
  type CommandCenterData,
  type NeedsAttentionItem,
} from '@/lib/dashboard/dashboardCommandCenter';

interface DashboardV4TopRowProps {
  data: CommandCenterData;
}

function severityBadgeClass(severity: NeedsAttentionItem['severity']): string {
  if (severity === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (severity === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  if (severity === 'medium') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
  return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

function trendClass(trend: number | null): string {
  if (trend === null) return 'text-gray-400';
  if (trend > 0) return 'text-green-400';
  if (trend < 0) return 'text-red-400';
  return 'text-gray-300';
}

export default function DashboardV4TopRow({ data }: DashboardV4TopRowProps) {
  const { orgHealth, activeMonitoring, needsAttention, websites } = data;
  const monitoringEnabled = !/no automated monitoring/i.test(data.planMonitoringLabel ?? '');
  const topIssue = needsAttention[0] ?? null;
  const topIssueSite = topIssue
    ? websites.find((w) => w.displayName === topIssue.websiteName)
    : null;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {/* 1. Website Health */}
      <article className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-950/40 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          {DASHBOARD_V4_COPY.websiteHealthTitle}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gray-700 bg-gray-800/80">
            <span className={`text-2xl font-bold ${orgHealth.overallBand.textClass}`}>
              {orgHealth.overallScore !== null ? orgHealth.overallScore : '—'}
            </span>
          </div>
          <div>
            <p className={`text-lg font-semibold ${orgHealth.overallBand.textClass}`}>
              {orgHealth.overallBand.label}
            </p>
            <p className={`text-sm ${trendClass(orgHealth.monthlyTrend)}`}>
              {orgHealth.monthlyTrendLabel}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <HealthCount label="Healthy" value={orgHealth.healthy} tone="text-green-400" />
          <HealthCount label="Needs attention" value={orgHealth.needsAttention} tone="text-orange-400" />
          <HealthCount label="Critical" value={orgHealth.critical} tone="text-red-400" />
        </div>
        <p className="mt-4 text-xs text-gray-500">
          {orgHealth.monitored} website{orgHealth.monitored === 1 ? '' : 's'} under protection
        </p>
      </article>

      {/* 2. Monitoring */}
      <article className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
        <p
          className={`text-xs font-semibold uppercase tracking-widest ${
            monitoringEnabled ? 'text-emerald-400' : 'text-gray-400'
          }`}
        >
          {monitoringEnabled ? DASHBOARD_V4_COPY.monitoringActiveTitle : 'Monitoring — upgrade to enable'}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {monitoringEnabled
            ? DASHBOARD_V4_COPY.monitoringActiveSubtitle
            : 'Your plan includes manual scans only. Upgrade to a paid plan for continuous SSL, domain, uptime, and configuration monitoring.'}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4">
          <Metric label="Checks completed" value={String(activeMonitoring.checksCompleted)} />
          <Metric label="Changes detected" value={String(activeMonitoring.changesDetected)} />
          <Metric
            label="SSL issues"
            value={String(activeMonitoring.sslWarnings)}
            detail={activeMonitoring.sslWarnings === 0 ? 'All healthy' : 'Review recommended'}
            detailTone={activeMonitoring.sslWarnings === 0 ? 'text-green-400' : 'text-orange-400'}
          />
          <Metric
            label="Domain issues"
            value={String(activeMonitoring.domainWarnings)}
            detail={activeMonitoring.domainWarnings === 0 ? 'All healthy' : 'Review recommended'}
            detailTone={activeMonitoring.domainWarnings === 0 ? 'text-green-400' : 'text-orange-400'}
          />
        </dl>
        <p className="mt-4 text-xs text-gray-500">
          Last activity · {activeMonitoring.lastActivityLabel}
        </p>
      </article>

      {/* 3. Immediate Attention */}
      <article className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
          {DASHBOARD_V4_COPY.immediateAttentionTitle}
        </p>
        {topIssue ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClass(topIssue.severity)}`}
              >
                {topIssue.severity}
              </span>
              <span className="text-xs text-gray-500">{topIssue.websiteName}</span>
              {topIssueSite?.score !== null && topIssueSite?.score !== undefined && (
                <span className="text-xs font-medium text-gray-400">
                  {topIssueSite.score}/100
                </span>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{topIssue.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">{topIssue.whyItMatters}</p>
            <Link
              href={topIssue.actionHref}
              className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Open Health Center
            </Link>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm font-medium text-green-300">All clear</p>
            <p className="mt-2 text-xs text-gray-400">
              No urgent items — CyberShield continues monitoring your websites automatically.
            </p>
            {websites[0] && (
              <Link
                href={`/app/websites/${websites[0].id}/health`}
                className="mt-4 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Open Health Center →
              </Link>
            )}
          </div>
        )}
      </article>
    </section>
  );
}

function HealthCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/30 px-2 py-2 text-center">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  detailTone,
}: {
  label: string;
  value: string;
  detail?: string;
  detailTone?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold text-white">{value}</dd>
      {detail && (
        <dd className={`mt-0.5 text-xs ${detailTone ?? 'text-gray-400'}`}>{detail}</dd>
      )}
    </div>
  );
}
