import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  COMMAND_CENTER_COPY,
  DASHBOARD_V4_COPY,
  SCORE_BANDS,
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
          <p className="text-gray-500">Last check</p>
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
          Intelligence Report
        </Link>
        <Link
          href={`/app/websites/${site.id}/changes`}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 hover:text-white sm:flex-none"
        >
          Website Memory
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
          Continuous website monitoring with change detection
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          SSL and domain expiry alerts before they become outages
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          Executive-ready intelligence you can share with your team
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

      <DashboardV4TopRow data={data} />

      <RecentActivityFeed
        items={data.activityFeed}
        title={DASHBOARD_V4_COPY.recentIntelligenceTitle}
        viewAllHref="/app/websites"
        emptyMessage="Intelligence will appear here after your first monitoring check — SSL events, score changes, and website updates."
      />

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

      <QuickActionsSection />
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
            {data.isEmpty ? COMMAND_CENTER_COPY.emptySubtitle : COMMAND_CENTER_COPY.welcomeMonitoring}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <HeaderStat label="Last activity" value={data.lastActivityLabel} />
          <HeaderStat
            label="Account status"
            value={data.accountStatus}
            badgeClass={accountStatusClass(data.accountStatus)}
          />
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
