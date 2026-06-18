'use client';

import { useCallback, useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import AiChiefOfStaff from '../AiChiefOfStaff';
import AutopilotCommandCenter from '../AutopilotCommandCenter';
import type { FounderOsV5Data } from '@/lib/owner/founderOsV5';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export default function FounderHomeView({ initial }: { initial: FounderOsV5Data }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { setSection } = useFounderNav();
  const s = data.businessStatus;

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
    <div className="mx-auto max-w-5xl space-y-10">
      <AiChiefOfStaff chief={data.chiefOfStaff} />

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Business status
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Current MRR" value={`$${s.mrr.toLocaleString()}`} />
          <Metric label="ARR" value={`$${s.arr.toLocaleString()}`} />
          <Metric label="Paying customers" value={String(s.payingCustomers)} />
          <Metric label="Active trials" value={String(s.activeTrials)} />
          <Metric label="Goal" value={`$${s.mrrGoal.toLocaleString()}`} />
          <Metric label="Progress" value={`${s.goalProgressPct}%`} />
          <Metric label="Churn risk" value={s.churnRisk} />
          <Metric
            label="At current pace"
            value={s.daysToGoal ? `${s.daysToGoal} days to goal` : '—'}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          What CyberShield did while you were away
        </h2>
        <p className="mt-1 text-xs text-gray-600">Last 24 hours</p>
        {data.whileAway.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Quiet period — no major automated activity yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.whileAway.map((w) => (
              <li key={w.label} className="flex justify-between rounded-lg bg-black/20 px-4 py-2 text-sm">
                <span className="text-gray-400">{w.label}</span>
                <span className="font-medium text-white">{w.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AutopilotCommandCenter
        autopilot={data.autopilot}
        busy={busy}
        onApproveAll={() => approveInbox(data.autopilot.items.map((i) => i.id))}
        onApproveOne={(id) => approveInbox([id])}
      />

      {data.biggestOpportunity && (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-emerald-400/80">
            Highest-leverage opportunity
          </h2>
          <p className="mt-3 text-xl font-semibold text-white">
            {data.biggestOpportunity.businessName}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="text-violet-300">
              Opportunity {data.biggestOpportunity.opportunityScore}/100
            </span>
            {data.biggestOpportunity.securityScore !== null && (
              <span className="text-amber-200">
                Security {data.biggestOpportunity.securityScore}/100
              </span>
            )}
            {data.biggestOpportunity.estimatedMrr && (
              <span className="text-emerald-300">
                Est. ${data.biggestOpportunity.estimatedMrr}/mo
              </span>
            )}
          </div>
          <ul className="mt-3 space-y-1">
            {data.biggestOpportunity.reasons.map((r) => (
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

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Customer success
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Healthy" value={String(data.customerSuccess.healthy)} />
          <Metric label="Needs attention" value={String(data.customerSuccess.needsAttention)} />
          <Metric
            label="Expansion opportunities"
            value={String(data.customerSuccess.expansionOpportunities)}
          />
          <Metric
            label="Potential expansion"
            value={
              data.customerSuccess.potentialExpansionMrr > 0
                ? `+$${data.customerSuccess.potentialExpansionMrr}/mo`
                : '—'
            }
          />
        </div>
        <button
          type="button"
          onClick={() => setSection('customers')}
          className="mt-4 text-sm text-violet-400 hover:text-violet-300"
        >
          Open customer center →
        </button>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Revenue engine
        </h2>
        <p className="mt-2 text-lg font-medium text-white">
          Next ${data.revenueEngine.targetMrr} MRR
        </p>
        <p className="mt-1 text-sm text-gray-400">{data.revenueEngine.summary}</p>
        <p className="mt-2 text-sm text-gray-500">
          Probability: {data.revenueEngine.probability} · Required actions:{' '}
          {data.revenueEngine.requiredActions}
        </p>
        {data.revenueEngine.paths.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-gray-300">
            {data.revenueEngine.paths.map((p) => (
              <li key={p.label}>
                {p.count} × {p.label} (${p.mrrEach}/mo)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">Pipeline</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.pipeline.stages.map((st) => (
            <span
              key={st.id}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-gray-300"
            >
              {st.label}: {st.count}
            </span>
          ))}
        </div>
        {data.pipeline.bottleneck && (
          <p className="mt-3 text-sm text-amber-400">Bottleneck: {data.pipeline.bottleneck}</p>
        )}
        <button
          type="button"
          onClick={() => setSection('prospects')}
          className="mt-4 text-sm text-violet-400 hover:text-violet-300"
        >
          Open pipeline →
        </button>
      </section>

      {data.marketIntelligence.industryInsight && (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Market intelligence
          </h2>
          <p className="mt-2 text-sm text-gray-300">{data.marketIntelligence.industryInsight}</p>
          {data.marketIntelligence.topFinding && (
            <p className="mt-2 text-xs text-gray-500">
              Top finding: {data.marketIntelligence.topFinding}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
