import { createAdminClient } from '@/lib/supabase/admin';
import { getBusinessOverview } from './metrics';

export interface FounderBriefing {
  generatedAt: string;
  newCustomers: number;
  newLeads: number;
  revenueMrr: number;
  hotProspects: number;
  opportunities: string[];
  highlights: string[];
}

export async function generateDailyBriefing(): Promise<FounderBriefing> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [overview, newCustomersRes, crmRes, prospectsRes, enterpriseRes] = await Promise.all([
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
      .eq('lead_score', 'HOT')
      .gte('created_at', dayAgo),
    admin
      .from('enterprise_leads')
      .select('id, company, status')
      .gte('created_at', dayAgo)
      .limit(5),
  ]);

  const enterpriseLeads = enterpriseRes.data ?? [];
  const opportunities: string[] = [];

  if ((prospectsRes.count ?? 0) > 0) {
    opportunities.push(`${prospectsRes.count} HOT prospects discovered — prioritize outreach today`);
  }
  for (const lead of enterpriseLeads) {
    opportunities.push(`Enterprise lead: ${lead.company ?? 'Unknown'} (${lead.status})`);
  }
  if (overview.newSignups > 0) {
    opportunities.push(`${overview.newSignups} new signups today — nurture with onboarding sequence`);
  }
  if (opportunities.length === 0) {
    opportunities.push('Run lead discovery scans to find security-vulnerable prospects in your target market');
  }

  const highlights: string[] = [
    `MRR: $${overview.mrr.toLocaleString()}`,
    `${overview.newSignups} signups today`,
    `${overview.scans} scans in period`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    newCustomers: newCustomersRes.count ?? 0,
    newLeads: (crmRes.count ?? 0) + enterpriseLeads.length,
    revenueMrr: overview.mrr,
    hotProspects: prospectsRes.count ?? 0,
    opportunities,
    highlights,
  };
}
