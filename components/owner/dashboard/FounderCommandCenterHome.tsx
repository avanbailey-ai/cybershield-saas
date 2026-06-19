'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFounderNav } from '../FounderNavContext';
import type { FounderInboxItem } from '@/lib/owner/founderOsV5';
import type { OwnerProspect } from '@/lib/owner/types';
import {
  filterProspectsByKind,
  isAgencyKind,
  resolveProspectList,
  type ProspectKindView,
} from '@/lib/owner/prospectDisplay';
import { computeRevenueIntelligence } from '@/lib/owner/revenueIntelligence';
import EmailHealthSection from './EmailHealthSection';

type PriorityStatus = 'ready' | 'blocked' | 'needs_review';

interface TodayPriority {
  id: string;
  title: string;
  why: string;
  action: string;
  status: PriorityStatus;
  section: 'inbox' | 'prospects' | 'success' | 'settings';
}

function statusTone(status: PriorityStatus): string {
  if (status === 'ready') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (status === 'blocked') return 'text-red-300 bg-red-500/10 border-red-500/20';
  return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
}

function buildPriorities(
  inbox: FounderInboxItem[],
  followUpsDue: number,
  pendingApprovals: number,
): TodayPriority[] {
  const items: TodayPriority[] = [];

  const outreach = inbox.find((i) => i.type === 'outreach');
  if (outreach) {
    items.push({
      id: outreach.id,
      title: outreach.title,
      why: outreach.whyItMatters ?? 'Outreach-ready prospect with email on file.',
      action: 'Review draft',
      status: 'ready',
      section: 'inbox',
    });
  } else if (pendingApprovals > 0) {
    items.push({
      id: 'inbox-pending',
      title: `${pendingApprovals} item(s) need approval`,
      why: 'Manual approval is required before any email sends.',
      action: 'Open inbox',
      status: 'needs_review',
      section: 'inbox',
    });
  }

  if (followUpsDue > 0) {
    items.push({
      id: 'follow-ups',
      title: `${followUpsDue} follow-up(s) due`,
      why: 'Timely follow-ups improve reply rates on contacted prospects.',
      action: 'Review follow-ups',
      status: 'ready',
      section: 'inbox',
    });
  }

  const risk = inbox.find((i) => i.type === 'customer_risk');
  if (risk) {
    items.push({
      id: risk.id,
      title: risk.title,
      why: risk.whyItMatters ?? 'Protect recurring revenue.',
      action: 'Review retention',
      status: 'needs_review',
      section: 'success',
    });
  }

  return items.slice(0, 3);
}

function bestLeadForView(prospects: OwnerProspect[], view: ProspectKindView) {
  const scoped = filterProspectsByKind(prospects, view);
  return computeRevenueIntelligence(scoped, view).highestConfidenceLead;
}

