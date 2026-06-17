import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { RISK_BUCKET_DISPLAY } from "@/lib/enterprise/orgDashboardSummary";
import { POSTURE_DISPLAY, type PostureState } from "@/lib/enterprise/postureState";
import { scoreToRiskBucket } from "@/lib/enterprise/enterpriseTypes";
import type {
  ImmediateAction,
  LatestScanRow,
  OrgAlertRow,
  SiteAtRisk,
} from "@/lib/enterprise/enterpriseOverviewHelpers";
import EnterpriseExportPdfButton from "@/components/enterprise/EnterpriseExportPdfButton";
import ScanAllButton from "@/components/dashboard/ScanAllButton";
import {
  CollapsiblePanel,
  IntelligenceSignalsClient,
  LowerPriorityAlerts,
} from "@/components/enterprise/overview/EnterpriseOverviewPanels";

export type EnterpriseCommandCenterProps = {
  userEmail: string;
  orgName: string | null;
  orgId: string | null;
  planLabel: string;
  isAdmin: boolean;
  totalSitesMonitored: number;
  criticalAlertsCount: number;
  openAlertsCount: number;
  avgScore: number | null;
  rollingRiskScore: number | null;
  postureState: PostureState | null;
  riskOverview: {
    summary: string;
    primaryDriver: string;
    affectedSite: string | null;
    nextStep: string;
  };
  topDrivers: string[];
  immediateActions: ImmediateAction[];
  sitesAtRisk: SiteAtRisk[];
  monitoringHealth: {
    lastCronAt: string | null;
    scansLast24h: number;
    failedLast24h: number;
    queuedScans: number;
  };
  prioritySlotsUsed: number | null;
  prioritySlotsLimit: number | null;
  urgentAlerts: OrgAlertRow[];
  lowerAlerts: OrgAlertRow[];
  intelligenceGrouped: {
    items: Array<{
      id: string;
      typeLabel: string;
      severity: string;
      title: string;
      detail: string;
      relatedCount: number;
      latestAt: string;
    }>;
    total: number;
    hasMore: boolean;
  };
  riskDistribution: Record<string, number>;
  maxBucket: number;
  sitesByClientGroup: Array<{ clientGroup: string; siteCount: number }>;
  latestScansPerSite: LatestScanRow[];
  lastScanTime: string | null;
};

function severityBadgeClass(severity: string): string {
  if (severity === "critical") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (severity === "high") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  if (severity === "medium") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return "bg-gray-800 text-gray-400 border-gray-700";
}

const mobileActionButtonClass =
  "inline-flex min-h-[48px] w-full items-center justify-center rounded-lg px-4 py-3.5 text-sm font-medium sm:w-auto sm:min-h-0 sm:py-2";

