import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import { getOverviewAllWindows } from '@/lib/owner/metrics';
import { generateDailyBriefing } from '@/lib/owner/briefing';
import { getCustomerIntelligence } from '@/lib/owner/customerIntelligence';
import { getDataMoatSnapshot } from '@/lib/owner/dataMoat';
import { getBusinessOverview } from '@/lib/owner/metrics';
import { generateMarketingInsights } from '@/lib/owner/generators/insights';
import { buildRevenueOpportunity } from '@/lib/owner/revenueOpportunity';
import { generateContentSuggestions } from '@/lib/owner/generators/contentIntel';
import { loadCeoAdvisory, EMPTY_CEO_ADVISORY } from '@/lib/owner/ceoAdvisory';
import { getCeoDashboard, EMPTY_CEO_DASHBOARD } from '@/lib/owner/ceoDashboard';
import FounderOs from '@/components/owner/FounderOs';
import type { OwnerCampaign, OwnerCampaignTask, OwnerProspect, OwnerCrmLead } from '@/lib/owner/types';

export const metadata: Metadata = {
  title: 'Founder OS — CyberShield',
  description: 'Owner command center for growth, outreach, and intelligence',
};

export const dynamic = 'force-dynamic';

type CampaignWithTasks = OwnerCampaign & { owner_campaign_tasks: OwnerCampaignTask[] };

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const EMPTY_BRIEFING = {
  generatedAt: new Date().toISOString(),
  newCustomers: 0,
  newLeads: 0,
  newSignups: 0,
  scansToday: 0,
  revenueMrr: 0,
  revenueArr: 0,
  churnRisk: 0,
  hotProspects: 0,
  warmProspects: 0,
  opportunities: ['Connect Supabase to load live briefing data'],
  highlights: ['Founder OS V2 ready'],
  recommendedActions: [],
  topActions: [],
};

export default async function OwnerCommandCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/login');
  }

  const admin = createAdminClient();

  const [prospectsRes, crmRes] = await Promise.all([
    safeQuery(async () => {
      const { data } = await admin
        .from('owner_prospects')
        .select('*')
        .order('opportunity_priority', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      return { data: data ?? [] };
    }, { data: [] as OwnerProspect[] }),
    safeQuery(async () => {
      const { data } = await admin
        .from('owner_crm_leads')
        .select('*')
        .order('updated_at', { ascending: false });
      return { data: data ?? [] };
    }, { data: [] as OwnerCrmLead[] }),
  ]);

  const prospects = prospectsRes.data ?? [];
  const crmLeads = crmRes.data ?? [];

  const [
    briefing,
    windows,
    campaignsRes,
    competitorsRes,
    postsRes,
    intelligence,
    moat,
    overview,
    hotRes,
    warmRes,
    churnRes,
    ceoAdvisory,
  ] = await Promise.all([
    safeQuery(() => generateDailyBriefing({ prospects, crmLeads }), EMPTY_BRIEFING),
    safeQuery(() => getOverviewAllWindows(), {
      today: { mrr: 0, arr: 0, mrrGrowthPct: 0, totalUsers: 0, newSignups: 0, websites: 0, scans: 0, conversionRate: 0, window: 'today' as const },
      '7d': { mrr: 0, arr: 0, mrrGrowthPct: 0, totalUsers: 0, newSignups: 0, websites: 0, scans: 0, conversionRate: 0, window: '7d' as const },
      '30d': { mrr: 0, arr: 0, mrrGrowthPct: 0, totalUsers: 0, newSignups: 0, websites: 0, scans: 0, conversionRate: 0, window: '30d' as const },
      '90d': { mrr: 0, arr: 0, mrrGrowthPct: 0, totalUsers: 0, newSignups: 0, websites: 0, scans: 0, conversionRate: 0, window: '90d' as const },
    }),
    safeQuery(async () => {
      const { data } = await admin
        .from('owner_campaigns')
        .select('*, owner_campaign_tasks(*)')
        .order('created_at', { ascending: false });
      return { data: data ?? [] };
    }, { data: [] }),
    safeQuery(async () => {
      const { data } = await admin.from('owner_competitors').select('*').order('name');
      return { data: data ?? [] };
    }, { data: [] }),
    safeQuery(async () => {
      const { data } = await admin
        .from('owner_content_posts')
        .select('*')
        .order('created_at', { ascending: false });
      return { data: data ?? [] };
    }, { data: [] }),
    safeQuery(() => getCustomerIntelligence(), {
      topIndustries: [],
      commonFindings: [],
      avgRiskScore: 0,
      churnSignals: 0,
      conversionSignals: 0,
      hotProspects: 0,
      churnDrivers: [],
      conversionDrivers: [],
    }),
    safeQuery(() => getDataMoatSnapshot(), {
      benchmarks: [],
      trends: [{ period: 'Current', avgScore: 0, criticalFindings: 0, sslAdoptionPct: 0, sampleSize: 0 }],
      moatStrength: 'building' as const,
      dataPoints: 0,
      scanGrowthPct: 0,
      benchmarkCoverage: 0,
      coverageLabel: 'building',
    }),
    safeQuery(() => getBusinessOverview('30d'), {
      mrr: 0,
      arr: 0,
      mrrGrowthPct: 0,
      totalUsers: 0,
      newSignups: 0,
      websites: 0,
      scans: 0,
      conversionRate: 0,
      window: '30d' as const,
    }),
    safeQuery(async () => {
      const { count } = await admin
        .from('owner_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('lead_score', 'HOT');
      return { count: count ?? 0 };
    }, { count: 0 }),
    safeQuery(async () => {
      const { count } = await admin
        .from('owner_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('lead_score', 'WARM');
      return { count: count ?? 0 };
    }, { count: 0 }),
    safeQuery(async () => {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('churn_risk_score', 70);
      return { count: count ?? 0 };
    }, { count: 0 }),
    safeQuery(() => loadCeoAdvisory(admin), EMPTY_CEO_ADVISORY),
  ]);

  const revenue = buildRevenueOpportunity(prospects, crmLeads);
  const contentSuggestions = generateContentSuggestions({
    commonFindings: intelligence.commonFindings,
    avgRiskScore: intelligence.avgRiskScore,
    hotProspects: hotRes.count ?? 0,
    totalScans: overview.scans ?? revenue.totalScannedProspects,
  });

  const insights = generateMarketingInsights(overview, {
    hotProspects: hotRes.count ?? 0,
    warmProspects: warmRes.count ?? 0,
    churnRisk: churnRes.count ?? 0,
    contentPosts: (postsRes.data ?? []).length,
    briefing,
    revenue,
    intelligence,
    contentSuggestions,
  });

  const ceoDashboard = await safeQuery(
    () =>
      getCeoDashboard({
        prospects,
        crmLeads,
        briefing,
        windows,
        revenue,
        intelligence,
      }),
    EMPTY_CEO_DASHBOARD,
  );

  return (
    <FounderOs
      email={user.email ?? 'Owner'}
      briefing={briefing}
      windows={windows}
      prospects={prospects}
      campaigns={(campaignsRes.data ?? []) as CampaignWithTasks[]}
      crmLeads={crmLeads}
      competitors={competitorsRes.data ?? []}
      contentPosts={postsRes.data ?? []}
      insights={insights}
      intelligence={intelligence}
      moat={moat}
      revenue={revenue}
      contentSuggestions={contentSuggestions}
      ceoAdvisory={ceoAdvisory}
      ceoDashboard={ceoDashboard}
    />
  );
}
