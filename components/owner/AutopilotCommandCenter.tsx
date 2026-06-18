'use client';

import type { FounderInboxItem } from '@/lib/owner/founderOsV5';
import { useFounderNav } from './FounderNavContext';
import type { FounderSectionId } from '@/lib/owner/founderNav';

export default function AutopilotCommandCenter({
  autopilot,
  onApproveAll,
  onApproveOne,
  busy,
}: {
  autopilot: {
    outreachDrafts: number;
    followUps: number;
    expansionOpportunities: number;
    items: FounderInboxItem[];
  };
  onApproveAll: () => void;
  onApproveOne: (id: string) => void;
  busy?: boolean;
}) {
  const total = autopilot.outreachDrafts + autopilot.expansionOpportunities;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Autopilot command center
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            CyberShield works overnight. You approve what ships.
          </p>
        </div>
        {total > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={onApproveAll}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Approve all ({total})
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Outreach drafts" value={autopilot.outreachDrafts} />
        <Stat label="Follow-ups queued" value={autopilot.followUps} />
        <Stat label="Expansion signals" value={autopilot.expansionOpportunities} />
      </div>
      {autopilot.items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Autopilot is caught up. No approvals pending.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {autopilot.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onApproveOne(item.id)}
                  className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
      <p className="text-[10px] uppercase text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function FounderInboxList({
  items,
  onApprove,
  busy,
}: {
  items: FounderInboxItem[];
  onApprove: (id: string) => void;
  busy?: boolean;
}) {
  const { setSection } = useFounderNav();

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Inbox clear. CyberShield is handling routine work — nothing needs your approval right now.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-4"
        >
          <div>
            <p className="font-medium text-white">{item.title}</p>
            <p className="mt-1 text-sm text-gray-500">{item.description}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onApprove(item.id)}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {item.action}
            </button>
            <button
              type="button"
              onClick={() => setSection(item.module as FounderSectionId)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500/50"
            >
              Review
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
