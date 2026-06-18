'use client';

import Link from 'next/link';
import { useFounderNav } from '../FounderNavContext';

export default function SettingsView() {
  const { email } = useFounderNav();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-gray-500">Account and platform preferences</p>
      </header>

      <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div>
          <p className="text-sm text-gray-500">Owner account</p>
          <p className="mt-1 text-white">{email}</p>
        </div>
        <div className="border-t border-white/10 pt-4">
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            Account & password →
          </Link>
        </div>
        <div className="border-t border-white/10 pt-4">
          <Link
            href="/dashboard/admin"
            className="text-sm font-medium text-gray-400 hover:text-gray-300"
          >
            Platform admin hub →
          </Link>
        </div>
      </div>
    </div>
  );
}
