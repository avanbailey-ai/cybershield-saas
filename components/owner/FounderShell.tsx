'use client';

import Link from 'next/link';
import LogoutButton from '@/components/dashboard/LogoutButton';
import { FOUNDER_SECTIONS, useFounderNav } from './FounderNavContext';

function sidebarStatusLabel(
  inboxCount: number,
  growth: { mode: string; prepareOnly: boolean; deliverabilityStatus: string } | undefined,
): string {
  if (inboxCount > 0) {
    return `${inboxCount} need approval`;
  }
  if (
    growth?.mode === 'limited' &&
    !growth.prepareOnly &&
    growth.deliverabilityStatus === 'healthy'
  ) {
    return 'Limited autopilot active';
  }
  if (growth?.mode === 'paused') {
    return 'Autopilot paused';
  }
  return 'Manual approval required';
}

export default function FounderShell() {
  const { section, setSection, email, founderData } = useFounderNav();
  const inboxCount = founderData.inbox.length;
  const growth = founderData.v6.growthAutopilot;
  const statusLabel = sidebarStatusLabel(inboxCount, growth);
  const showReadyDot =
    growth?.mode === 'limited' &&
    !growth.prepareOnly &&
    growth.deliverabilityStatus === 'healthy' &&
    inboxCount === 0;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#080c18]">
      <div className="border-b border-white/[0.06] px-5 py-6">
        <p className="text-base font-semibold tracking-tight text-white">Founder OS</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
          {showReadyDot && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          {statusLabel}
        </p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-0.5">
          {FOUNDER_SECTIONS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSection(m.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  section === m.id
                    ? 'bg-white/[0.08] font-medium text-white'
                    : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                }`}
              >
                {m.label}
                {m.id === 'inbox' && inboxCount > 0 && (
                  <span className="ml-2 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">
                    {inboxCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/[0.06] p-4">
        <p className="mb-3 truncate text-xs text-gray-600">{email}</p>
        <LogoutButton />
        <Link
          href="/dashboard/admin/owner"
          className="mt-3 block text-xs text-gray-600 hover:text-gray-400"
        >
          Refresh
        </Link>
      </div>
    </aside>
  );
}
