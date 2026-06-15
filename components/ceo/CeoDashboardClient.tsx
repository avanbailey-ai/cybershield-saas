'use client';

import { useState } from 'react';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import type { DailyMetrics } from '@/lib/ceo/metrics';
import type { CEOInsight } from '@/lib/ceo/insights';
import type { Recommendation } from '@/lib/ceo/recommendations';

interface CeoAlertRow {
  id: string;
  alert_type: string;
  message: string;
  severity: string;
  read: boolean;
  created_at: string;
}

interface ChurnSummary {
  usersAtRisk: number;
  highRisk: number;
  averageScore: number;
}

interface CeoDashboardProps {
  email: string;
  todayMetrics: DailyMetrics | null;
  yesterdayMetrics: DailyMetrics | null;
  insights: CEOInsight[];
  recommendations: Recommendation[];
  alerts: CeoAlertRow[];
  unreadAlertCount: number;
  churnRisk: ChurnSummary;
  lastAnalysis: string | null;
}

function metricDelta(current: number, previous: number | undefined): string {
  if (previous === undefined || previous === 0) return '';
  const delta = Math.round(((current - previous) / previous) * 100);
  if (delta === 0) return ' —';
  const sign = delta > 0 ? '+' : '';
  return ` (${sign}${delta}%)`;
}

function FunnelBars({ stages }: { stages: Record<string, number> }) {
  const ordered = [
    'landing_view',
    'scan_started',
    'scan_completed',
    'report_viewed',
    'pricing_viewed',
    'checkout_started',
    'checkout_completed',
  ];
  const max = Math.max(...ordered.map((s) => stages[s] ?? 0), 1);

  return (
    <div className="space-y-3">
      {ordered.map((stage) => {
        const count = stages[stage] ?? 0;
        const width = Math.max(4, Math.round((count / max) * 100));
        return (
          <div key={stage}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-gray-400">{stage.replace(/_/g, ' ')}</span>
              <span className="font-medium text-white">{count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CeoDashboardClient({
  email,
  todayMetrics,
  yesterdayMetrics,
  insights,
  recommendations: initialRecs,
  alerts,
  unreadAlertCount,
  churnRisk,
  lastAnalysis,
}: CeoDashboardProps) {
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState(initialRecs);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const issues = insights.filter((i) => !i.positive && i.priority === 'high').slice(0, 3);
  const opportunities = insights.filter((i) => i.positive).slice(0, 3);

  async function runAnalysis() {
    setRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/ceo/analyze', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Analysis failed');
        return;
      }
      setSuccess('Analysis complete — refreshing…');
      window.location.reload();
    } catch {
      setError('Network error');
    } finally {
      setRunning(false);
    }
  }

  async function applySuggestion(recId: string) {
    setApplying(recId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/ceo/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: recId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Apply failed');
        return;
      }
      setRecommendations((prev) => prev.filter((r) => r.id !== recId));
      setSuccess(`Applied: ${Object.keys(data.applied ?? {}).join(', ')}`);
    } catch {
      setError('Network error');
    } finally {
      setApplying(null);
    }
  }

  const m = todayMetrics;
  const y = yesterdayMetrics;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={email} title="CEO Dashboard" />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Autonomous CEO — Advisory</h2>
            <p className="mt-1 text-sm text-gray-500">
              Decision-support only · No auto-execute · Owner: {email}
            </p>
            {lastAnalysis && (
              <p className="mt-1 text-xs text-gray-600">
                Last analysis: {new Date(lastAnalysis).toLocaleString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={running}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {running ? 'Analyzing…' : 'Run analysis'}
          </button>
        </div>

        {unreadAlertCount > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {unreadAlertCount} unread CEO alert{unreadAlertCount !== 1 ? 's' : ''}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {success}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total users', value: m?.totalUsers ?? 0, prev: y?.totalUsers },
            { label: 'Active 24h', value: m?.activeUsers24h ?? 0, prev: y?.activeUsers24h },
            { label: 'Scan completion', value: `${m?.scanCompletionRate ?? 0}%`, prev: y?.scanCompletionRate, raw: false },
            { label: 'Upgrade conversion', value: `${m?.upgradeConversionRate ?? 0}%`, prev: y?.upgradeConversionRate, raw: false },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {stat.value}
                {typeof stat.prev === 'number' && (
                  <span className="text-sm font-normal text-gray-500">
                    {metricDelta(
                      typeof stat.value === 'string' ? parseFloat(stat.value) : stat.value,
                      stat.prev,
                    )}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Conversion funnel</h3>
            <FunnelBars stages={m?.funnelStages ?? {}} />
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Retention</h3>
            <p className="text-3xl font-bold text-white">{churnRisk.usersAtRisk}</p>
            <p className="mt-1 text-sm text-gray-500">Users at risk (score ≥ 60)</p>
            <p className="mt-3 text-sm text-gray-400">
              High risk (&gt;70): <span className="text-white">{churnRisk.highRisk}</span>
              {' · '}
              Avg score: <span className="text-white">{churnRisk.averageScore}</span>
            </p>
            <Link
              href="/dashboard/admin/revenue-intelligence"
              className="mt-4 inline-block text-xs text-blue-400 hover:text-blue-300"
            >
              Revenue intelligence →
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-red-400">Top 3 issues</h3>
            {issues.length === 0 ? (
              <p className="text-sm text-gray-500">No high-priority issues — run analysis</p>
            ) : (
              <ul className="space-y-3">
                {issues.map((item, i) => (
                  <li key={item.id ?? i} className="rounded-lg bg-gray-800/40 p-3 text-sm">
                    <p className="font-medium text-white">{item.problem}</p>
                    <p className="mt-1 text-gray-500">{item.impact}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-emerald-400">Top 3 opportunities</h3>
            {opportunities.length === 0 ? (
              <p className="text-sm text-gray-500">No positive signals yet</p>
            ) : (
              <ul className="space-y-3">
                {opportunities.map((item, i) => (
                  <li key={item.id ?? i} className="rounded-lg bg-gray-800/40 p-3 text-sm">
                    <p className="font-medium text-white">{item.problem}</p>
                    <p className="mt-1 text-gray-500">{item.recommended_action}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Recommended actions</h3>
          <p className="mb-4 text-xs text-gray-500">
            Manual apply only — updates safe autopilot_config keys, logged to audit_logs
          </p>
          {recommendations.length === 0 ? (
            <p className="text-sm text-gray-500">No pending recommendations</p>
          ) : (
            <ul className="space-y-4">
              {recommendations.map((rec) => (
                <li
                  key={rec.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-800 bg-gray-800/30 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${
                          rec.priority === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : rec.priority === 'medium'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {rec.priority}
                      </span>
                      <span className="text-xs text-gray-500">{rec.action}</span>
                    </div>
                    <p className="mt-2 font-medium text-white">{rec.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{rec.description}</p>
                    {Object.keys(rec.configPreview).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-400">
                        {JSON.stringify(rec.configPreview, null, 2)}
                      </pre>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => applySuggestion(rec.id)}
                    disabled={applying === rec.id || Object.keys(rec.configPreview).length === 0}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {applying === rec.id ? 'Applying…' : 'Apply suggestion'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {alerts.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Recent alerts</h3>
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-lg px-4 py-3 text-sm ${
                    a.severity === 'critical'
                      ? 'bg-red-500/10 text-red-300'
                      : a.severity === 'warning'
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-gray-800/40 text-gray-300'
                  }`}
                >
                  <span className="font-medium">{a.alert_type}</span>: {a.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
