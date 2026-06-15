import type { SupabaseClient } from '@supabase/supabase-js';

export type TrendPeriod = '7d' | '30d' | '90d';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface SecurityTrendPoint {
  date: string;
  score: number;
}

export interface ScoreScan {
  security_score: number;
  completed_at: string;
}

export interface ScoreDelta {
  delta: number;
  percentChange: number;
  direction: TrendDirection;
}

export interface SecurityTrendResult {
  points: SecurityTrendPoint[];
  trend: TrendDirection;
  delta: number;
  percentChange: number;
  period: TrendPeriod;
}

const PERIOD_DAYS: Record<TrendPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function toPeriod(days: 7 | 30 | 90): TrendPeriod {
  if (days === 7) return '7d';
  if (days === 90) return '90d';
  return '30d';
}

function toDateKey(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export function calculateScoreDelta(
  lastScan: { security_score: number },
  previousScan: { security_score: number } | null,
): ScoreDelta {
  if (!previousScan) {
    return { delta: 0, percentChange: 0, direction: 'stable' };
  }

  const delta = lastScan.security_score - previousScan.security_score;

  let percentChange = 0;
  if (previousScan.security_score === 0) {
    percentChange = delta === 0 ? 0 : 100;
  } else {
    percentChange = (delta / previousScan.security_score) * 100;
  }

  const direction: TrendDirection =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';

  return { delta, percentChange, direction };
}

export async function getSecurityTrend(
  supabase: SupabaseClient,
  websiteId: string,
  options?: { days?: 7 | 30 | 90 },
): Promise<SecurityTrendResult> {
  const days = options?.days ?? 30;
  const period = toPeriod(days);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const { data: scans, error } = await supabase
    .from('scans')
    .select('security_score, completed_at')
    .eq('website_id', websiteId)
    .eq('status', 'completed')
    .not('security_score', 'is', null)
    .gte('completed_at', since.toISOString())
    .order('completed_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (scans ?? []) as ScoreScan[];

  const points: SecurityTrendPoint[] = rows.map((scan) => ({
    date: toDateKey(scan.completed_at),
    score: scan.security_score,
  }));

  const lastScan = rows.length > 0 ? rows[rows.length - 1] : null;
  const previousScan = rows.length > 1 ? rows[rows.length - 2] : null;

  const { delta, percentChange, direction } = lastScan
    ? calculateScoreDelta(lastScan, previousScan)
    : { delta: 0, percentChange: 0, direction: 'stable' as TrendDirection };

  return {
    points,
    trend: direction,
    delta,
    percentChange: Math.round(percentChange * 100) / 100,
    period,
  };
}
