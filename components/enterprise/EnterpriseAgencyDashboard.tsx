import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CyberShieldValueSummary from '@/components/dashboard/CyberShieldValueSummary';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import RetentionBanner from '@/components/dashboard/RetentionBanner';
import EnterpriseExportPdfButton from '@/components/enterprise/EnterpriseExportPdfButton';
import ScanAllButton from '@/components/dashboard/ScanAllButton';
import { CollapsiblePanel } from '@/components/enterprise/overview/EnterpriseOverviewPanels';
import {
  ENTERPRISE_COMMAND_CENTER_COPY,
  type EnterpriseCommandCenterData,
  type EnterpriseWebsiteRow,
  type NeedsAttentionClient,
  type OrgInsight,
} from '@/lib/enterprise/enterpriseCommandCenter';
import AgencyClientReportPanel from '@/components/intelligence/AgencyClientReportPanel';
import AgencyPortfolioHealthCard from '@/components/agency/AgencyClientWebsitesView';
import AgencyProofOfWorkCard from '@/components/agency/AgencyProofOfWorkCard';
import AgencyInsightsPanel from '@/components/agency/AgencyDashboardPanels';
import { buildAgencyInsights, buildPortfolioHealthSummary } from '@/lib/agency/agencyInsights';

const mobileActionClass =
  'inline-flex min-h-[48px] w-full items-center justify-center rounded-lg px-4 py-3.5 text-sm font-medium sm:w-auto sm:min-h-0 sm:py-2';

