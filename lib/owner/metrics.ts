import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import type { BusinessOverviewMetrics, TrendWindow } from './types';

function windowStart(window: TrendWindow): Date {
  const now = new Date();
  switch (window) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d':
      return new Date(now.getTime() - 7 * 86400000);
    case '30d':
      return new Date(now.getTime() - 30 * 86400000);
    case '90d':
      return new Date(now.getTime() - 90 * 86400000);
  }
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getBusinessOverview(window: TrendWindow = '30d'): Promise<BusinessOverviewMetrics> {
  const admin = createAdminClient();
  const start = windowStart(window);
  const prevStart = new Date(start.getTime() - (Date.now() - start.getTime()));

  const [profilesRes, websitesRes, scansRes, signupsRes, prevSignupsRes, displayAmounts] =
    await Promise.all([
      admin.from('profiles').select('plan, subscription_status, created_at'),
      admin.from('websites').select('id', { count: 'exact', head: true }),
      admin
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', start.toISOString()),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', start.toISOString()),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', prevStart.toISOString())
        .lt('created_at', start.toISOString()),
      getPlanDisplayAmounts(),
    ]);

  const profiles = profilesRes.data ?? [];
  const activePaid = profiles.filter(
    (p) =>
      p.subscription_status === 'active' ||
      p.subscription_status === 'trialing' ||
      p.plan === 'owner',
  );

  let mrr = 0;
  for (const p of activePaid) {
    const plan = p.plan ?? 'free';
    if (plan === 'free') continue;
    const price = displayAmounts[plan as keyof typeof displayAmounts] ?? 0;
    mrr += price;
  }

  const upgraded = profiles.filter(
    (p) =>
      (p.plan === 'pro' || p.plan === 'growth' || p.plan === 'agency') &&
      p.created_at &&
      new Date(p.created_at) >= start,
  ).length;

  const totalUsers = profiles.length;
  const newSignups = signupsRes.count ?? 0;
  const prevSignups = prevSignupsRes.count ?? 0;
  const conversionRate =
    newSignups > 0 ? Math.round((upgraded / newSignups) * 1000) / 10 : 0;

  return {
    mrr,
    arr: mrr * 12,
    mrrGrowthPct: pctChange(newSignups, prevSignups),
    totalUsers,
    newSignups,
    websites: websitesRes.count ?? 0,
    scans: scansRes.count ?? 0,
    conversionRate,
    window,
  };
}

export async function getOverviewAllWindows(): Promise<Record<TrendWindow, BusinessOverviewMetrics>> {
  const windows: TrendWindow[] = ['today', '7d', '30d', '90d'];
  const results = await Promise.all(windows.map((w) => getBusinessOverview(w)));
  return Object.fromEntries(windows.map((w, i) => [w, results[i]])) as Record<
    TrendWindow,
    BusinessOverviewMetrics
  >;
}