export default function EnterpriseCommandCenter(props: EnterpriseCommandCenterProps) {
  const {
    userEmail,
    orgName,
    orgId,
    planLabel,
    isAdmin,
    totalSitesMonitored,
    criticalAlertsCount,
    avgScore,
    rollingRiskScore,
    postureState,
    riskOverview,
    topDrivers,
    immediateActions,
    sitesAtRisk,
    monitoringHealth,
    prioritySlotsUsed,
    prioritySlotsLimit,
    urgentAlerts,
    lowerAlerts,
    intelligenceGrouped,
    riskDistribution,
    maxBucket,
    sitesByClientGroup,
    latestScansPerSite,
    lastScanTime,
  } = props;

  const postureMeta = postureState ? POSTURE_DISPLAY[postureState] : null;

  const metricCards = [
    { label: "Sites monitored", value: totalSitesMonitored, tone: "text-white" },
    { label: "Critical sites", value: criticalAlertsCount, tone: "text-red-400" },
    { label: "Open high/critical alerts", value: urgentAlerts.length, tone: "text-orange-400" },
    { label: "Average score", value: avgScore !== null ? `${avgScore}/100` : "—", tone: "text-white" },
    {
      label: "Last monitoring run",
      value: monitoringHealth.lastCronAt
        ? new Date(monitoringHealth.lastCronAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "—",
      tone: "text-white",
    },
    {
      label: "Priority slots",
      value:
        prioritySlotsLimit !== null && prioritySlotsUsed !== null
          ? `${prioritySlotsUsed} / ${prioritySlotsLimit}`
          : "—",
      tone: "text-indigo-300",
    },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-auto">
      <DashboardHeader email={userEmail} title="Enterprise Overview" showPlanUsage={false} />

      <main className="min-w-0 flex-1 overflow-x-hidden px-5 py-5 sm:p-6">
        <div
          className="mb-5 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-center text-sm font-medium text-emerald-300"
          data-testid="enterprise-command-center-version"
        >
          Enterprise Command Center v2 — Mobile QA
        </div>

        <div className="flex flex-col gap-8 lg:gap-8">
          {/* 1. Executive posture summary */}
          <section className="order-1 min-w-0 rounded-2xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/40 to-gray-900/60 p-5 sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-xl font-bold text-white sm:text-2xl">
                    {orgName ?? "Your Organization"}
                  </h2>
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-sm font-medium text-blue-300">
                    {planLabel}
                  </span>
                  {postureMeta && postureState && (
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-sm font-semibold ${postureMeta.badgeClass} ${postureMeta.textClass}`}
                    >
                      {postureMeta.label} posture
                    </span>
                  )}
                </div>
                <p className="line-clamp-4 break-words text-sm leading-relaxed text-gray-300 sm:line-clamp-none">
                  {riskOverview.summary}
                </p>
                <div className="flex flex-col gap-2 text-sm text-gray-400 sm:flex-row sm:flex-wrap sm:gap-4">
                  {rollingRiskScore !== null && (
                    <span>
                      Score: <strong className="text-white">{rollingRiskScore}/100</strong>
                    </span>
                  )}
                  {lastScanTime && (
                    <span className="hidden sm:inline">
                      Last scan: <strong className="text-gray-200">{lastScanTime}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto">
                {isAdmin && orgId && (
                  <>
                    <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                      <ScanAllButton />
                    </div>
                    <Link
                      href="/enterprise/portal/websites"
                      className={`${mobileActionButtonClass} border border-gray-700 bg-gray-800/80 text-gray-200 hover:bg-gray-800`}
                    >
                      Manage websites
                    </Link>
                    <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto [&_div]:items-stretch sm:[&_div]:items-end">
                      <EnterpriseExportPdfButton orgId={orgId} />
                    </div>
                  </>
                )}
                <Link
                  href="/app/reports"
                  className={`${mobileActionButtonClass} border border-indigo-700/50 bg-indigo-600/10 text-indigo-300 hover:text-white`}
                >
                  View reports
                </Link>
              </div>
            </div>

            <div className="mt-6 lg:hidden">
              <CollapsiblePanel
                title="Security details"
                subtitle="Risk drivers and recommended next steps"
                collapseOnMobile
              >
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-sm uppercase tracking-wide text-gray-500">Primary risk driver</dt>
                    <dd className="mt-1 break-words text-gray-200">{riskOverview.primaryDriver}</dd>
                  </div>
                  {riskOverview.affectedSite && (
                    <div>
                      <dt className="text-sm uppercase tracking-wide text-gray-500">Most affected site</dt>
                      <dd className="mt-1 break-words text-gray-200">{riskOverview.affectedSite}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm uppercase tracking-wide text-gray-500">Next step</dt>
                    <dd className="mt-1 break-words text-gray-300">{riskOverview.nextStep}</dd>
                  </div>
                </dl>
                {topDrivers.length > 0 && (
                  <div className="mt-5 border-t border-indigo-800/30 pt-4">
                    <p className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">Top risk drivers</p>
                    <ul className="flex flex-wrap gap-2">
                      {topDrivers.map((driver) => (
                        <li key={driver} className="rounded-full bg-gray-900/60 px-3 py-1.5 text-sm text-gray-300">
                          {driver}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CollapsiblePanel>
            </div>
          </section>

          {totalSitesMonitored === 0 && (
            <div className="order-2 rounded-xl border border-dashed border-indigo-700/40 bg-indigo-950/20 px-5 py-8 text-center lg:order-2">
              <p className="text-sm font-medium text-indigo-200">No monitored sites yet</p>
              <p className="mt-2 hidden text-sm text-gray-500 sm:block">
                Add websites and run scans to populate your security command center.
              </p>
              <Link
                href="/enterprise/portal/websites"
                className={`${mobileActionButtonClass} mt-4 bg-indigo-600 text-white hover:bg-indigo-500`}
              >
                Add websites
              </Link>
            </div>
          )}

          {/* Desktop metrics — hidden on mobile (moved to lower-priority panel) */}
          <section className="order-3 hidden min-w-0 grid-cols-2 gap-4 lg:grid xl:grid-cols-6">
            {metricCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-sm font-medium uppercase tracking-wider text-gray-500">{card.label}</p>
                <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}</p>
              </div>
            ))}
          </section>

          {/* 2. Immediate Actions */}
          <section className="order-2 min-w-0 lg:order-4">
            <h3 className="mb-3 text-base font-semibold text-white sm:mb-1 sm:text-sm">Immediate Actions</h3>
            <p className="mb-5 hidden text-sm text-gray-500 sm:mb-4 sm:block">
              Top priorities based on current posture and alerts
            </p>
            {immediateActions.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-8 text-sm text-gray-500">
                All monitored sites are stable. No urgent actions right now.
              </div>
            ) : (
              <ul className="space-y-4">
                {immediateActions.map((action) => (
                  <li
                    key={action.id}
                    className="flex min-w-0 flex-col gap-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-medium text-white">{action.site}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-sm capitalize ${severityBadgeClass(action.severity)}`}
                        >
                          {action.severity}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm text-gray-400">{action.reason}</p>
                    </div>
                    {action.ctaHref === "#export-pdf" ? (
                      orgId && isAdmin ? (
                        <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                          <EnterpriseExportPdfButton orgId={orgId} />
                        </div>
                      ) : null
                    ) : (
                      <Link
                        href={action.ctaHref}
                        className={`${mobileActionButtonClass} shrink-0 bg-indigo-600 text-white hover:bg-indigo-500`}
                      >
                        {action.ctaLabel}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Desktop: Security Posture + Monitoring Health grid */}
          <div className="order-3 hidden min-w-0 gap-6 lg:order-5 lg:grid lg:grid-cols-2">
            <section className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-6">
              <h3 className="mb-1 text-sm font-semibold text-white">Security Posture</h3>
              <p className="mb-4 text-sm text-gray-500">Executive summary for your organization</p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-sm uppercase tracking-wide text-gray-500">Primary risk driver</dt>
                  <dd className="mt-1 break-words text-gray-200">{riskOverview.primaryDriver}</dd>
                </div>
                {riskOverview.affectedSite && (
                  <div>
                    <dt className="text-sm uppercase tracking-wide text-gray-500">Most affected site</dt>
                    <dd className="mt-1 break-words text-gray-200">{riskOverview.affectedSite}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm uppercase tracking-wide text-gray-500">Recommended next step</dt>
                  <dd className="mt-1 break-words text-gray-300">{riskOverview.nextStep}</dd>
                </div>
              </dl>
              {topDrivers.length > 0 && (
                <div className="mt-5 border-t border-indigo-800/30 pt-4">
                  <p className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">Top risk drivers</p>
                  <ul className="flex flex-wrap gap-2">
                    {topDrivers.map((driver) => (
                      <li key={driver} className="rounded-full bg-gray-900/60 px-3 py-1 text-sm text-gray-300">
                        {driver}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <MonitoringHealthSection
              monitoringHealth={monitoringHealth}
              prioritySlotsUsed={prioritySlotsUsed}
              prioritySlotsLimit={prioritySlotsLimit}
            />
          </div>

          {/* 3. Sites at Risk */}
          <section className="order-3 min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6 lg:order-6">
            <h3 className="mb-3 text-base font-semibold text-white sm:mb-1 sm:text-sm">Sites at Risk</h3>
            <p className="mb-5 hidden text-sm text-gray-500 sm:mb-4 sm:block">
              Critical and high-risk monitored properties
            </p>
            {sitesAtRisk.length === 0 ? (
              <p className="text-sm text-gray-500">No sites currently flagged as high or critical risk.</p>
            ) : (
              <ul className="space-y-4">
                {sitesAtRisk.slice(0, 5).map((site) => (
                  <li
                    key={site.websiteId}
                    className="flex min-w-0 flex-col gap-4 rounded-lg bg-gray-800/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-200">{site.label ?? site.domain}</p>
                      <p className="truncate text-sm text-gray-500">{site.domain}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-semibold ${scoreToRiskBucket(site.score) === "critical" ? "text-red-400" : "text-orange-400"}`}
                      >
                        {site.score}/100
                      </span>
                      {site.scanId && (
                        <Link
                          href={`/report/${site.scanId}`}
                          className={`${mobileActionButtonClass} border border-gray-700 text-indigo-400 hover:text-indigo-300 sm:border-0 sm:px-0 sm:py-0`}
                        >
                          View report
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4. Monitoring Health (mobile only) */}
          <div className="order-4 min-w-0 lg:hidden">
            <MonitoringHealthSection
              monitoringHealth={monitoringHealth}
              prioritySlotsUsed={prioritySlotsUsed}
              prioritySlotsLimit={prioritySlotsLimit}
            />
          </div>

          {/* 5. Recent Alerts */}
          <section className="order-5 min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6 lg:order-7">
            <div className="mb-5 flex flex-col gap-4 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white sm:text-sm">Recent Alerts</h3>
                <p className="hidden text-sm text-gray-500 sm:block">Critical and high issues requiring attention</p>
              </div>
              <Link
                href="/app/alerts"
                className={`${mobileActionButtonClass} border border-gray-700 text-indigo-400 hover:bg-gray-800/60 hover:text-indigo-300 sm:w-auto sm:border-0 sm:px-0 sm:py-0`}
              >
                View all alerts
              </Link>
            </div>
            {urgentAlerts.length === 0 ? (
              <p className="text-sm text-gray-500">No critical alerts right now.</p>
            ) : (
              <ul className="space-y-4">
                {urgentAlerts.slice(0, 5).map((alert) => (
                  <li key={alert.id} className="rounded-lg border border-gray-800 bg-gray-950/30 px-4 py-4 sm:py-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm text-gray-200">{alert.title}</p>
                        <p className="truncate text-sm text-gray-500">
                          {alert.siteLabel} · {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-sm capitalize ${severityBadgeClass(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <LowerPriorityAlerts alerts={lowerAlerts} />
          </section>

          {/* 6. Recent Scans */}
          <section className="order-6 min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6 lg:order-10">
            <div className="mb-5 flex flex-col gap-4 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white sm:text-sm">Monitoring Activity</h3>
                <p className="hidden text-sm text-gray-500 sm:block">Latest scan per website</p>
              </div>
              {isAdmin && (
                <Link
                  href="/enterprise/portal/websites"
                  className={`${mobileActionButtonClass} border border-gray-700 text-indigo-400 hover:bg-gray-800/60 hover:text-indigo-300 sm:w-auto sm:border-0 sm:px-0 sm:py-0`}
                >
                  Full scan history
                </Link>
              )}
            </div>
            {latestScansPerSite.length === 0 ? (
              <p className="text-sm text-gray-500">No completed scans yet.</p>
            ) : (
              <ul className="space-y-4">
                {latestScansPerSite.map((scan) => (
                  <li
                    key={scan.websiteId}
                    className="flex min-w-0 flex-col gap-4 rounded-lg bg-gray-800/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-200">{scan.label ?? scan.domain}</p>
                      <p className="truncate text-sm text-gray-500">
                        {scan.completedAt ? new Date(scan.completedAt).toLocaleString() : "—"} · {scan.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {scan.score !== null && (
                        <span className="text-sm font-semibold text-white">{scan.score}/100</span>
                      )}
                      <Link
                        href={`/report/${scan.id}`}
                        className={`${mobileActionButtonClass} border border-gray-700 text-indigo-400 hover:text-indigo-300 sm:w-auto sm:border-0 sm:px-0 sm:py-0`}
                      >
                        View report
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 7. Trends & Intelligence */}
          <section className="order-7 min-w-0 lg:order-8">
            <CollapsiblePanel
              title="Trends & Intelligence"
              subtitle="Grouped monitoring signals"
              badge={intelligenceGrouped.total > 0 ? String(intelligenceGrouped.total) : undefined}
              defaultOpen={intelligenceGrouped.total > 0 && intelligenceGrouped.total <= 3}
              collapseOnMobile
            >
              <IntelligenceSignalsClient
                signals={intelligenceGrouped.items}
                total={intelligenceGrouped.total}
                hasMore={intelligenceGrouped.hasMore}
              />
            </CollapsiblePanel>
          </section>

          {/* 8. Reports / PDF export */}
          <section className="order-8 min-w-0 flex flex-col gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:order-11">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white sm:text-sm">Reports</h3>
              <p className="hidden break-words text-sm text-gray-500 sm:block">
                Export posture data for stakeholders or open detailed reports.
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:gap-2">
              <Link
                href="/app/reports"
                className={`${mobileActionButtonClass} border border-gray-700 text-gray-300 hover:text-white`}
              >
                View reports
              </Link>
              {isAdmin && orgId && (
                <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                  <EnterpriseExportPdfButton orgId={orgId} />
                </div>
              )}
            </div>
          </section>

          {/* 9. Lower-priority (mobile collapsed) */}
          <section className="order-9 min-w-0 lg:hidden">
            <CollapsiblePanel
              title="Portfolio overview"
              subtitle="Metrics, risk distribution, and client groups"
              collapseOnMobile
            >
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                  {metricCards.map((card) => (
                    <div key={card.label} className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-4 sm:p-3">
                      <p className="text-sm font-medium uppercase tracking-wider text-gray-500">{card.label}</p>
                      <p className={`mt-3 truncate text-2xl font-bold sm:mt-2 sm:text-xl ${card.tone}`}>{card.value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-semibold text-white">Risk Distribution</h4>
                  <RiskDistributionBars riskDistribution={riskDistribution} maxBucket={maxBucket} />
                </div>

                {sitesByClientGroup.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-white">Sites by Client</h4>
                    <ul className="space-y-2">
                      {sitesByClientGroup.map((group) => (
                        <li
                          key={group.clientGroup}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-gray-800/40 px-4 py-3 text-sm"
                        >
                          <span className="truncate text-gray-200">{group.clientGroup}</span>
                          <span className="shrink-0 text-sm text-gray-500">{group.siteCount} sites</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsiblePanel>
          </section>

          {/* Desktop: Risk Distribution + Client groups */}
          <div className="order-9 hidden min-w-0 gap-6 lg:order-9 lg:grid lg:grid-cols-2">
            <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
              <h3 className="mb-1 text-sm font-semibold text-white">Risk Distribution</h3>
              <p className="mb-4 text-sm text-gray-500">Latest completed scan per site</p>
              <RiskDistributionBars riskDistribution={riskDistribution} maxBucket={maxBucket} />
            </section>

            {sitesByClientGroup.length > 0 && (
              <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
                <h3 className="mb-1 text-sm font-semibold text-white">Sites by Client</h3>
                <ul className="space-y-2">
                  {sitesByClientGroup.map((group) => (
                    <li
                      key={group.clientGroup}
                      className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3 text-sm"
                    >
                      <span className="truncate text-gray-200">{group.clientGroup}</span>
                      <span className="text-sm text-gray-500">{group.siteCount} sites</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function MonitoringHealthSection({
  monitoringHealth,
  prioritySlotsUsed,
  prioritySlotsLimit,
}: {
  monitoringHealth: EnterpriseCommandCenterProps["monitoringHealth"];
  prioritySlotsUsed: number | null;
  prioritySlotsLimit: number | null;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
      <h3 className="mb-3 text-base font-semibold text-white sm:mb-1 sm:text-sm">Monitoring Health</h3>
      <p className="mb-5 hidden text-sm text-gray-500 sm:mb-4 sm:block">Automated monitoring status</p>
      <dl className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2 sm:gap-4">
        <div>
          <dt className="text-sm text-gray-500">Last cron run</dt>
          <dd className="mt-1 break-words font-medium text-white">
            {monitoringHealth.lastCronAt ? new Date(monitoringHealth.lastCronAt).toLocaleString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Scans (24h)</dt>
          <dd className="mt-1 font-medium text-white">{monitoringHealth.scansLast24h}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Failed (24h)</dt>
          <dd className="mt-1 font-medium text-white">{monitoringHealth.failedLast24h}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Queued scans</dt>
          <dd className="mt-1 font-medium text-white">{monitoringHealth.queuedScans}</dd>
        </div>
      </dl>
      {prioritySlotsLimit !== null && (
        <p className="mt-4 break-words text-sm text-gray-500">
          Priority monitoring: {prioritySlotsUsed ?? 0} / {prioritySlotsLimit} slots used.{" "}
          <Link href="/enterprise/portal/websites" className="text-indigo-400 hover:text-indigo-300">
            Manage websites
          </Link>
        </p>
      )}
    </section>
  );
}

function RiskDistributionBars({
  riskDistribution,
  maxBucket,
}: {
  riskDistribution: Record<string, number>;
  maxBucket: number;
}) {
  return (
    <div className="space-y-3">
      {RISK_BUCKET_DISPLAY.map(({ key, label, color, text }) => {
        const count = riskDistribution[key];
        const pct = Math.round((count / maxBucket) * 100);
        return (
          <div key={key} className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className={`w-20 shrink-0 truncate text-sm sm:w-28 ${text}`}>{label}</span>
            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-800">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right text-sm text-gray-400">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
