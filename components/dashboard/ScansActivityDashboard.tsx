import Link from 'next/link';
import {
  buildWebsiteActivityCards,
  COMMAND_CENTER_COPY,
  type CommandCenterData,
} from '@/lib/dashboard/dashboardCommandCenter';
import { riskBadgeClass, formatRiskLevel } from '@/components/report/severityStyles';
import CyberShieldValueSummary from './CyberShieldValueSummary';
import RecentActivityFeed from './RecentActivityFeed';
import RetentionBanner from './RetentionBanner';

function healthStatusLabel(category: string): string {
  if (category === 'healthy') return 'Healthy';
  if (category === 'needs_attention') return 'Needs attention';
  if (category === 'critical') return 'Critical';
  return 'Pending';
}

function healthStatusClass(category: string): string {
  if (category === 'healthy') return 'text-green-400';
  if (category === 'needs_attention') return 'text-orange-400';
  if (category === 'critical') return 'text-red-400';
  return 'text-gray-400';
}

function WebsiteActivityCard({
  site,
}: {
  site: ReturnType<typeof buildWebsiteActivityCards>[number];
}) {
  const riskKey = site.riskLabel.toLowerCase();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">{site.displayName}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{site.url}</p>
        </div>
        {site.score !== null ? (
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-sm font-semibold ${site.scoreBand.badgeClass}`}
          >
            {site.score}/100 · {site.scoreBand.label}
          </span>
        ) : (
          <span className="inline-flex shrink-0 rounded-full border border-gray-600 bg-gray-800 px-3 py-1 text-xs text-gray-400">
            Not scanned
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-gray-500">Health</p>
          <p className={`mt-0.5 font-medium capitalize ${healthStatusClass(site.healthCategory)}`}>
            {healthStatusLabel(site.healthCategory)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Risk</p>
          <span
            className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskBadgeClass(riskKey)}`}
          >
            {formatRiskLevel(riskKey === 'not scored' ? 'unknown' : riskKey)}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-2">
          <p className="text-gray-500">Top issue</p>
          <p className="mt-0.5 line-clamp-2 font-medium text-gray-300">{site.topIssue}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">Recommended action</p>
        <Link
          href={site.actionHref}
          className="mt-0.5 inline-flex text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          {site.recommendedAction} →
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href={`/app/websites/${site.id}/health`}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 hover:text-white sm:flex-none"
        >
          Health Center
        </Link>
        <Link
          href={site.latestScanId ? `/report/${site.latestScanId}` : `/app/websites/${site.id}/health`}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 hover:text-white sm:flex-none"
        >
          Report
        </Link>
      </div>
    </div>
  );
}

function MonitoringSummaryCard({ data }: { data: CommandCenterData }) {
  const m = data.valueSummary;

  return (
    <section className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-gray-900/60 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-white">Monitoring Activity Summary</h3>
      <p className="mt-1 text-sm text-gray-400">
        Past 7 days of continuous protection across your websites.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryPill label="Security checks" value={m.checksCompleted} />
        <SummaryPill label="Meaningful changes" value={m.meaningfulChanges} />
        <SummaryPill label="SSL / domain issues" value={m.sslDomainIssues} tone="warn" />
        <SummaryPill label="Downtime events" value={m.downtimeEvents} tone={m.downtimeEvents > 0 ? 'bad' : undefined} />
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Last activity: {data.lastActivityLabel}
      </p>
    </section>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warn' | 'bad';
}) {
  const valueClass =
    tone === 'bad' ? 'text-red-400' : tone === 'warn' && value > 0 ? 'text-orange-400' : 'text-white';

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2.5 text-center">
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/30 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
        <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white">No monitoring activity yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
        Add a website to start continuous security monitoring. Activity and reports will appear here automatically.
      </p>
      <Link
        href="/app/websites"
        className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
      >
        Add Website
      </Link>
    </div>
  );
}

export default function ScansActivityDashboard({ data }: { data: CommandCenterData }) {
  const activityCards = buildWebsiteActivityCards(data.websites, data.needsAttention);

  if (data.isEmpty) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      {data.showRetentionBanner && <RetentionBanner />}

      <MonitoringSummaryCard data={data} />

      <CyberShieldValueSummary metrics={data.valueSummary} compact />

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {COMMAND_CENTER_COPY.recentActivityTitle}
        </h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activityCards.map((site) => (
            <WebsiteActivityCard key={site.id} site={site} />
          ))}
        </div>
      </section>

      <RecentActivityFeed items={data.activityFeed} />

      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <h3 className="text-sm font-semibold text-white">Next step</h3>
        <p className="mt-1 text-sm text-gray-400">
          Review any items needing attention, then share reports with your team.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/app/alerts"
            className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 hover:text-white"
          >
            View Alerts
          </Link>
          <Link
            href="/app/reports"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            View Reports
          </Link>
        </div>
      </section>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Security Monitoring</p>
      <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">Recent Security Activity</h2>
      <p className="mt-2 text-sm text-gray-400">
        Outcome-focused view of your monitored websites — scores, risks, and recommended actions.
      </p>
    </div>
  );
}
