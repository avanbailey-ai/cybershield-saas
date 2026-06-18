import nextDynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import { getFunnelMetrics } from '@/lib/analytics/autopilot';
import { getLatestInsights } from '@/lib/brain/insights';
import { getBrainConfig } from '@/lib/brain/optimizer';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { isQualifiableLead } from '@/lib/sales/leadValidation';

const RevenueIntelligenceClient = nextDynamic(
  () => import('@/components/analytics/RevenueIntelligenceClient'),
  { loading: () => <div className="flex flex-1 items-center justify-center p-12 text-gray-500">Loading revenue intelligence…</div> },
);

export const metadata: Metadata = {
  title: 'Revenue Intelligence — Admin',
};

export const dynamic = 'force-dynamic';

const LTV_MONTHS = 3;

export default async function RevenueIntelligencePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();

  const [funnel, insights, brainConfig, profilesRes, pipelineRes, leadsRes, viralRes, signupCountRes, displayAmounts] =
    await Promise.all([
      getFunnelMetrics(30),
      getLatestInsights(),
      getBrainConfig(),
      admin.from('profiles').select('plan, subscription_status, churn_risk_score'),
      admin.from('enterprise_pipeline').select('lead_id, value_estimate'),
      admin.from('enterprise_leads').select('id, status, company, email, domain, message'),
      admin
        .from('viral_events')
        .select('event_type')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      getPlanDisplayAmounts(),
    ]);

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
    return {
      plan,
      count,
      mrr: price * count,
      ltv: price * LTV_MONTHS,
    };
  });

  const churnRiskCount = (profilesRes.data ?? []).filter(
    (p) => (p.churn_risk_score ?? 0) > 70,
  ).length;

  const leadsById = new Map((leadsRes.data ?? []).map((lead) => [lead.id, lead]));

  const enterprisePipelineValue = (pipelineRes.data ?? []).reduce((sum, row) => {
    const lead = leadsById.get(row.lead_id);
    if (!lead || !isQualifiableLead(lead)) return sum;
    return sum + Number(row.value_estimate ?? 0);
  }, 0);

  const viralEvents = viralRes.data ?? [];
  const referralConverted = viralEvents.filter((e) => e.event_type === 'referral_converted').length;
  const signups = signupCountRes.count ?? 0;
  const viralAcquisitionPct =
    signups > 0 ? Math.round((referralConverted / signups) * 1000) / 10 : 0;

  return (
    <RevenueIntelligenceClient
      email={user.email ?? 'Owner'}
      funnel={funnel}
      planRevenue={planRevenue}
      churnRiskCount={churnRiskCount}
      enterprisePipelineValue={enterprisePipelineValue}
      viralAcquisitionPct={viralAcquisitionPct}
      insights={insights}
      brainConfig={brainConfig}
    />
  );
}
