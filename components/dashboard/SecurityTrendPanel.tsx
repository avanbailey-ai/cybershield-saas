'use client';

import { useEffect, useState } from 'react';
import type { SecurityTrendResult } from '@/lib/analytics/securityTrends';

interface SecurityTrendPanelProps {
  websiteId: string;
  period?: 7 | 30 | 90;
}

function trendLabel(direction: SecurityTrendResult['trend']): string {
  if (direction === 'up') return 'Improving';
  if (direction === 'down') return 'Declining';
  return 'Stable';
}

function trendColor(direction: SecurityTrendResult['trend']): string {
  if (direction === 'up') return 'text-green-400';
  if (direction === 'down') return 'text-red-400';
  return 'text-gray-400';
}

function TrendSparkline({ points }: { points: SecurityTrendResult['points'] }) {
  if (points.length < 2) return null;

  const scores = points.map((p) => p.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;
  const width = 280;
  const height = 48;

  const polyline = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * width;
      const y = height - 4 - ((s - min) / range) * (height - 8);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 w-full max-w-sm text-blue-400"
      role="img"
      aria-label="Security score trend chart"
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={polyline} />
    </svg>
  );
}

export default function SecurityTrendPanel({ websiteId, period = 30 }: SecurityTrendPanelProps) {
  const [trend, setTrend] = useState<SecurityTrendResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/analytics/security-trend?websiteId=${encodeURIComponent(websiteId)}&period=${period}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load trend');
        }
        const data = (await res.json()) as SecurityTrendResult;
        if (!cancelled) setTrend(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load trend');
          setTrend(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [websiteId, period]);

  if (loading) {
    return (
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-300">Security Trend</h2>
        <p className="mt-2 text-xs text-gray-500">Loading trend data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-300">Security Trend</h2>
        <p className="mt-2 text-xs text-gray-500">Trend data unavailable for this website.</p>
      </div>
    );
  }

  if (!trend || trend.points.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-300">Security Trend</h2>
        <p className="mt-2 text-xs text-gray-500">
          Not enough scan history yet. Run additional scans to see trends over time.
        </p>
      </div>
    );
  }

  const deltaSign = trend.delta > 0 ? '+' : '';

  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-300">Security Trend</h2>
        <span className="text-xs text-gray-500">Last {period} days</span>
      </div>

      <TrendSparkline points={trend.points} />

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <span className={`font-medium ${trendColor(trend.trend)}`}>
          {trendLabel(trend.trend)}
        </span>
        {trend.points.length >= 2 && (
          <span className="text-gray-400">
            {deltaSign}{trend.delta} pts ({deltaSign}{trend.percentChange}% vs previous scan)
          </span>
        )}
      </div>

      {trend.points.length >= 2 && (
        <ul className="mt-4 space-y-1 border-t border-gray-800 pt-3">
          {trend.points.slice(-5).map((point) => (
            <li key={point.date} className="flex justify-between text-xs text-gray-500">
              <span>{point.date}</span>
              <span className="text-gray-300">{point.score}/100</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
