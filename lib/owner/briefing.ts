import { createAdminClient } from '@/lib/supabase/admin';
import { getBusinessOverview } from './metrics';
import { generateFounderActions, type FounderAction } from './founderActions';
import type { OwnerProspect, OwnerCrmLead } from './types';

export interface RecommendedAction {
  title: string;
  impact: 'critical' | 'high' | 'medium';
  module: string;
}

export interface FounderBriefing {
  generatedAt: string;
  newCustomers: number;
  newLeads: number;
  newSignups: number;
  scansToday: number;
  revenueMrr: number;
  revenueArr: number;
  churnRisk: number;
  hotProspects: number;
  warmProspects: number;
  opportunities: string[];
  highlights: string[];
  recommendedActions: RecommendedAction[];
  topActions: FounderAction[];
}

export async function generateDailyBriefing(
  extras?: {
    prospects?: OwnerProspect[];
    crmLeads?: OwnerCrmLead[];
  },
): Promise<FounderBriefing> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [overview, newCustomersRes, crmRes, hotRes, warmRes, enterpriseRes, churnRes, prospectsRes] =
    await Promise.all([
      getBusinessOverview('today'),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('subscription_status', 'active')
        .gte('created_at', dayAgo),
      admin
        .from('owner_crm_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dayAgo),
      admin
        .from('owner_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('lead_score', 'HOT'),
      admin
        .from('owner_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('lead_score', 'WARM'),
      admin
        .from('enterprise_leads')
        .select('id, company, status')
        .gte('created_at', dayAgo)
        .limit(5),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('churn_risk_score', 70),
      admin.from('owner_prospects').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

  const prospects = extras?.prospects ?? prospectsRes.data ?? [];
  const crmLeads = extras?.crmLeads ?? [];
  const enterpriseLeads = enterpriseRes.data ?? [];
  const opportunities: string[] = [];

  if ((hotRes.count ?? 0) > 0) {
    opportunities.push(
      `${hotRes.count} HOT prospect(s) — prioritize findings-based outreach today`,
    );
  }
  if ((warmRes.count ?? 0) > 0) {
    opportunities.push(`${warmRes.count} WARM prospect(s) — send audit summaries this week`);
  }
  for (const lead of enterpriseLeads) {
    opportunities.push(`Enterprise lead: ${lead.company ?? 'Unknown'} (${lead.status})`);
  }
  if (overview.newSignups > 0) {
    opportunities.push(
      `${overview.newSignups} new signup(s) today — trigger onboarding nurture sequence`,
    );
  }
  if ((churnRes.count ?? 0) > 0) {
    opportunities.push(
      `${churnRes.count} account(s) at churn risk — retention outreach recommended`,
    );
  }
  if (opportunities.length === 0) {
    opportunities.push(
      'Run prospect discovery in healthcare or legal — high MRR verticals with common security gaps',
    );
  }

  const highlights: string[] = [
    `MRR: $${overview.mrr.toLocaleString()} · ARR: $${(overview.mrr * 12).toLocaleString()}`,
    `${overview.newSignups} signup(s) today · ${overview.scans} scan(s) in period`,
    `${hotRes.count ?? 0} HOT · ${warmRes.count ?? 0} WARM prospects in pipeline`,
  ];

  const unscanned = prospects.filter((p) => p.scan_status === 'pending').length;
  const topActions = generateFounderActions({
    briefing: {
      generatedAt: new Date().toISOString(),
      newCustomers: newCustomersRes.count ?? 0,
      newLeads: (crmRes.count ?? 0) + enterpriseLeads.length,
      newSignups: overview.newSignups,
      scansToday: overview.scans,
      revenueMrr: overview.mrr,
      revenueArr: overview.mrr * 12,
      churnRisk: churnRes.count ?? 0,
      hotProspects: hotRes.count ?? 0,
      warmProspects: warmRes.count ?? 0,
      opportunities,
      highlights,
      recommendedActions: [],
      topActions: [],
    },
    hotProspects: prospects.filter((p) => p.lead_score === 'HOT'),
    crmLeads,
    churnRisk: churnRes.count ?? 0,
    unscannedProspects: unscanned,
  });

  const recommendedActions: RecommendedAction[] = topActions.map((a) => ({
    title: a.title,
    impact: a.impact,
    module: a.module,
  }));

  return {
    generatedAt: new Date().toISOString(),
    newCustomers: newCustomersRes.count ?? 0,
    newLeads: (crmRes.count ?? 0) + enterpriseLeads.length,
    newSignups: overview.newSignups,
    scansToday: overview.scans,
    revenueMrr: overview.mrr,
    revenueArr: overview.mrr * 12,
    churnRisk: churnRes.count ?? 0,
    hotProspects: hotRes.count ?? 0,
    warmProspects: warmRes.count ?? 0,
    opportunities,
    highlights,
    recommendedActions,
    topActions,
  };
}