function orgStatusClass(status: EnterpriseCommandCenterData['orgSummary']['orgStatus']): string {
  switch (status) {
    case 'Protected':
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'Review Recommended':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

function insightToneClass(tone: OrgInsight['tone']): string {
  if (tone === 'good') return 'text-green-400';
  if (tone === 'warn') return 'text-orange-400';
  return 'text-gray-300';
}

function AgencySectionHeader({
  title,
  subtitle,
  whatHappened,
  whyItMatters,
  whatNext,
}: {
  title: string;
  subtitle?: string;
  whatHappened: string;
  whyItMatters: string;
  whatNext: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-semibold text-white sm:text-sm">{title}</h3>
      {subtitle && <p className="mt-1 hidden text-sm text-gray-500 sm:block">{subtitle}</p>}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-gray-950/40 px-3 py-2.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">What happened</dt>
          <dd className="mt-1 text-gray-300">{whatHappened}</dd>
        </div>
        <div className="rounded-lg bg-gray-950/40 px-3 py-2.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Why it matters</dt>
          <dd className="mt-1 text-gray-300">{whyItMatters}</dd>
        </div>
        <div className="rounded-lg bg-gray-950/40 px-3 py-2.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">What next</dt>
          <dd className="mt-1 text-gray-300">{whatNext}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function EnterpriseAgencyDashboard({ data }: { data: EnterpriseCommandCenterData }) {
  const { orgSummary, valueMetrics, advancedDiagnostics } = data;
  const allWebsites: EnterpriseWebsiteRow[] = [
    ...data.protectedWebsites,
    ...data.needsAttention
      .filter((c) => !data.protectedWebsites.some((w) => w.id === c.id))
      .map((c) => ({
        id: c.id,
        displayName: c.displayName,
        url: '',
        clientGroup: c.clientName,
        score: c.score,
        scoreBand: c.scoreBand,
        healthCategory: (c.score !== null && c.score < 50 ? 'critical' : 'needs_attention') as EnterpriseWebsiteRow['healthCategory'],
        issueCount: c.issueCount,
        topIssue: c.topIssue,
        scanId: c.reportHref.includes('/report/') ? c.reportHref.split('/report/')[1] ?? null : null,
        sslStatus: 'unknown' as const,
        monitoringLabel: 'Active',
        recentChangesCount: 0,
        stabilityLabel: '',
        lastScanLabel: '',
      })),
  ];
  const portfolioHealth = buildPortfolioHealthSummary(allWebsites);
  const agencyInsights = buildAgencyInsights({
    websites: allWebsites,
    reportsReadyCount: allWebsites.filter((w) => w.scanId).length,
    monthlyTrend: data.insights.find((i) => i.label === 'Overall trend')?.value.includes('+')
      ? 1
      : null,
    topIssueCategories: data.insights.map((i) => i.value),
  });
  const featuredClient: EnterpriseWebsiteRow | undefined =
    data.needsAttention[0]
      ? data.protectedWebsites.find((w) => w.id === data.needsAttention[0]!.id) ??
        data.protectedWebsites[0]
      : data.protectedWebsites[0];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-auto">
      <DashboardHeader email={data.userEmail} title="Agency Command Center" showPlanUsage={false} />

      <main className="min-w-0 flex-1 overflow-x-hidden px-5 py-5 sm:p-6">
        <div className="flex flex-col gap-8">
          {/* 1. Organization Command Center */}
          <section className="min-w-0 rounded-2xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/40 to-gray-900/60 p-5 sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                  {ENTERPRISE_COMMAND_CENTER_COPY.title}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-xl font-bold text-white sm:text-2xl">
                    {data.orgName ?? 'Your Organization'}
                  </h2>
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-sm font-medium text-blue-300">
                    {data.planLabel}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-sm font-semibold ${orgStatusClass(orgSummary.orgStatus)}`}
                  >
                    {orgSummary.orgStatusLabel}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-300">{orgSummary.summaryLine}</p>
                <div className="flex flex-wrap items-end gap-4">
                  {orgSummary.overallScore !== null && (
                    <div>
                      <p className="text-xs text-gray-500">Overall score</p>
                      <p className="text-3xl font-bold text-white">
                        {orgSummary.overallScore}
                        <span className="text-lg text-gray-500">/100</span>
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${orgSummary.overallBand.badgeClass}`}
                      >
                        {orgSummary.overallBand.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto">
                {data.isAdmin && data.orgId && (
                  <>
                    <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                      <ScanAllButton />
                    </div>
                    <Link
                      href="/enterprise/portal/websites"
                      className={`${mobileActionClass} border border-gray-700 bg-gray-800/80 text-gray-200 hover:bg-gray-800`}
                    >
                      Manage websites
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetricPill label="Websites protected" value={String(orgSummary.websitesProtected)} />
              <MetricPill label="Needs attention" value={String(orgSummary.needsAttentionCount)} tone="text-orange-400" />
              <MetricPill label="Critical" value={String(orgSummary.criticalCount)} tone="text-red-400" />
              <MetricPill label="Checks this week" value={String(orgSummary.weekStats.checksCompleted)} />
              <MetricPill label="Issues this week" value={String(orgSummary.weekStats.issuesDetected)} />
              <MetricPill label="SSL alerts" value={String(orgSummary.weekStats.sslIssues)} />
            </div>
          </section>

          <AgencyPortfolioHealthCard summary={portfolioHealth} />

          <AgencyProofOfWorkCard
            metrics={valueMetrics}
            reportsGenerated={allWebsites.filter((w) => w.scanId).length}
            orgId={data.orgId}
          />

          {featuredClient && (
            <AgencyClientReportPanel
              clientName={featuredClient.displayName}
              siteUrl={featuredClient.url}
              siteLabel={featuredClient.displayName}
              securityScore={featuredClient.score ?? orgSummary.overallScore ?? 0}
              findings={[]}
              sslValid={featuredClient.sslStatus === 'healthy' ? true : featuredClient.sslStatus === 'critical' ? false : null}
              scansThisMonth={orgSummary.weekStats.checksCompleted}
              alertsThisMonth={orgSummary.weekStats.issuesDetected}
            />
          )}

          {data.isEmpty && (
            <div className="rounded-xl border border-dashed border-indigo-700/40 bg-indigo-950/20 px-5 py-8 text-center">
              <p className="text-sm font-medium text-indigo-200">No client websites yet</p>
              <p className="mt-2 text-sm text-gray-500">
                Add websites to start protecting clients with continuous monitoring and reports.
              </p>
              <Link
                href="/enterprise/portal/websites"
                className={`${mobileActionClass} mt-4 bg-indigo-600 text-white hover:bg-indigo-500`}
              >
                Add websites
              </Link>
            </div>
          )}

          {!data.isEmpty && (
            <>
              {orgSummary.orgStatus === 'Protected' && (
                <RetentionBanner
                  variant="protection"
                  detail="Client websites are under continuous monitoring. We will alert you when anything needs review."
                />
              )}

              {/* 2. What CyberShield Did For Your Clients */}
              <section className="min-w-0">
                <AgencySectionHeader
                  title={ENTERPRISE_COMMAND_CENTER_COPY.valueDeliveredTitle}
                  subtitle="Past 30 days of protection value across your client portfolio"
                  whatHappened={`${valueMetrics.checksCompleted} monitoring checks, ${valueMetrics.changesDetected} changes tracked, ${valueMetrics.sslCertificatesProtected} SSL certificates protected.`}
                  whyItMatters="Your clients stay protected without manual log reviews — issues surface before they become outages."
                  whatNext="Share wins in client QBRs or dive into clients that need review below."
                />
                <CyberShieldValueSummary
                  metrics={valueMetrics}
                  title={ENTERPRISE_COMMAND_CENTER_COPY.valueDeliveredTitle}
                  subtitle="Past 30 days of protection and intelligence for your clients"
                />
              </section>

              {/* 3. Clients Requiring Review */}
              <section className="min-w-0 rounded-xl border border-orange-800/30 bg-gray-900/50 p-5 sm:p-6">
                <AgencySectionHeader
                  title={ENTERPRISE_COMMAND_CENTER_COPY.needsAttentionTitle}
                  subtitle="Client properties that need a review before your next check-in"
                  whatHappened={`${data.needsAttention.length} propert${data.needsAttention.length === 1 ? 'y' : 'ies'} below your healthy threshold.`}
                  whyItMatters="Early review prevents client-facing incidents and strengthens your agency's trusted-advisor role."
                  whatNext="Open each report, prioritize fixes, and schedule client follow-ups."
                />
                {data.needsAttention.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    All monitored client sites are {ENTERPRISE_COMMAND_CENTER_COPY.healthy.toLowerCase()}. No review needed right now.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {data.needsAttention.map((client) => (
                      <NeedsAttentionCard key={client.id} client={client} />
                    ))}
                  </ul>
                )}
              </section>

              {/* 4. Protected Clients */}
              <section className="min-w-0 rounded-xl border border-green-800/20 bg-gray-900/50 p-5 sm:p-6">
                <AgencySectionHeader
                  title={ENTERPRISE_COMMAND_CENTER_COPY.protectedWebsitesTitle}
                  subtitle={`${ENTERPRISE_COMMAND_CENTER_COPY.healthy} sites with active monitoring`}
                  whatHappened={`${data.protectedWebsites.length} site${data.protectedWebsites.length === 1 ? '' : 's'} meeting your protection standard.`}
                  whyItMatters="These are proof points for client renewals and upsell conversations."
                  whatNext="Spot-check reports monthly and watch for configuration drift."
                />
                {data.protectedWebsites.length === 0 ? (
                  <p className="text-sm text-gray-500">No sites in the protected band yet — address items above first.</p>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {data.protectedWebsites.map((site) => (
                      <ProtectedWebsiteCard key={site.id} site={site} />
                    ))}
                  </ul>
                )}
              </section>

              {/* 5. Recent Client Intelligence */}
              <section className="min-w-0">
                <AgencySectionHeader
                  title={ENTERPRISE_COMMAND_CENTER_COPY.recentActivityTitle}
                  subtitle="Business-friendly timeline for client updates"
                  whatHappened={`${data.activityFeed.length} recent event${data.activityFeed.length === 1 ? '' : 's'} across your portfolio.`}
                  whyItMatters="Gives you talking points for client updates without digging through logs."
                  whatNext="Click any item to open the related report or alert."
                />
                <RecentActivityFeed
                  items={data.activityFeed}
                  emptyMessage="Activity will appear after your first monitoring checks complete."
                />
              </section>

              {/* 7. Organization Insights */}
              <section className="min-w-0 rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-5 sm:p-6">
                <AgencySectionHeader
                  title={ENTERPRISE_COMMAND_CENTER_COPY.orgInsightsTitle}
                  subtitle="Portfolio-level patterns for agency planning"
                  whatHappened="Aggregated from latest scans across all client sites."
                  whyItMatters="Focus your team's remediation time where it moves the most client scores."
                  whatNext="Use insights to plan sprint work and client QBR agendas."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AgencyInsightsPanel insights={agencyInsights} />
                </div>
              </section>

              {/* 8. Reports & Reviews */}
              <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/40 p-5 sm:p-6">
                <AgencySectionHeader
                  title={ENTERPRISE_COMMAND_CENTER_COPY.reportsTitle}
                  subtitle="Executive-ready outputs for clients and leadership"
                  whatHappened="Reports compile scan history, alerts, and trends automatically."
                  whyItMatters="Agencies win renewals with clear, professional security documentation."
                  whatNext="Generate or export before your next client review meeting."
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/app/reports"
                    className={`${mobileActionClass} border border-gray-700 text-gray-300 hover:text-white`}
                  >
                    View website reports
                  </Link>
                  {data.isAdmin && data.orgId && (
                    <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                      <EnterpriseExportPdfButton orgId={data.orgId} />
                    </div>
                  )}
                  <Link
                    href="/app/reports"
                    className={`${mobileActionClass} border border-indigo-700/50 bg-indigo-600/10 text-indigo-300 hover:text-white`}
                  >
                    Generate organization report
                  </Link>
                  <span
                    className={`${mobileActionClass} cursor-default border border-dashed border-gray-700 text-gray-500`}
                    title="Delivered automatically when enabled in notification preferences"
                  >
                    Monthly executive summary
                  </span>
                </div>
              </section>
            </>
          )}

          {/* 6. Advanced Monitoring Diagnostics — collapsed by default */}
          <section className="min-w-0">
            <CollapsiblePanel
              title={ENTERPRISE_COMMAND_CENTER_COPY.advancedDiagnosticsTitle}
              subtitle="Internal ops metrics for technical staff — hidden from client-facing view"
              defaultOpen={false}
              collapseOnMobile
            >
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <DiagnosticRow
                  label="Last automated monitoring run"
                  value={
                    advancedDiagnostics.lastCronAt
                      ? new Date(advancedDiagnostics.lastCronAt).toLocaleString()
                      : '—'
                  }
                />
                <DiagnosticRow label="Monitoring checks (24h)" value={String(advancedDiagnostics.scansLast24h)} />
                <DiagnosticRow label="Check failures (24h)" value={String(advancedDiagnostics.failedLast24h)} />
                <DiagnosticRow label="Pending checks" value={String(advancedDiagnostics.queuedScans)} />
                <DiagnosticRow
                  label="Recent change groups"
                  value={String(advancedDiagnostics.intelligenceSignalCount)}
                />
                {advancedDiagnostics.prioritySlotsLimit !== null && (
                  <DiagnosticRow
                    label="Priority monitoring slots"
                    value={`${advancedDiagnostics.prioritySlotsUsed ?? 0} / ${advancedDiagnostics.prioritySlotsLimit}`}
                  />
                )}
              </dl>
            </CollapsiblePanel>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricPill({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-950/40 p-3">
      <p className="truncate text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function NeedsAttentionCard({ client }: { client: NeedsAttentionClient }) {
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-lg border border-gray-800 bg-gray-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-white">{client.displayName}</p>
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{client.clientName}</span>
          {client.score !== null && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${client.scoreBand.badgeClass}`}
            >
              {client.score}/100
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-400">
          {client.issueCount} issue{client.issueCount === 1 ? '' : 's'} · {client.topIssue}
        </p>
        <p className="mt-2 text-xs text-gray-500">{client.whyItMatters}</p>
      </div>
      <Link
        href={client.reportHref}
        className={`${mobileActionClass} shrink-0 bg-indigo-600 text-white hover:bg-indigo-500`}
      >
        Review report
      </Link>
    </li>
  );
}

function ProtectedWebsiteCard({ site }: { site: EnterpriseWebsiteRow }) {
  return (
    <li className="rounded-lg border border-gray-800 bg-gray-950/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{site.displayName}</p>
          <p className="truncate text-xs text-gray-500">{site.clientGroup}</p>
        </div>
        {site.score !== null && (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${site.scoreBand.badgeClass}`}>
            {site.score}/100
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-gray-500">SSL</dt>
          <dd className="font-medium capitalize text-gray-300">
            {site.sslStatus === 'healthy' ? ENTERPRISE_COMMAND_CENTER_COPY.healthy : 'Review recommended'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Monitoring</dt>
          <dd className="font-medium text-gray-300">{site.monitoringLabel}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Changes</dt>
          <dd className="font-medium text-gray-300">{site.recentChangesCount} this week</dd>
        </div>
        <div>
          <dt className="text-gray-500">Stability</dt>
          <dd className="font-medium text-gray-300">{site.stabilityLabel}</dd>
        </div>
      </dl>
      {site.scanId && (
        <Link
          href={`/report/${site.scanId}`}
          className="mt-3 inline-flex text-xs font-medium text-indigo-400 hover:text-indigo-300"
        >
          View report
        </Link>
      )}
    </li>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium text-white">{value}</dd>
    </div>
  );
}
