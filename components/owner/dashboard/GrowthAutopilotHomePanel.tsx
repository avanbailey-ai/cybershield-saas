'use client';

import type { GrowthAutopilotSnapshot } from '@/lib/owner/growthAutopilot';
import { AUTOPILOT_MODE_LABELS } from '@/lib/owner/growthAutopilotSettings';

interface GrowthAutopilotHomePanelProps {
  growth: GrowthAutopilotSnapshot;
}

function deliverabilityTone(status: GrowthAutopilotSnapshot['deliverabilityStatus']): string {
  if (status === 'healthy') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (status === 'caution') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-red-300 border-red-500/30 bg-red-500/10';
}

export default function GrowthAutopilotHomePanel({ growth }: GrowthAutopilotHomePanelProps) {
  const modeLabel = AUTOPILOT_MODE_LABELS[growth.mode] ?? growth.mode;
  const sendingLabel = growth.prepareOnly
    ? 'Prepare-only — no auto-send'
    : growth.mode === 'limited'
      ? 'Limited autopilot (explicit opt-in)'
      : 'Manual approval required for every send';

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Growth autopilot status
      </h2>
      <p className="mt-2 text-sm text-gray-300">
        Mode: <span className="text-white">{modeLabel}</span>
      </p>
      <p className="mt-1 text-xs text-gray-500">{sendingLabel}</p>

      <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs ${deliverabilityTone(growth.deliverabilityStatus)}`}>
        Deliverability: {growth.deliverabilityStatus} · {growth.sendsToday}/{growth.recommendedDailyCap}{' '}
        sends today
      </div>

      {growth.deliverabilityReasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-400/90">
          {growth.deliverabilityReasons.slice(0, 3).map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
          While you slept
        </p>
        <p className="mt-1 text-sm text-gray-300">{growth.overnight.summaryLine}</p>
        {growth.lastCronAt ? (
          <p className="mt-2 text-[10px] text-gray-600">
            Last growth cron: {new Date(growth.lastCronAt).toLocaleString()}
          </p>
        ) : (
          <p className="mt-2 text-[10px] text-gray-600">No overnight cron run recorded yet.</p>
        )}
      </div>

      {growth.overnight.idleReasons.length > 0 &&
        growth.overnight.prospectsDiscovered +
          growth.overnight.draftsCreated +
          growth.overnight.emailsSent ===
          0 && (
          <ul className="mt-3 space-y-1 text-xs text-gray-500">
            {growth.overnight.idleReasons.slice(0, 3).map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
    </section>
  );
}
