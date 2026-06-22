import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  COMMAND_CENTER_COPY,
  DASHBOARD_V4_COPY,
  type CommandCenterData,
  type CommandCenterWebsite,
} from '@/lib/dashboard/dashboardCommandCenter';
import CommandCenterQuickActions from './CommandCenterQuickActions';
import RetentionBanner from './RetentionBanner';
import CyberShieldValueSummary from './CyberShieldValueSummary';
import RecentActivityFeed from './RecentActivityFeed';
import DashboardV4TopRow from './DashboardV4TopRow';

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
            Awaiting first check
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
          <p className="text-gray-500">Review items</p>
          <p className="mt-0.5 font-medium text-gray-300">{site.actionCount}</p>
        </div>
        <div>
          <p className="text-gray-500">Meaningful changes</p>
          <p className="mt-0.5 font-medium text-gray-300">{site.meaningfulChangesCount}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href={site.latestScanId ? `/report/${site.latestScanId}` : `/app/websites/${site.id}/health`}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 hover:border-blue-500/50 sm:flex-none"
        >
          Open Report
        </Link>
        <Link
          href="/app/websites"
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 sm:flex-none"
        >
          Run Scan
        </Link>
        <Link
          href={`/app/websites/${site.id}/changes`}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 sm:flex-none"
        >
          View History
        </Link>
        <Link
          href={`/app/websites/${site.id}/health`}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 sm:flex-none"
        >
          Health Center
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/30 px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-white">{COMMAND_CENTER_COPY.emptyTitle}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{COMMAND_CENTER_COPY.emptySubtitle}</p>
      <Link
        href="/app/websites"
        className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
      >
        Add Website
      </Link>
    </div>
  );
}

function StatusAndPlanRow({ data }: { data: CommandCenterData }) {
  const { orgHealth, planUsage, agencyOverview, activeMonitoring } = data;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-950/40 p-5 sm:p-6 lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Current Status</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-700 bg-gray-800/80">
            <span className={`text-2xl font-bold ${orgHealth.overallBand.textClass}`}>
              {orgHealth.overallScore ?? '—'}
            </span>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{data.overallStatusLabel}</p>
            <p className="text-sm text-gray-400">
              {orgHealth.monitored} website{orgHealth.monitored === 1 ? '' : 's'} · Last check{' '}
              {activeMonitoring.lastSuccessfulCheckLabel}
            </p>
            <p className="mt-1 text-xs text-gray-500">{activeMonitoring.monitoringCadence}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-gray-300">{data.protectionSummary}</p>
      </article>

      <article className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {DASHBOARD_V4_COPY.planUsageTitle}
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Plan</dt>
            <dd className="font-medium text-white">{planUsage.planLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Websites</dt>
            <dd className="font-medium text-white">
              {planUsage.websitesUsed}
              {planUsage.websiteLimit !== null ? ` / ${planUsage.websiteLimit}` : ''}
            </dd>
          </div>
          {planUsage.manualScansRemaining !== null && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Manual deep scans left</dt>
              <dd className="font-medium text-white">
                {planUsage.manualScansRemaining}
                {planUsage.manualScansLimit !== null ? ` / ${planUsage.manualScansLimit} today` : ''}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Account</dt>
            <dd>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${accountStatusClass(data.accountStatus)}`}
              >
                {data.accountStatus}
              </span>
            </dd>
          </div>
        </dl>
        {agencyOverview && (
          <div className="mt-4 border-t border-gray-800 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Agency overview</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-400">
              <li>{agencyOverview.clientReadyReports} client-ready reports</li>
              <li>{agencyOverview.sitesNeedingAttention} sites needing attention</li>
              <li>{agencyOverview.sitesWithMeaningfulChanges} sites with meaningful changes</li>
              {agencyOverview.sitesWithoutRecentScans > 0 && (
                <li>{agencyOverview.sitesWithoutRecentScans} without a scan in 7+ days</li>
              )}
            </ul>
            <Link href="/app/reports" className="mt-3 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300">
              Client reports →
            </Link>
          </div>
        )}
      </article>
    </section>
  );
}

function ScanComparisonPanel({ data }: { data: CommandCenterData }) {
  const c = data.scanComparison;
  if (!c.primaryWebsiteName) return null;

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {DASHBOARD_V4_COPY.scanComparisonTitle}
      </h3>
      <p className="mt-2 text-sm font-medium text-white">{c.scoreChangeLabel}</p>
      {c.hasPreviousScan && c.previousScore !== null && c.currentScore !== null && (
        <p className="mt-1 text-sm text-gray-400">
          {c.previousScore} → {c.currentScore}
          {c.scoreDelta !== null && c.scoreDelta !== 0
            ? ` (${c.scoreDelta > 0 ? '+' : ''}${c.scoreDelta} pts)`
            : ''}
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {c.highlights.map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm text-gray-300">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
        <span>Meaningful changes: {c.meaningfulChangesCount}</span>
        {c.baselineDataPointsCount > 0 && (
          <span>Baseline data captured: {c.baselineDataPointsCount}</span>
        )}
      </div>
      {c.reportHref && (
        <Link href={c.reportHref} className="mt-4 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300">
          Open full report →
        </Link>
      )}
    </section>
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
      <StatusAndPlanRow data={data} />
      <DashboardV4TopRow data={data} />
      <ScanComparisonPanel data={data} />
      <CyberShieldValueSummary metrics={data.valueSummary} />
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
      <RecentActivityFeed
        items={data.groupedActivity.map((g) => ({
          id: g.id,
          title: g.title,
          detail: g.detail,
          timeLabel: g.timeLabel,
          tone: g.tone,
          href: g.href,
        }))}
        title={DASHBOARD_V4_COPY.recentIntelligenceTitle}
        viewAllHref="/app/alerts"
        emptyMessage="Meaningful activity will appear here — score changes, new findings, SSL issues, and failed checks."
      />
      <QuickActionsSection />
    </div>
  );
}

function CommandCenterHeader({ data }: { data: CommandCenterData }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-5 py-4 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
        {COMMAND_CENTER_COPY.title}
      </p>
      <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
        Welcome back, <span className="text-blue-400">{data.userDisplayName}</span>
      </h2>
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
