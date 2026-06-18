'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const PLANS = [
  { id: 'pro' as const, label: 'Pro', detail: 'Daily monitoring, reports, email alerts' },
  { id: 'growth' as const, label: 'Growth', detail: 'Hourly checks + change timeline' },
  { id: 'agency' as const, label: 'Agency', detail: 'Enterprise portal + priority monitoring' },
];

interface QaSimulationPanelProps {
  initialPlan: 'pro' | 'growth' | 'agency';
}

export default function QaSimulationPanel({ initialPlan }: QaSimulationPanelProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function switchPlan(next: 'pro' | 'growth' | 'agency') {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/qa-simulated-plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to update QA plan');
      }
      setPlan(next);
      setMessage(`Simulating ${next} access. Reload the page to refresh all gates.`);
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
          Internal testing mode — simulates paid subscription access without Stripe charges.
          Billing pages remain available for UI testing.
        </p>
        <p className="text-xs text-amber-300/90">
          Active simulation: <span className="font-semibold uppercase">{plan}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={saving || plan === p.id}
              onClick={() => switchPlan(p.id)}
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
        {message && <p className="text-xs text-gray-400">{message}</p>}
      </CardContent>
    </Card>
  );
}
