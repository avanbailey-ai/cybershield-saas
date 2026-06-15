'use client';

import { useState } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';

interface FunnelStep {
  name: string;
  count: number;
  rate_from_previous: number | null;
  dropoff_pct: number | null;
}

interface ExperimentSummary {
  name: string;
  impressions_a: number;
  impressions_b: number;
  conversions_a: number;
  conversions_b: number;
  rate_a: number;
  rate_b: number;
  winner: string | null;
  active: boolean;
}

interface AutopilotRecommendation {
  step: string;
  dropoff_pct: number;
  action: string;
}

interface AnalyticsDashboardProps {
  email: string;
  funnel: FunnelStep[];
  experiments: ExperimentSummary[];
  planRevenue: { plan: string; count: number; mrr: number }[];
  autopilotLastRun: string | null;
  recommendations: AutopilotRecommendation[];
  config: Record<string, unknown>;
}

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${rate}%`;
}

export default function AnalyticsDashboardClient({
  email,
  funnel,
  experiments,
  planRevenue,
  autopilotLastRun,
  recommendations,
  config,
}: AnalyticsDashboardProps) {
  const [running, setRunning] = useState(false);
  const [lastReport, setLastReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAutopilot() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/autopilot/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to run autopilot');
        return;
      }
      setLastReport(JSON.stringify(data.report, null, 2));
      window.location.reload();
    } catch {
      setError('Network error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={email} title="Analytics & Autopilot" />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Conversion Analytics</h2>
            <p className="mt-1 text-sm text-gray-500">Last 7 days — logic-first autopilot engine</p>
          </div>
          <button
            type="button"
            onClick={runAutopilot}
            disabled={running}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {running ? 'Running…' : 'Run Autopilot Analysis'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Conversion Funnel</h3>
            <div className="space-y-2">
              {funnel.map((step) => (
                <div
                  key={step.name}
                  className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3 text-sm"
                >
                  <span className="text-gray-300">{step.name.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-white">{step.count}</span>
                    <span className="text-xs text-gray-500">
                      {formatRate(step.rate_from_previous)}
                      {step.dropoff_pct !== null && step.dropoff_pct > 0 && (
                        <span className="ml-2 text-red-400">−{step.dropoff_pct}%</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Revenue by Plan</h3>
            <ul className="space-y-2">
              {planRevenue.map(({ plan, count, mrr }) => (
                <li
                  key={plan}
                  className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3 text-sm"
                >
                  <span className="capitalize text-gray-300">{plan}</span>
                  <div className="text-right">
                    <span className="font-semibold text-white">{count} users</span>
                    {mrr > 0 && (
                      <span className="ml-3 text-green-400">${mrr}/mo MRR</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Active Experiments</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {experiments.map((exp) => (
              <div key={exp.name} className="rounded-lg border border-gray-700/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{exp.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      exp.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {exp.active ? 'Active' : exp.winner ? `Winner: ${exp.winner}` : 'Inactive'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div>
                    <p className="text-gray-500">Variant A</p>
                    <p>{exp.impressions_a} imp · {(exp.rate_a * 100).toFixed(1)}% conv</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Variant B</p>
                    <p>{exp.impressions_b} imp · {(exp.rate_b * 100).toFixed(1)}% conv</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-2 text-sm font-semibold text-white">Autopilot Status</h3>
            <p className="text-sm text-gray-400">
              Last run:{' '}
              {autopilotLastRun
                ? new Date(autopilotLastRun).toLocaleString()
                : 'Never'}
            </p>
            {recommendations.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="rounded-lg bg-gray-800/40 px-3 py-2 text-sm text-gray-300">
                    <span className="font-medium text-yellow-400">{rec.step}</span>
                    {' — '}
                    {rec.action}
                    <span className="ml-2 text-xs text-red-400">({rec.dropoff_pct}% dropoff)</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No recommendations yet. Run autopilot analysis.</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-2 text-sm font-semibold text-white">Current UI Config</h3>
            <pre className="overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-400">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        </div>

        {lastReport && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-2 text-sm font-semibold text-white">Latest Report</h3>
            <pre className="overflow-auto text-xs text-gray-400">{lastReport}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
