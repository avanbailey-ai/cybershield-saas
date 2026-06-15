import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import { getStoredMetrics } from '@/lib/ceo/metrics';
import { getActiveInsights } from '@/lib/ceo/analyze';
import { getStoredRecommendations } from '@/lib/ceo/safety';
import { getRecentAlerts, getUnreadAlertCount } from '@/lib/ceo/alerts';
import { getChurnRiskSummary } from '@/lib/ceo/churn';
import CeoDashboardClient from '@/components/ceo/CeoDashboardClient';

export const metadata: Metadata = {
  title: 'CEO Dashboard — Admin',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function CeoDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();

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
    const { computeDailyMetrics } = await import('@/lib/ceo/metrics');
    today = await computeDailyMetrics();
  }

  const lastAnalysis = (configRes.data?.value as string | null) ?? null;

  return (
    <CeoDashboardClient
      email={user.email ?? 'Owner'}
      todayMetrics={today}
      yesterdayMetrics={yesterdayMetrics}
      insights={insights}
      recommendations={recommendations}
      alerts={alerts}
      unreadAlertCount={unreadAlertCount}
      churnRisk={churnRisk}
      lastAnalysis={lastAnalysis}
    />
  );
}
