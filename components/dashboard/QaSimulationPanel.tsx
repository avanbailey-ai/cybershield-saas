'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const PLANS = [
  { id: 'pro' as const, label: 'Pro', detail: 'Daily monitoring, reports, email alerts' },
  { id: 'growth' as const, label: 'Growth', detail: 'Hourly checks + change timeline' },
  { id: 'agency' as const, label: 'Agency', detail: 'Multi-site limits + priority monitoring (standard dashboard)' },
];

interface QaSimulationPanelProps {
  initialPlan: 'pro' | 'growth' | 'agency';
  initialEnterpriseEnabled: boolean;
}

export default function QaSimulationPanel({
  initialPlan,
  initialEnterpriseEnabled,
}: QaSimulationPanelProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [enterpriseEnabled, setEnterpriseEnabled] = useState(initialEnterpriseEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function patchQa(body: { plan?: 'pro' | 'growth' | 'agency'; enterpriseEnabled?: boolean }) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/qa-simulated-plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to update QA settings');
      }
      const data = (await res.json()) as {
        qaSimulatedPlan?: 'pro' | 'growth' | 'agency';
        qaEnterpriseEnabled?: boolean;
      };
      if (data.qaSimulatedPlan) setPlan(data.qaSimulatedPlan);
      if (typeof data.qaEnterpriseEnabled === 'boolean') {
        setEnterpriseEnabled(data.qaEnterpriseEnabled);
      }
      setMessage('QA settings saved. Reload the page to refresh routing and gates.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-amber-200">QA Customer Simulation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Simulates paid customer plans without Stripe. Billing pages remain available for UI testing.
        </p>
        <p className="text-xs text-amber-300/90">
          Simulated plan: <span className="font-semibold uppercase">{plan}</span>
          {' · '}
          Enterprise portal:{' '}
          <span className="font-semibold">{enterpriseEnabled ? 'enabled' : 'off'}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={saving || plan === p.id}
              onClick={() => patchQa({ plan: p.id })}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                plan === p.id
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                  : 'border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-600'
              }`}
            >
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-gray-500">{p.detail}</span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={enterpriseEnabled}
            disabled={saving}
            onChange={(e) => patchQa({ enterpriseEnabled: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium text-gray-200">Enable Enterprise portal simulation</span>
            <span className="block text-xs text-gray-500">
              Off by default. Turn on only when testing /enterprise/portal (requires Growth or Agency plan).
            </span>
          </span>
        </label>
        {message && <p className="text-xs text-gray-400">{message}</p>}
      </CardContent>
    </Card>
  );
}
