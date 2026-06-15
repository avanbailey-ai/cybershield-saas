import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import { getFunnelMetrics } from '@/lib/analytics/autopilot';
import { parseAutopilotConfig } from '@/lib/analytics/autopilotConfig';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';

const AnalyticsDashboardClient = dynamic(
  () => import('@/components/analytics/AnalyticsDashboardClient'),
  { loading: () => <div className="flex flex-1 items-center justify-center p-12 text-gray-500">Loading analytics…</div> },
);

export const metadata: Metadata = {
  title: 'Analytics — Admin',
};

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();

  const [funnel, experimentsRes, profilesRes, configRes, displayAmounts] = await Promise.all([
    getFunnelMetrics(7),
    admin.from('experiments').select('*').order('name'),
    admin.from('profiles').select('plan, subscription_status'),
    admin.from('autopilot_config').select('key, value'),
    getPlanDisplayAmounts(),
  ]);

  const experiments = (experimentsRes.data ?? []).map((exp) => ({
    name: exp.name as string,
    impressions_a: exp.impressions_a as number,
    impressions_b: exp.impressions_b as number,
    conversions_a: exp.conversions_a as number,
    conversions_b: exp.conversions_b as number,
    rate_a: exp.impressions_a > 0 ? exp.conversions_a / exp.impressions_a : 0,
    rate_b: exp.impressions_b > 0 ? exp.conversions_b / exp.impressions_b : 0,
    winner: exp.winner as string | null,
    active: exp.active as boolean,
  }));

  const planCounts = (profilesRes.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const plan = row.plan ?? 'free';
    if (row.subscription_status === 'active' || plan === 'owner') {
      acc[plan] = (acc[plan] ?? 0) + 1;
    }
    return acc;
  }, {});

  const planRevenue = Object.entries(planCounts).map(([plan, count]) => {
    const price =
      plan === 'free' || plan === 'owner'
        ? 0
        : (displayAmounts[plan as keyof typeof displayAmounts] ?? 0);
    return { plan, count, mrr: price * count };
  });

  const settings = parseAutopilotConfig(configRes.data ?? []);

  return (
    <AnalyticsDashboardClient
      email={user.email ?? 'Owner'}
      funnel={funnel}
      experiments={experiments}
      planRevenue={planRevenue}
      autopilotLastRun={settings.autopilot_last_run}
      recommendations={settings.autopilot_recommendations}
      config={{
        highlighted_plan: settings.highlighted_plan,
        cta_placement: settings.cta_placement,
        headline_variant: settings.headline_variant,
        paywall_delay_ms: settings.paywall_delay_ms,
      }}
    />
  );
}