export default function FounderCommandCenterHome() {
  const { founderData: data, setSection, refreshFounderData } = useFounderNav();
  const v6 = data.v6;
  const [prospects, setProspects] = useState<OwnerProspect[]>([]);

  useEffect(() => {
    fetch('/api/owner/prospects')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.prospects)) setProspects(resolveProspectList(d.prospects));
      })
      .catch(() => {});
  }, [v6.businessHealth.calculation.generatedAt]);

  const smbPipeline = useMemo(() => computeRevenueIntelligence(prospects, 'smb'), [prospects]);
  const agencyPipeline = useMemo(() => computeRevenueIntelligence(prospects, 'agency'), [prospects]);
  const allPipeline = useMemo(() => computeRevenueIntelligence(prospects, 'all'), [prospects]);

  const smbBest = useMemo(() => bestLeadForView(prospects, 'smb'), [prospects]);
  const agencyBest = useMemo(() => bestLeadForView(prospects, 'agency'), [prospects]);
  const showAgencyBest = agencyPipeline.potentialOpportunities > 0 && agencyBest;

  const priorities = buildPriorities(
    data.inbox,
    v6.executionStats.followUpsDue,
    v6.executionStats.pendingApprovals,
  );

  const payingInHealth = v6.customerHealth.customers.filter((c) => c.mrr > 0).length;
  const warnings: { id: string; text: string; section?: 'inbox' | 'prospects' | 'settings' }[] = [];
  const emailHealthCheck = v6.emailHealth.checks.find((c) => c.id === 'delivery_rate');
  if (v6.emailHealth.overall !== 'healthy') {
    warnings.push({
      id: 'email-health',
      text: emailHealthCheck?.detail ?? 'Email health needs attention',
      section: 'settings',
    });
  }
  if (v6.businessHealth.payingCustomers !== payingInHealth) {
    warnings.push({
      id: 'metric-sync',
      text: `Customer count mismatch (${v6.businessHealth.payingCustomers} paying vs ${payingInHealth} in health) — refresh data.`,
    });
  }
  if (agencyPipeline.potentialOpportunities === 0) {
    warnings.push({
      id: 'no-agency',
      text: 'No agency prospects yet — run Agency Discovery before agency outreach.',
      section: 'prospects',
    });
  }

  const recentActivity = v6.activityFeed.events.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Today&apos;s command center
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            What to do now to grow revenue — not dashboard noise.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshFounderData}
          className="min-h-[40px] rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:text-white"
        >
          Refresh
        </button>
      </header>

      <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
          Today&apos;s priorities
        </h2>
        {priorities.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            Quiet day — run discovery or review pipeline for new outreach.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {priorities.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{p.title}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${statusTone(p.status)}`}
                    >
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{p.why}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSection(p.section)}
                  className="min-h-[44px] shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  {p.action}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Revenue pipeline snapshot
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Snap label="Paying customers" value={String(v6.businessHealth.payingCustomers)} />
          <Snap label="MRR" value={`$${v6.businessHealth.mrr}`} tone="text-emerald-400" />
          <Snap label="Outreach ready" value={String(allPipeline.outreachReady)} />
          <Snap
            label="Interested"
            value={String(prospects.filter((p) => p.pipeline_state === 'interested').length)}
          />
          <Snap label="Follow-ups due" value={String(v6.executionStats.followUpsDue)} />
          <Snap label="Agency opps" value={String(agencyPipeline.potentialOpportunities)} />
        </div>
        <p className="mt-3 text-xs text-gray-600">
          SMB: {smbPipeline.potentialOpportunities} prospects · est.{' '}
          {smbPipeline.estimatedMonthlyRevenue > 0
            ? `$${smbPipeline.estimatedMonthlyRevenue}/mo`
            : '—'}{' '}
          · Agency: {agencyPipeline.potentialOpportunities} · est.{' '}
          {agencyPipeline.estimatedMonthlyRevenue > 0
            ? `$${agencyPipeline.estimatedMonthlyRevenue}/mo`
            : '—'}
        </p>
      </section>

      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
          Best opportunity
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <BestLeadCard
            label="Best SMB lead"
            lead={smbBest}
            estMrr={smbBest?.estimated_plan_fit ?? null}
            onAction={() => setSection('prospects')}
          />
          {showAgencyBest ? (
            <BestLeadCard
              label="Best agency lead"
              lead={agencyBest}
              estMrr={299}
              onAction={() => setSection('prospects')}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">
              No agency prospects yet. Run Agency Discovery for web design, SEO, WordPress, or
              marketing agencies.
            </div>
          )}
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
            Warnings & blockers
          </h2>
          <ul className="mt-3 space-y-2">
            {warnings.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-amber-100/90">{w.text}</span>
                {w.section && (
                  <button
                    type="button"
                    onClick={() => setSection(w.section!)}
                    className="text-xs text-violet-300 hover:text-violet-200"
                  >
                    Fix →
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recent activity
          </h2>
          {data.inbox.length > 0 && (
            <button
              type="button"
              onClick={() => setSection('inbox')}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              Open inbox ({data.inbox.length})
            </button>
          )}
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No activity in the last 24 hours.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentActivity.map((e) => (
              <li key={e.id} className="text-sm text-gray-300">
                <span className="text-gray-500">{e.timeLabel}</span> · {e.label}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] open:p-5 sm:open:p-6">
        <summary className="cursor-pointer list-none p-5 text-xs font-semibold uppercase tracking-wider text-gray-500 sm:p-0 group-open:mb-4">
          Email health (expand)
        </summary>
        <EmailHealthSection health={v6.emailHealth} />
      </details>
    </div>
  );
}

function Snap({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function BestLeadCard({
  label,
  lead,
  estMrr,
  onAction,
}: {
  label: string;
  lead: OwnerProspect | null;
  estMrr: number | null;
  onAction: () => void;
}) {
  if (!lead) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-gray-500">
        {label}: none in pipeline yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 font-medium text-white">{lead.business_name}</p>
      <p className="mt-1 text-xs text-gray-400">
        Score {lead.opportunity_score ?? '—'}/100
        {estMrr ? ` · est. $${estMrr}/mo` : ''}
        {isAgencyKind(lead) ? ' · Agency' : ' · SMB'}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 min-h-[40px] rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
      >
        View in prospects
      </button>
    </div>
  );
}
