'use client';

import {
  FounderMetricCard,
  FounderMetricOrEmpty,
  FounderPanel,
  FounderSectionHeader,
} from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';

export default function FounderOverviewView({ data }: { data: FounderCommandCenterData }) {
  const o = data.overview;
  const brief = data.dailyBrief;

  return (
    <div>
      <FounderSectionHeader
        title="Overview"
        subtitle="Operating health for CyberShieldCloud — users, scans, revenue, and conversions from live data."
        updatedAt={data.generatedAt}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FounderMetricCard label="Total users" value={o.totalUsers} />
        <FounderMetricCard label="Signups today" value={o.signupsToday} />
        <FounderMetricCard label="Signups (7d)" value={o.signups7d} />
        <FounderMetricCard label="Signups (30d)" value={o.signups30d} />
        <FounderMetricCard label="Websites" value={o.totalWebsites} />
        <FounderMetricCard label="Total scans" value={o.totalScans} />
        <FounderMetricCard label="Paid monitored sites" value={o.paidMonitoredWebsites} />
        <FounderMetricCard label="MRR" value={`$${o.mrr.toLocaleString()}`} sub={`ARR $${o.arr.toLocaleString()}`} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FounderMetricOrEmpty metric={o.freeScans30d} />
        <FounderMetricOrEmpty metric={o.loggedInScans30d} />
        <FounderMetricOrEmpty metric={o.signupToPaidConversionPct} />
        <FounderMetricOrEmpty metric={o.scanToSignupConversionPct} />
        <FounderMetricOrEmpty metric={o.freeScanToPaidConversionPct} />
        <FounderMetricOrEmpty metric={o.reportsViewed30d} />
        <FounderMetricOrEmpty metric={o.emailsAlertsSent30d} />
        <FounderMetricCard label="Failed payments" value={o.failedPayments} />
        <FounderMetricCard label="Canceled subs" value={o.canceledSubscriptions} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <FounderPanel title="Subscriptions by plan">
          <dl className="space-y-2">
            {Object.entries(o.subscriptionsByPlan).map(([plan, count]) => (
              <div key={plan} className="flex justify-between text-sm">
                <dt className="capitalize text-gray-400">{plan}</dt>
                <dd className="font-medium text-white">{count}</dd>
              </div>
            ))}
          </dl>
        </FounderPanel>

        <FounderPanel title="Daily brief (24h)">
          <ul className="space-y-2">
            {brief.changes.map((c) => (
              <li key={c.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{c.label}</span>
                <span className="text-white">{c.value}</span>
              </li>
            ))}
          </ul>
          {brief.suggestedActions.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Suggested today</p>
              <ul className="space-y-2">
                {brief.suggestedActions.map((a) => (
                  <li key={a.title} className="text-sm">
                    <p className="font-medium text-white">{a.title}</p>
                    <p className="text-gray-500">{a.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FounderPanel>
      </div>

      <FounderPanel title="Recent scans">
        {o.recentScans.length === 0 ? (
          <p className="text-sm text-gray-500">No scans recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Score</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {o.recentScans.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04]">
                    <td className="py-2 pr-4 text-gray-300">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-white">{s.score ?? '—'}</td>
                    <td className="py-2 text-gray-400">{s.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FounderPanel>
    </div>
  );
}
