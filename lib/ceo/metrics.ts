/**
 * CEO daily metrics engine — aggregates platform KPIs for advisory analysis.
 * READ-ONLY: never mutates billing, auth, or schema.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import {
  computeFunnelDropoffs,
  funnelStagesToRecord,
  loadUnifiedEventsForWindow,
} from './funnel';
import { getEnterpriseMetrics } from './enterprise';
import { getViralMetrics } from './viral';

export interface DailyMetrics {
  date: string;
  totalUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
  scanCompletionRate: number;
  upgradeConversionRate: number;
  churnRateInactive: number;
  revenueByPlan: Record<string, { count: number; mrr: number }>;
  enterpriseLeadCount: number;
  viralReferralRate: number;
  funnelStages: Record<string, number>;
}

function dateWindow(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function computeDailyMetrics(date?: string): Promise<DailyMetrics> {
  const dateStr = date ?? todayDateStr();
  const { start, end } = dateWindow(dateStr);
  const admin = createAdminClient();

  const dayAgo = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inactiveCutoff = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    profilesRes,
    active24Res,
    active7Res,
    inactiveRes,
    events,
    enterprise,
    viral,
    displayAmounts,
  ] = await Promise.all([
    admin.from('profiles').select('plan, subscription_status, last_active_at'),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('last_active_at', dayAgo.toISOString()),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('last_active_at', weekAgo.toISOString()),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or(`last_active_at.is.null,last_active_at.lt.${inactiveCutoff.toISOString()}`),
    loadUnifiedEventsForWindow(start, end),
    getEnterpriseMetrics(start, end),
    getViralMetrics(start, end),
    getPlanDisplayAmounts(),
  ]);

  const profiles = profilesRes.data ?? [];
  const totalUsers = profiles.length;
  const activeUsers24h = active24Res.count ?? 0;
  const activeUsers7d = active7Res.count ?? 0;
  const inactiveCount = inactiveRes.count ?? 0;

  const funnelDropoffs = computeFunnelDropoffs(events);
  const funnelStages = funnelStagesToRecord(funnelDropoffs);

  const scanStarted = funnelStages.scan_started ?? 0;
  const scanCompleted = funnelStages.scan_completed ?? 0;
  const pricingViewed = funnelStages.pricing_viewed ?? 0;
  const checkoutCompleted = funnelStages.checkout_completed ?? 0;

  const revenueByPlan: Record<string, { count: number; mrr: number }> = {};
  for (const row of profiles) {
    const plan = row.plan ?? 'free';
    if (row.subscription_status !== 'active' && plan !== 'owner') continue;
    if (!revenueByPlan[plan]) revenueByPlan[plan] = { count: 0, mrr: 0 };
    revenueByPlan[plan].count++;
    const price =
      plan === 'free' || plan === 'owner'
        ? 0
        : (displayAmounts[plan as keyof typeof displayAmounts] ?? 0);
    revenueByPlan[plan].mrr += price;
  }

  return {
    date: dateStr,
    totalUsers,
    activeUsers24h,
    activeUsers7d,
    scanCompletionRate: pct(scanCompleted, scanStarted),
    upgradeConversionRate: pct(checkoutCompleted, pricingViewed),
    churnRateInactive: pct(inactiveCount, totalUsers),
    revenueByPlan,
    enterpriseLeadCount: enterprise.leadsCreated,
    viralReferralRate: viral.viralReferralRate,
    funnelStages,
  };
}

export async function getStoredMetrics(date: string): Promise<DailyMetrics | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('business_metrics_daily')
    .select('metrics')
    .eq('date', date)
    .maybeSingle();

  return (data?.metrics as DailyMetrics) ?? null;
}

export async function getYesterdayMetrics(): Promise<DailyMetrics | null> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return getStoredMetrics(yesterday.toISOString().slice(0, 10));
}

export async function snapshotDailyMetrics(date?: string): Promise<void> {
  const metrics = await computeDailyMetrics(date);
  const admin = createAdminClient();

  await admin.from('business_metrics_daily').upsert(
    {
      date: metrics.date,
      metrics,
    },
    { onConflict: 'date' },
  );
}
