import Link from 'next/link';
import {
  DASHBOARD_V4_COPY,
  type CommandCenterData,
  type NeedsAttentionItem,
} from '@/lib/dashboard/dashboardCommandCenter';
import { priorityLabel } from '@/lib/dashboard/dashboardAlertClassification';

interface DashboardV4TopRowProps {
  data: CommandCenterData;
}

function priorityBadgeClass(priority: NeedsAttentionItem['priority']): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'review':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-600';
  }
}

export default function DashboardV4TopRow({ data }: DashboardV4TopRowProps) {
  const { needsAttention, monitoringActivity, recommendedNextStep } = data;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          {DASHBOARD_V4_COPY.immediateAttentionTitle}
        </p>
        {needsAttention.length > 0 ? (
          <>
            {needsAttention.filter((i) => i.priority === 'review').length >= 2 && (
              <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                <p className="text-sm font-medium text-white">
                  Review {needsAttention.filter((i) => i.priority === 'review').length} website trust
                  improvements
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Preventive hardening items — not confirmed active vulnerabilities.
                </p>
                {data.websites[0]?.latestScanId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/report/${data.websites[0]!.latestScanId}`}
                      className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                    >
                      Open Report
                    </Link>
                    <Link
                      href={`/report/${data.websites[0]!.latestScanId}#developer-handoff`}
                      className="inline-flex rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600"
                    >
                      Send all to developer
                    </Link>
                  </div>
                )}
              </div>
            )}
            <ul className="mt-4 space-y-3">
            {needsAttention.slice(0, 4).map((issue) => (
              <li
                key={issue.id}
                className="rounded-lg border border-gray-800 bg-gray-950/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityBadgeClass(issue.priority)}`}
                  >
                    {priorityLabel(issue.priority)}
                  </span>
                  <span className="text-xs text-gray-500">{issue.websiteName}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{issue.title}</p>
                <Link
                  href={issue.actionHref}
                  className="mt-2 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  {issue.actionLabel} →
                </Link>
              </li>
            ))}
          </ul>
          </>
        ) : (
          <p className="mt-4 text-sm text-green-300">
            No urgent actions — monitoring continues automatically.
          </p>
        )}
      </article>

      <article className="rounded-xl border border-gray-800 bg-gradient-to-br from-blue-500/10 to-gray-900/50 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          {DASHBOARD_V4_COPY.recommendedNextStepTitle}
        </p>
        <p className="mt-3 text-sm font-medium text-white">{recommendedNextStep.headline}</p>
        <p className="mt-2 text-sm text-gray-400">{recommendedNextStep.detail}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={recommendedNextStep.primaryHref}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            {recommendedNextStep.primaryLabel}
          </Link>
          {recommendedNextStep.showDeveloperActions && data.websites[0]?.latestScanId && (
            <Link
              href={`/report/${data.websites[0]!.latestScanId}#developer-handoff`}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-gray-700 px-4 py-2 text-xs font-medium text-gray-300 hover:border-gray-600"
            >
              Send all to developer
            </Link>
          )}
        </div>
      </article>

      {monitoringActivity.length > 0 && (
        <article className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 sm:p-6 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Monitoring Activity
          </p>
          <ul className="mt-3 space-y-2">
            {monitoringActivity.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-gray-300">{item.title}</span>
                <span className="text-xs text-gray-500">{item.websiteName}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
