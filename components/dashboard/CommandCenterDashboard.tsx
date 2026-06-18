import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  COMMAND_CENTER_COPY,
  SCORE_BANDS,
  type CommandCenterData,
  type CommandCenterWebsite,
} from '@/lib/dashboard/dashboardCommandCenter';
import CommandCenterQuickActions from './CommandCenterQuickActions';
import RetentionBanner from './RetentionBanner';
import CyberShieldValueSummary from './CyberShieldValueSummary';
import RecentActivityFeed from './RecentActivityFeed';
import DashboardMonitoringOverview from './DashboardMonitoringOverview';

function accountStatusClass(status: CommandCenterData['accountStatus']): string {
  switch (status) {
    case 'Protected':
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'Action needed':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

function severityBadgeClass(severity: string): string {
  if (severity === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (severity === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  if (severity === 'medium') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
  return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

function activityToneClass(tone: string): string {
  if (tone === 'good') return 'border-green-500/20 bg-green-500/5';
  if (tone === 'warn') return 'border-orange-500/20 bg-orange-500/5';
  if (tone === 'bad') return 'border-red-500/20 bg-red-500/5';
  return 'border-gray-800 bg-gray-800/40';
}

function WebsiteCard({ site }: { site: CommandCenterWebsite }) {
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
          <p className="text-gray-500">Monitoring</p>
          <p className="mt-0.5 font-medium text-gray-300">{site.monitoringLabel}</p>
        </div>
        <div>
          <p className="text-gray-500">Last scan</p>
          <p className="mt-0.5 font-medium text-gray-300">{site.lastScanLabel}</p>
        </div>
        <div>
          <p className="text-gray-500">Recent changes</p>
          <p className="mt-0.5 font-medium text-gray-300">{site.recentChangesCount}</p>
        </div>
        <div>
          <p className="text-gray-500">Status</p>
          <p className={`mt-0.5 font-medium capitalize ${site.scoreBand.textClass}`}>
            {site.healthCategory === 'unknown' ? 'Pending' : site.healthCategory.replace('_', ' ')}
          </p>
        </div>
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
        <Link
          href={`/app/websites/${site.id}/changes`}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 hover:text-white sm:flex-none"
        >
          Changes
        </Link>
      </div>
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
      <h3 className="text-lg font-semibold text-white">{COMMAND_CENTER_COPY.emptyTitle}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{COMMAND_CENTER_COPY.emptySubtitle}</p>
      <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-gray-400">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          Continuous security monitoring with change detection
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          SSL and domain expiry alerts before they become outages
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          Executive-ready reports you can share with your team
        </li>
      </ul>
      <Link
        href="/app/websites"
        className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
      >
        Add Website
      </Link>
    </div>
  );
}

export default function CommandCenterDashboard({ data }: { data: CommandCenterData }) {
  if (data.isEmpty) {
    return (
      <div className="space-y-6">
        <CommandCenterHeader data={data} />
        <EmptyState />
        <QuickActionsSection />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CommandCenterHeader data={data} />

      {data.showRetentionBanner && <RetentionBanner variant="memory" />}

      <DashboardMonitoringOverview data={data} />

      <CyberShieldValueSummary metrics={data.valueSummary} />

      <OrgHealthCard data={data} />

      <RecentActivityFeed
        items={data.activityFeed}
        title="Recent Changes & Activity"
        viewAllHref="/app/scans"
        emptyMessage="Activity will appear here after your first security check — SSL events, score changes, and website updates."
      />

      <QuickActionsSection />

      {data.websites.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Monitored Websites
          </h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.websites.map((site) => (
              <WebsiteCard key={site.id} site={site} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ActiveMonitoringCard data={data} />
        <ScoreContextCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SecurityWinsCard wins={data.securityWins} />
        <NeedsAttentionCard items={data.needsAttention} />
      </div>
    </div>
  );
}

function CommandCenterHeader({ data }: { data: CommandCenterData }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            {COMMAND_CENTER_COPY.title}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            Welcome back, <span className="text-blue-400">{data.userDisplayName}</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-gray-400">
            {data.isEmpty
              ? COMMAND_CENTER_COPY.emptySubtitle
              : COMMAND_CENTER_COPY.welcomeMonitoring}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <HeaderStat label="Last activity" value={data.lastActivityLabel} />
          <HeaderStat label="Account status" value={data.accountStatus} badgeClass={accountStatusClass(data.accountStatus)} />
          <HeaderStat label="Plan" value={data.planLabel} />
          <HeaderStat label="Monitoring" value={data.planMonitoringLabel} />
        </div>
      </div>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  badgeClass,
}: {
  label: string;
  value: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {badgeClass ? (
        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
          {value}
        </span>
      ) : (
        <p className="mt-1 text-xs font-semibold text-white sm:text-sm">{value}</p>
      )}
    </div>
  );
}

function OrgHealthCard({ data }: { data: CommandCenterData }) {
  const { orgHealth } = data;
  return (
    <Card variant="highlight" className="border-gray-800 bg-gray-900/60">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{COMMAND_CENTER_COPY.orgHealthTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-gray-700 bg-gray-800/80">
              <span className={`text-2xl font-bold ${orgHealth.overallBand.textClass}`}>
                {orgHealth.overallScore !== null ? orgHealth.overallScore : '—'}
              </span>
            </div>
            <div>
              <p className={`text-lg font-semibold ${orgHealth.overallBand.textClass}`}>
                {orgHealth.overallBand.label}
              </p>
              <p className="text-sm text-gray-400">{orgHealth.monthlyTrendLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <CountPill label="Monitored" value={orgHealth.monitored} />
            <CountPill label="Healthy" value={orgHealth.healthy} tone="good" />
            <CountPill label="Needs attention" value={orgHealth.needsAttention} tone="warn" />
            <CountPill label="Critical" value={orgHealth.critical} tone="bad" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CountPill({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'good'
      ? 'text-green-400'
      : tone === 'warn'
        ? 'text-orange-400'
        : tone === 'bad'
          ? 'text-red-400'
          : 'text-white';
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2 text-center">
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function QuickActionsSection() {
  return (
    <Card className="bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">{COMMAND_CENTER_COPY.quickActionsTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <CommandCenterQuickActions />
      </CardContent>
    </Card>
  );
}

function ActiveMonitoringCard({ data }: { data: CommandCenterData }) {
  const m = data.activeMonitoring;
  return (
    <Card className="bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">{COMMAND_CENTER_COPY.activeMonitoringTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <MetricRow label="Websites monitored" value={String(m.websitesMonitored)} />
          <MetricRow label="Checks completed" value={String(m.checksCompleted)} />
          <MetricRow label="Changes detected" value={String(m.changesDetected)} />
          <MetricRow label="SSL warnings" value={String(m.sslWarnings)} />
          <MetricRow label="Domain warnings" value={String(m.domainWarnings)} />
          <MetricRow label="Last activity" value={m.lastActivityLabel} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ScoreContextCard() {
  return (
    <Card className="bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">{COMMAND_CENTER_COPY.scoreContextTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {SCORE_BANDS.map((band) => (
            <li key={band.key} className="flex items-center justify-between text-sm">
              <span className={`font-medium ${band.textClass}`}>{band.label}</span>
              <span className="text-gray-500">
                {band.min}–{band.max}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SecurityWinsCard({ wins }: { wins: CommandCenterData['securityWins'] }) {
  return (
    <Card className="bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">{COMMAND_CENTER_COPY.securityWinsTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {wins.map((win) => (
            <li key={win.label} className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-white">{win.label}</p>
                <p className="text-xs text-gray-400">{win.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NeedsAttentionCard({ items }: { items: CommandCenterData['needsAttention'] }) {
  return (
    <Card className="bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">{COMMAND_CENTER_COPY.needsAttentionTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No urgent items — your monitored sites look good.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClass(item.severity)}`}
                  >
                    {item.severity}
                  </span>
                  <span className="text-xs text-gray-500">{item.websiteName}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-white">{item.title}</p>
                <p className="mt-1 text-xs text-gray-400">{item.whyItMatters}</p>
                <Link
                  href={item.actionHref}
                  className="mt-2 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  {item.actionLabel} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
