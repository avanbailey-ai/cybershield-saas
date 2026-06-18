import type { SupabaseClient } from '@supabase/supabase-js';
import { getStoredMetrics, computeDailyMetrics, type DailyMetrics } from '@/lib/ceo/metrics';
import { getActiveInsights } from '@/lib/ceo/analyze';
import { getStoredRecommendations } from '@/lib/ceo/safety';
import { getRecentAlerts, getUnreadAlertCount } from '@/lib/ceo/alerts';
import { getChurnRiskSummary } from '@/lib/ceo/churn';
import type { CEOInsight } from '@/lib/ceo/insights';
import type { Recommendation } from '@/lib/ceo/recommendations';

export interface CeoAlertRow {
  id: string;
  alert_type: string;
  message: string;
  severity: string;
  read: boolean;
  created_at: string;
}

export interface CeoChurnSummary {
  usersAtRisk: number;
  highRisk: number;
  averageScore: number;
}

export interface CeoAdvisoryData {
  todayMetrics: DailyMetrics | null;
  yesterdayMetrics: DailyMetrics | null;
  insights: CEOInsight[];
  recommendations: Recommendation[];
  alerts: CeoAlertRow[];
  unreadAlertCount: number;
  churnRisk: CeoChurnSummary;
  lastAnalysis: string | null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const EMPTY_CEO_ADVISORY: CeoAdvisoryData = {
  todayMetrics: null,
  yesterdayMetrics: null,
  insights: [],
  recommendations: [],
  alerts: [],
  unreadAlertCount: 0,
  churnRisk: { usersAtRisk: 0, highRisk: 0, averageScore: 0 },
  lastAnalysis: null,
};

export async function loadCeoAdvisory(
  admin: SupabaseClient,
): Promise<CeoAdvisoryData> {
  const [
    todayMetrics,
    yesterdayMetrics,
    insights,
    recommendations,
    alerts,
    unreadAlertCount,
    churnRisk,
    configRes,
  ] = await Promise.all([
    getStoredMetrics(todayStr()).then((m) => m ?? null),
    getStoredMetrics(yesterdayStr()),
    getActiveInsights(30),
    getStoredRecommendations(),
    getRecentAlerts(8),
    getUnreadAlertCount(),
    getChurnRiskSummary(),
    admin.from('autopilot_config').select('value').eq('key', 'ceo_last_analysis').maybeSingle(),
  ]);

  let today = todayMetrics;
  if (!today) {
    today = await computeDailyMetrics();
  }

  return {
    todayMetrics: today,
    yesterdayMetrics,
    insights,
    recommendations,
    alerts: alerts as CeoAlertRow[],
    unreadAlertCount,
    churnRisk,
    lastAnalysis: (configRes.data?.value as string | null) ?? null,
  };
}
