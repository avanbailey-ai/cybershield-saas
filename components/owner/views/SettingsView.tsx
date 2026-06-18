'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFounderNav } from '../FounderNavContext';
import type { AutoArchiveSettings } from '@/lib/owner/autoArchive';

export default function SettingsView() {
  const { email } = useFounderNav();
  const [settings, setSettings] = useState<AutoArchiveSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/owner/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      });
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } finally {
      setSaving(false);
    }
  }

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

      {settings && (
        <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="text-lg font-medium text-white">Auto-archive</h2>
          <p className="text-sm text-gray-500">
            Automatically archive inactive items during nightly discovery runs.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['prospectInactiveDays', 'Inactive prospects (days)'],
                ['campaignCompletedDays', 'Completed campaigns (days)'],
                ['alertResolvedDays', 'Resolved alerts (days)'],
                ['scanActivityDays', 'Scan activity (days)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-gray-400">{label}</span>
                <input
                  type="number"
                  min={1}
                  value={settings[key]}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: Number(e.target.value) || 1 })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save auto-archive settings'}
          </button>
        </div>
      )}
    </div>
  );
}
