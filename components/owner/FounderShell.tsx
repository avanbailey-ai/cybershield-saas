'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import LogoutButton from '@/components/dashboard/LogoutButton';

const MODULES = [
  { id: 'briefing', label: 'Daily Briefing' },
  { id: 'overview', label: 'Business Overview' },
  { id: 'prospects', label: 'Lead Discovery' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'social', label: 'Social Studio' },
  { id: 'video', label: 'Video Ads' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'crm', label: 'Lead CRM' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'content-performance', label: 'Content Perf.' },
  { id: 'insights', label: 'Insights' },
  { id: 'customer-intel', label: 'Customer Intel' },
  { id: 'data-moat', label: 'Data Moat' },
];

export default function FounderShell({
  children,
  email,
}: {
  children: ReactNode;
  email: string;
}) {
  const pathname = usePathname();

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="flex h-full min-h-screen w-full overflow-hidden bg-[#050810]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-violet-500/10 bg-[#080c18]">
        <div className="border-b border-violet-500/10 px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Founder OS</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-violet-400">
                Growth Command Center
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            Modules
          </p>
          <ul className="space-y-0.5">
            {MODULES.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(m.id)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition hover:bg-violet-500/10 hover:text-white"
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>

          <p className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            System
          </p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/dashboard/admin"
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  pathname.startsWith('/dashboard/admin') && !pathname.includes('/owner')
                    ? 'bg-violet-500/10 text-white'
                    : 'text-gray-400 hover:bg-violet-500/10 hover:text-white'
                }`}
              >
                Admin Hub
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard"
                className="block rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:bg-violet-500/10 hover:text-white"
              >
                Customer Dashboard
              </Link>
            </li>
          </ul>
        </nav>

        <div className="border-t border-violet-500/10 p-3">
          <p className="mb-2 truncate px-2 text-xs text-gray-500">{email}</p>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
