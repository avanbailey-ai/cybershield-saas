'use client';

import { useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import AiChiefOfStaff from '../AiChiefOfStaff';
import ActivityFeed from '../ActivityFeed';
import ExecutionCommandBanner from '../ExecutionCommandBanner';
import { FounderInboxList } from '../AutopilotCommandCenter';

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function FounderHomeView() {
  const { founderData: data, refreshFounderData, setSection } = useFounderNav();
  const [busy, setBusy] = useState(false);
  const summary = data.v6.homeSummary;
  const stats = data.v6.executionStats;
  const inboxPreview = data.inbox.slice(0, 5);
  const customerRisks = data.inbox.filter((i) => i.type === 'customer_risk').slice(0, 3);
  const outreachIds = data.inbox.filter((i) => i.type === 'outreach').map((i) => i.id);

  async function approveInbox(ids: string[]) {
    setBusy(true);
    try {
      await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', ids }),
      });
      await refreshFounderData();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <ExecutionCommandBanner
        pendingApprovals={stats.pendingApprovals}
        emailsSent24h={stats.emailsSent24h}
        followUpsDue={stats.followUpsDue}
        busy={busy}
        onApproveAll={() => approveInbox(outreachIds)}
      />

      {inboxPreview.length > 0 && (
        <section className="rounded-2xl border-2 border-violet-500/25 bg-violet-950/20 p-6 shadow-inner">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Action queue</h2>
              <p className="mt-1 text-sm text-gray-400">
                Approve items below — each sends real email or executes automation
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSection('inbox')}
              className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Full inbox ({data.inbox.length})
            </button>
          </div>
          <div className="mt-5">
            <FounderInboxList
              items={inboxPreview}
              onApprove={(id) => approveInbox([id])}
              busy={busy}
            />
          </div>
        </section>
      )}

      <AiChiefOfStaff chief={data.chiefOfStaff} />

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Revenue movement
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Current MRR" value={`$${summary.mrr.toLocaleString()}`} />
          <Metric
            label="Revenue at risk"
            value={summary.mrrAtRisk > 0 ? `$${summary.mrrAtRisk}` : 'None'}
            tone={summary.mrrAtRisk > 0 ? 'text-amber-400' : 'text-emerald-400'}
          />
          <Metric
            label="Emails sent (24h)"
            value={String(stats.emailsSent24h)}
            tone="text-emerald-400"
          />
          <Metric
            label="Pending approval"
            value={String(stats.pendingApprovals)}
            tone={stats.pendingApprovals > 0 ? 'text-violet-300' : 'text-white'}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Execution log
        </h2>
        <p className="mt-1 text-xs text-gray-600">What CyberShield did — last 24 hours</p>
        <div className="mt-4">
          {data.v6.activityFeed.events.length === 0 ? (
            <p className="text-sm text-gray-500">Quiet period — run discovery to start the engine.</p>
          ) : (
            <ActivityFeed events={data.v6.activityFeed.events} />
          )}
        </div>
      </section>

      {data.biggestOpportunity && data.biggestOpportunity.opportunityScore >= 25 && (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-emerald-400/80">
            Best opportunity
          </h2>
          <p className="mt-3 text-xl font-semibold text-white">
            {data.biggestOpportunity.businessName}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="text-violet-300">
              Score {data.biggestOpportunity.opportunityScore}/100
            </span>
            {data.biggestOpportunity.estimatedMrr ? (
              <span className="text-emerald-300">
                Est. ${data.biggestOpportunity.estimatedMrr}/mo
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSection('prospects')}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {data.biggestOpportunity.recommendedAction}
          </button>
        </section>
      )}

      {customerRisks.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-amber-400/80">
            Customer risks
          </h2>
          <ul className="mt-4 space-y-2">
            {customerRisks.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => approveInbox([item.id])}
                  className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
                >
                  {item.action}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
