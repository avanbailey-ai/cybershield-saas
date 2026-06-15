'use client';

import { useState } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';

interface FunnelStep {
  name: string;
  count: number;
  rate_from_previous: number | null;
  dropoff_pct: number | null;
}

interface PlanRevenue {
  plan: string;
  count: number;
  mrr: number;
  ltv: number;
}

interface BusinessInsights {
  weakestFunnelStage: string;
  highestConvertingSource: string;
  bestPerformingCta: string;
  worstDropoffPoint: string;
  revenueLeakagePoints: string[];
  viralLoopConversionRate: number;
  enterpriseLeadConversionRate: number;
  generatedAt: string;
}

interface RevenueIntelligenceProps {
  email: string;
  funnel: FunnelStep[];
  planRevenue: PlanRevenue[];
  churnRiskCount: number;
  enterprisePipelineValue: number;
  viralAcquisitionPct: number;
  insights: BusinessInsights | null;
  brainConfig: Record<string, unknown>;
}

export default function RevenueIntelligenceClient({
  email,
  funnel,
  planRevenue,
  churnRiskCount,
  enterprisePipelineValue,
  viralAcquisitionPct,
  insights,
  brainConfig,
}: RevenueIntelligenceProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const totalMrr = planRevenue.reduce((sum, p) => sum + p.mrr, 0);
  const totalLtv = planRevenue.reduce((sum, p) => sum + p.ltv * p.count, 0);

  async function runBrainOptimization() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/brain/optimize', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Optimization failed');
        return;
      }
      setLastResult(
        `Applied: ${(data.applied as string[]).join(', ')} | Churn scanned: ${data.churn?.scanned ?? 0}`,
      );
      window.location.reload();
    } catch {
      setError('Network error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={email} title="Revenue Intelligence" />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Revenue Intelligence</h2>
            <p className="mt-1 text-sm text-gray-500">
              Unified brain loop — funnel, LTV, churn, enterprise & viral metrics
            </p>
          </div>
          <button
            type="button"
            onClick={runBrainOptimization}
            disabled={running}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60"
          >
            {running ? 'Optimizing…' : 'Run Brain Optimization'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {lastResult && (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            {lastResult}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total MRR" value={`$${totalMrr.toLocaleString()}`} />
          <MetricCard label="Est. LTV (3mo)" value={`$${totalLtv.toLocaleString()}`} />
          <MetricCard label="Churn Risk (>70)" value={String(churnRiskCount)} accent="red" />
          <MetricCard
            label="Enterprise Pipeline"
            value={`$${enterprisePipelineValue.toLocaleString()}`}
            accent="blue"
          />
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Revenue per Plan</h3>
            <ul className="space-y-2">
              {planRevenue.map((p) => (
                <li
                  key={p.plan}
                  className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3 text-sm"
                >
                  <span className="capitalize text-gray-300">{p.plan}</span>
                  <span className="text-gray-400">
                    {p.count} users · ${p.mrr}/mo · LTV ${p.ltv}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Funnel Conversion Rates</h3>
            <ul className="space-y-2">
              {funnel.map((step) => (
                <li
                  key={step.name}
                  className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3 text-sm"
                >
                  <span className="text-gray-300">{step.name.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-white">
                    {step.count}{' '}
                    {step.rate_from_previous !== null && (
                      <span className="text-gray-500">({step.rate_from_previous}%)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Viral Acquisition %"
            value={`${viralAcquisitionPct}%`}
            accent="green"
          />
          {insights && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
              <h3 className="mb-2 text-sm font-semibold text-white">Latest Brain Insights</h3>
              <p className="text-xs text-gray-500">
                Generated {new Date(insights.generatedAt).toLocaleString()}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-gray-400">
                <li>
                  Weakest stage:{' '}
                  <span className="text-white">{insights.weakestFunnelStage}</span>
                </li>
                <li>
                  Worst dropoff:{' '}
                  <span className="text-white">{insights.worstDropoffPoint}</span>
                </li>
                <li>
                  Best CTA: <span className="text-white">{insights.bestPerformingCta}</span>
                </li>
                <li>
                  Enterprise conv:{' '}
                  <span className="text-white">{insights.enterpriseLeadConversionRate}%</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Active Brain Config</h3>
          <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-400">
            {JSON.stringify(brainConfig, null, 2)}
          </pre>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'red' | 'blue' | 'green';
}) {
  const accentClass =
    accent === 'red'
      ? 'border-red-500/30'
      : accent === 'blue'
        ? 'border-blue-500/30'
        : accent === 'green'
          ? 'border-green-500/30'
          : 'border-gray-800';

  return (
    <div className={`rounded-xl border ${accentClass} bg-gray-900/50 p-5`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
