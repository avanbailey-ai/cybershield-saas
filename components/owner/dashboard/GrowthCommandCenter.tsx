'use client';

import type { GrowthAutopilotSnapshot } from '@/lib/owner/growthAutopilot';
import type { FounderSectionId } from '@/lib/owner/founderNav';

interface GrowthCommandCenterProps {
  growth: GrowthAutopilotSnapshot;
  pendingApprovals: number;
  onNavigate: (section: FounderSectionId) => void;
}

function deliverabilityTone(status: GrowthAutopilotSnapshot['deliverabilityStatus']): string {
  if (status === 'healthy') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (status === 'caution') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-red-300 border-red-500/30 bg-red-500/10';
}

export default function GrowthCommandCenter({
  growth,
  pendingApprovals,
  onNavigate,
}: GrowthCommandCenterProps) {
  const o = growth.overnight;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-5 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
          While you slept
        </h2>
        <p className="mt-2 text-sm text-gray-300">{o.summaryLine}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Found" value={o.prospectsDiscovered} />
          <Stat label="Scanned" value={o.prospectsScanned} />
          <Stat label="Contacts" value={o.contactsFound} />
          <Stat label="Drafts ready" value={o.draftsCreated} />
          <Stat label="Sent" value={o.emailsSent} />
          <Stat label="Follow-ups due" value={o.followUpsDue} />
          <Stat label="Opens" value={o.opens} />
          <Stat label="Clicks" value={o.clicks} />
          <Stat label="Signups" value={o.signups} />
          <Stat label="Blocked" value={o.blockedItems} tone="text-amber-400" />
        </div>
        {o.idleReasons.length > 0 && o.prospectsDiscovered + o.draftsCreated + o.emailsSent === 0 && (
          <ul className="mt-4 space-y-1 text-xs text-gray-500">
            {o.idleReasons.slice(0, 4).map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
        {growth.lastCronAt && (
          <p className="mt-3 text-[10px] text-gray-600">
            Last growth cron: {new Date(growth.lastCronAt).toLocaleString()}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
            Today&apos;s money moves
          </h2>
          {pendingApprovals > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('inbox')}
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              {pendingApprovals} awaiting approval →
            </button>
          )}
        </div>
        {growth.moneyMoves.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No urgent revenue actions — run discovery to fill pipeline.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {growth.moneyMoves.map((move) => (
              <li
                key={move.id}
                className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{move.title}</p>
                  <p className="mt-1 text-xs text-gray-400">{move.why}</p>
                  <p className="mt-1 text-[10px] uppercase text-gray-600">
                    Confidence: {move.confidence}
                    {move.estimatedMrr ? ` · est. $${move.estimatedMrr}/mo` : ''}
                  </p>
                  {move.blockedReason && (
                    <p className="mt-1 text-xs text-amber-400">Blocked: {move.blockedReason}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(move.section)}
                  disabled={Boolean(move.blockedReason)}
                  className="min-h-[44px] shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {move.action}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Growth autopilot status
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Mode: <span className="text-white">{growth.mode}</span>
          {growth.prepareOnly ? ' · prepare-only (no auto-send)' : ''}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {growth.stages.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2"
            >
              <span className="text-sm text-gray-300">{stage.label}</span>
              <span className={`text-xs ${stage.enabled ? 'text-emerald-400' : 'text-gray-600'}`}>
                {stage.detail}
              </span>
            </div>
          ))}
        </div>
        <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs ${deliverabilityTone(growth.deliverabilityStatus)}`}>
          Deliverability: {growth.deliverabilityStatus} · {growth.sendsToday}/{growth.recommendedDailyCap} sends today
        </div>
        {growth.deliverabilityReasons.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-amber-400/90">
            {growth.deliverabilityReasons.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            Approval queue
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('inbox')}
            className="min-h-[40px] rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500"
          >
            Open inbox ({pendingApprovals})
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Drafts, follow-ups, and risky sends need your approval before Resend delivery.
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Revenue pipeline (real data)
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="SMB" value={growth.pipeline.smbProspects} />
          <Stat label="Agency" value={growth.pipeline.agencyProspects} />
          <Stat label="Contacted" value={growth.pipeline.contacted} />
          <Stat label="Clicked" value={growth.pipeline.clicked} />
          <Stat label="Signed up" value={growth.pipeline.signedUp} />
          <Stat label="Paid" value={growth.pipeline.paid} />
          <Stat label="MRR" value={`$${growth.pipeline.mrr}`} />
          <Stat label="Conv. rate" value={`${growth.pipeline.conversionRate}%`} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}
