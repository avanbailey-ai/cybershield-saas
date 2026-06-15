/**
 * CEO analysis orchestrator — compute, insight, alert pipeline.
 * ADVISORY ONLY: no auto-apply of config changes.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeDailyMetrics,
  getYesterdayMetrics,
  snapshotDailyMetrics,
  type DailyMetrics,
} from './metrics';
import { generateDailyInsights, type CEOInsight } from './insights';
import { insightsToRecommendations, type Recommendation } from './recommendations';
import { storeRecommendations } from './safety';
import { processAndNotifyAlerts, type CEOAlert } from './alerts';
import { getChurnRiskSummary } from './churn';
import { getEnterpriseMetrics } from './enterprise';
import { getViralMetrics } from './viral';

export interface CeoAnalysisResult {
  metrics: DailyMetrics;
  previousMetrics: DailyMetrics | null;
  insights: CEOInsight[];
  recommendations: Recommendation[];
  alerts: CEOAlert[];
  churnRisk: Awaited<ReturnType<typeof getChurnRiskSummary>>;
  analyzedAt: string;
}

export async function runCeoAnalysis(): Promise<CeoAnalysisResult> {
  const metrics = await computeDailyMetrics();
  await snapshotDailyMetrics(metrics.date);

  const previousMetrics = await getYesterdayMetrics();
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const admin = createAdminClient();
  const { data: weekAgoRow } = await admin
    .from('business_metrics_daily')
    .select('metrics')
    .eq('date', weekAgoStr)
    .maybeSingle();

  const weekAgoMetrics = (weekAgoRow?.metrics as DailyMetrics) ?? previousMetrics;

  const [enterprise, viral, churnRisk] = await Promise.all([
    getEnterpriseMetrics(new Date(Date.now() - 7 * 86400000)),
    getViralMetrics(new Date(Date.now() - 7 * 86400000)),
    getChurnRiskSummary(),
  ]);

  metrics.funnelStages = {
    ...metrics.funnelStages,
    enterprise_demos: enterprise.demosBooked,
  };

  const insights = generateDailyInsights(metrics, weekAgoMetrics ?? undefined);
  const recommendations = insightsToRecommendations(insights);

  const alerts = weekAgoMetrics
    ? await processAndNotifyAlerts(metrics, weekAgoMetrics)
    : [];

  const adminClient = createAdminClient();
  const now = new Date().toISOString();

  if (insights.length > 0) {
    await adminClient.from('ceo_insights').insert(
      insights.map((i) => ({
        problem: i.problem,
        impact: i.impact,
        recommended_action: i.recommended_action,
        priority: i.priority,
        category: i.category ?? null,
        metadata: { ...i.metadata, positive: i.positive ?? false, viral, enterprise },
      })),
    );
  }

  await storeRecommendations(recommendations);
  await adminClient.from('autopilot_config').upsert({
    key: 'ceo_last_analysis',
    value: now,
    updated_at: now,
  });

  return {
    metrics,
    previousMetrics,
    insights,
    recommendations,
    alerts,
    churnRisk,
    analyzedAt: now,
  };
}

export async function getActiveInsights(limit = 20): Promise<CEOInsight[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('ceo_insights')
    .select('*')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    problem: row.problem,
    impact: row.impact,
    recommended_action: row.recommended_action,
    priority: row.priority as CEOInsight['priority'],
    category: row.category ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    positive: Boolean((row.metadata as { positive?: boolean })?.positive),
  }));
}
