'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFounderNav } from '../FounderNavContext';
import type { AutoArchiveSettings } from '@/lib/owner/autoArchive';
import type { OutreachExecutionSettings } from '@/lib/owner/outreachSettings';
import {
  AUTOPILOT_MODE_LABELS,
  type GrowthAutopilotMode,
  type GrowthAutopilotSettings,
} from '@/lib/owner/growthAutopilotSettings';

export default function SettingsView() {
  const { email, founderData } = useFounderNav();
  const [settings, setSettings] = useState<AutoArchiveSettings | null>(null);
  const [outreach, setOutreach] = useState<OutreachExecutionSettings | null>(null);
  const [growthSettings, setGrowthSettings] = useState<GrowthAutopilotSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const growthStatus = founderData.v6.growthAutopilot;

  useEffect(() => {
    fetch('/api/owner/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
        if (d.outreach) setOutreach(d.outreach);
        if (d.growthAutopilot) setGrowthSettings(d.growthAutopilot);
      });
  }, []);

  async function saveAll() {
    if (!settings || !outreach) return;
    setSaving(true);
    try {
      const res = await fetch('/api/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          outreach,
          growthAutopilot: growthSettings ?? undefined,
        }),
      });
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.outreach) setOutreach(data.outreach);
      if (data.growthAutopilot) setGrowthSettings(data.growthAutopilot);
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
            href="/app/settings"
            className="text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            Account & password →
          </Link>
        </div>
      </div>

      {growthSettings && (
        <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="text-lg font-medium text-white">Growth autopilot</h2>
          <p className="text-sm text-gray-500">
            Nightly discovery, scanning, and draft preparation. Sending always requires your
            approval unless you explicitly enable limited autopilot with healthy deliverability.
          </p>
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            Current status: {growthStatus.prepareOnly ? 'Prepare-only' : growthStatus.mode} ·{' '}
            {growthStatus.deliverabilityStatus} deliverability ·{' '}
            {growthStatus.sendsToday}/{growthStatus.recommendedDailyCap} sends today
          </p>
          <label className="block text-sm">
            <span className="text-gray-400">Mode</span>
            <select
              value={growthSettings.mode}
              onChange={(e) =>
                setGrowthSettings({
                  ...growthSettings,
                  mode: e.target.value as GrowthAutopilotMode,
                  limited_autopilot_sending: e.target.value === 'limited',
                })
              }
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
            >
              {(Object.keys(AUTOPILOT_MODE_LABELS) as GrowthAutopilotMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {AUTOPILOT_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={growthSettings.prepare_only}
              onChange={(e) =>
                setGrowthSettings({ ...growthSettings, prepare_only: e.target.checked })
              }
            />
            Prepare-only (discover/scan/draft — no automatic sends)
          </label>
          <label className="block text-sm">
            <span className="text-gray-400">Warmup week (daily send cap)</span>
            <select
              value={growthSettings.warmup_week}
              onChange={(e) =>
                setGrowthSettings({
                  ...growthSettings,
                  warmup_week: Number(e.target.value) as 1 | 2 | 3,
                })
              }
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
            >
              <option value={1}>Week 1 — up to 10/day</option>
              <option value={2}>Week 2 — up to 20/day</option>
              <option value={3}>Week 3 — up to 30/day</option>
            </select>
          </label>
          {growthSettings.mode === 'limited' && (
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={growthSettings.limited_autopilot_sending}
                onChange={(e) =>
                  setGrowthSettings({
                    ...growthSettings,
                    limited_autopilot_sending: e.target.checked,
                  })
                }
              />
              Enable limited autopilot sending (low-risk only, deliverability guard must pass)
            </label>
          )}
        </div>
      )}

      {outreach && (
        <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="text-lg font-medium text-white">Outreach automation</h2>
          <p className="text-sm text-gray-500">
            Control Resend delivery, limits, and follow-up schedule. Approval is required by default.
          </p>
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            Manual sends (approval required) have no daily count cap. Sending still requires healthy
            SPF/DKIM/DMARC and stays paused if bounce or spam rates spike.
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={outreach.enable_outreach_sending}
              onChange={(e) =>
                setOutreach({ ...outreach, enable_outreach_sending: e.target.checked })
              }
            />
            Enable outreach sending
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={outreach.require_approval}
              onChange={(e) =>
                setOutreach({ ...outreach, require_approval: e.target.checked })
              }
            />
            Require founder approval before send
          </label>
          {!outreach.require_approval && (
            <label className="block text-sm">
              <span className="text-gray-400">Daily outreach limit (autopilot / unapproved sends only)</span>
              <input
                type="number"
                min={1}
                value={outreach.daily_outreach_limit}
                onChange={(e) =>
                  setOutreach({
                    ...outreach,
                    daily_outreach_limit: Number(e.target.value) || 1,
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-gray-400">Sender email (Resend verified)</span>
            <input
              type="text"
              value={outreach.sender_email}
              onChange={(e) => setOutreach({ ...outreach, sender_email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-400">Follow-up schedule (days, comma-separated)</span>
            <input
              type="text"
              value={outreach.follow_up_schedule.join(', ')}
              onChange={(e) =>
                setOutreach({
                  ...outreach,
                  follow_up_schedule: e.target.value
                    .split(',')
                    .map((s) => Number(s.trim()))
                    .filter((n) => n > 0),
                })
              }
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
            />
          </label>
        </div>
      )}

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
        </div>
      )}

      {(settings || outreach || growthSettings) && (
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      )}
    </div>
  );
}
