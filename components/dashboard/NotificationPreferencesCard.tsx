'use client';

import { useCallback, useState } from 'react';
import type { NotificationPreferences } from '@/lib/notifications/preferences';

type PrefKey = keyof NotificationPreferences;

const PREF_META: Array<{
  key: PrefKey;
  label: string;
  description: string;
}> = [
  {
    key: 'criticalAlerts',
    label: 'Monitoring & critical alerts',
    description: 'Immediate emails when CyberShield detects critical SSL, security, or website changes.',
  },
  {
    key: 'weeklyDigest',
    label: 'Weekly security digest',
    description: 'A summary of scores and changes for all monitored websites.',
  },
  {
    key: 'monthlyReport',
    label: 'Monthly security report',
    description: 'A monthly overview of your security posture across monitored sites.',
  },
  {
    key: 'allClearUpdates',
    label: 'All-clear updates',
    description: 'Occasional emails when no important changes were detected — reassurance your sites stayed healthy.',
  },
];

interface NotificationPreferencesCardProps {
  initialPreferences: NotificationPreferences;
  emailAlertsAvailable: boolean;
}

export default function NotificationPreferencesCard({
  initialPreferences,
  emailAlertsAvailable,
}: NotificationPreferencesCardProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const updatePreference = useCallback(async (key: PrefKey, enabled: boolean) => {
    const previous = preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: enabled }));
    setSavingKey(key);
    setError(null);

    try {
      const res = await fetch('/api/user/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: enabled }),
      });

      const data = (await res.json()) as { error?: string; preferences?: NotificationPreferences };

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save');
      }

      if (data.preferences) {
        setPreferences(data.preferences);
      }
      setSavedAt(Date.now());
    } catch (err) {
      setPreferences((prev) => ({ ...prev, [key]: previous }));
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSavingKey(null);
    }
  }, [preferences]);

  return (
    <div>
      <p className="mb-4 text-xs text-gray-500">
        Choose which security emails CyberShield sends to your account email address.
        {!emailAlertsAvailable && (
          <>
            {' '}
            Monitoring emails require a Pro plan or higher — preferences are saved for when you upgrade.
          </>
        )}
      </p>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {savedAt && Date.now() - savedAt < 4000 && !error && (
        <p className="mb-3 text-xs text-emerald-400">Preferences saved.</p>
      )}

      <ul className="space-y-3">
        {PREF_META.map(({ key, label, description }) => {
          const enabled = preferences[key];
          const isSaving = savingKey === key;

          return (
            <li
              key={key}
              className="flex items-start justify-between gap-4 rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-200">{label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={label}
                disabled={isSaving}
                onClick={() => void updatePreference(key, !enabled)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 ${
                  enabled ? 'bg-indigo-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
