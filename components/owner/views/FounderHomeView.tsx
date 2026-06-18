'use client';

import { useCallback, useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import AiChiefOfStaff from '../AiChiefOfStaff';
import AutopilotCommandCenter from '../AutopilotCommandCenter';
import ActivityFeed from '../ActivityFeed';
import type { FounderOsV6Data } from '@/lib/owner/founderOsV6';

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function FounderHomeView({ initial }: { initial: FounderOsV6Data }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { setSection } = useFounderNav();
  const summary = data.v6.homeSummary;

  const refresh = useCallback(async () => {
    const res = await fetch('/api/owner/founder-os');
    const json = await res.json();
    if (json.data) setData(json.data);
  }, []);

  async function approveInbox(ids: string[]) {
    setBusy(true);
    try {
      await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', ids }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <AiChiefOfStaff chief={data.chiefOfStaff} />

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          At a glance
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Current MRR" value={`$${summary.mrr.toLocaleString()}`} />
          <Metric
            label="What changed (24h)"
            value={String(summary.changesCount)}
            tone="text-violet-300"
          />
          <Metric
            label="Needs attention"
            value={String(summary.needsAttention)}
            tone={summary.needsAttention > 0 ? 'text-amber-400' : 'text-white'}
          />
          <Metric
            label="Revenue at risk"
            value={summary.mrrAtRisk > 0 ? `$${summary.mrrAtRisk}` : '—'}
            tone={summary.mrrAtRisk > 0 ? 'text-amber-400' : 'text-white'}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          While you were away
        </h2>
        <p className="mt-1 text-xs text-gray-600">Last 24 hours</p>
        <div className="mt-4">
          <ActivityFeed events={data.v6.activityFeed.events} compact />
        </div>
      </section>

      {data.v6.attention.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-amber-400/80">
            Needs your attention
          </h2>
          <ul className="mt-4 space-y-2">
            {data.v6.attention.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSection(a.id.includes('outreach') ? 'inbox' : 'success')}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Review →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.biggestOpportunity && (
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
            {data.biggestOpportunity.estimatedMrr && (
              <span className="text-emerald-300">
                Est. ${data.biggestOpportunity.estimatedMrr}/mo
              </span>
            )}
          </div>
          <ul className="mt-3 space-y-1">
            {data.biggestOpportunity.reasons.slice(0, 3).map((r) => (
              <li key={r} className="text-sm text-gray-300">
                ✓ {r}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setSection('prospects')}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {data.biggestOpportunity.recommendedAction}
          </button>
        </section>
      )}

      <AutopilotCommandCenter
        autopilot={data.autopilot}
        busy={busy}
        onApproveAll={() => approveInbox(data.autopilot.items.map((i) => i.id))}
        onApproveOne={(id) => approveInbox([id])}
      />

      <div className="flex flex-wrap gap-4 text-sm">
        <button
          type="button"
          onClick={() => setSection('success')}
          className="text-violet-400 hover:text-violet-300"
        >
          Customer success center →
        </button>
        <button
          type="button"
          onClick={() => setSection('inbox')}
          className="text-violet-400 hover:text-violet-300"
        >
          Founder inbox ({data.inbox.length}) →
        </button>
      </div>
    </div>
  );
}
