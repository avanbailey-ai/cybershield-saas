'use client';

import Link from 'next/link';

const UPGRADE_COPY: Record<string, { title: string; body: string }> = {
  reports: {
    title: 'Reports require a Pro plan or higher',
    body: 'Upgrade to unlock full security reports, historical scan intelligence, and downloadable findings.',
  },
  alerts: {
    title: 'Alerts require a Pro plan or higher',
    body: 'Upgrade to receive security alerts when scans detect vulnerabilities on your monitored websites.',
  },
};

export default function SettingsUpgradeBanner({ feature }: { feature: string | null }) {
  if (!feature || !UPGRADE_COPY[feature]) return null;
  const copy = UPGRADE_COPY[feature];

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4">
      <p className="text-sm font-semibold text-blue-200">{copy.title}</p>
      <p className="mt-1 text-xs text-blue-200/80">{copy.body}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Compare plans
        </Link>
        <a href="#billing" className="inline-flex items-center text-xs font-medium text-blue-300 underline hover:text-blue-200">
          View upgrade options below
        </a>
      </div>
    </div>
  );
}
