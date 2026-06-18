import { createAdminClient } from '@/lib/supabase/admin';
import { scoreOpportunity } from './opportunityScore';
import type { OwnerProspect, OwnerCrmLead } from './types';

export interface IndustryPipeline {
  industry: string;
  prospectCount: number;
  hotCount: number;
  warmCount: number;
  scannedCount: number;
  crmRevenue: number;
  pipelineMrr: number;
  pipelineArr: number;
}

export interface RevenueOpportunitySummary {
  crmPipelineMrr: number;
  crmPipelineArr: number;
  totalScannedProspects: number;
  hotCount: number;
  warmCount: number;
  industries: IndustryPipeline[];
  topOpportunities: {
    name: string;
    industry: string | null;
    website: string;
    scanScore: number | null;
    estimatedMrr: number | null;
    tier: string | null;
    hasScan: boolean;
  }[];
  highestRisk: {
    name: string;
    website: string;
    scanScore: number;
    riskLevel: string | null;
  }[];
}

function aggregateIndustry(
  industry: string,
  prospects: OwnerProspect[],
  crmLeads: OwnerCrmLead[],
): IndustryPipeline {
  const indProspects = prospects.filter(
    (p) => (p.industry ?? 'General').toLowerCase() === industry.toLowerCase(),
  );
  const indCrm = crmLeads.filter(
    (l) => (l.industry ?? 'General').toLowerCase() === industry.toLowerCase(),
  );

  let hotCount = 0;
  let warmCount = 0;
  let scannedCount = 0;

  for (const p of indProspects) {
    const opp = scoreOpportunity({
      leadScore: p.lead_score,
      scanScore: p.scan_score,
      scanRiskLevel: p.scan_risk_level,
      industry: p.industry,
      scanCompleted: p.scan_status === 'completed',
      issueCount: Array.isArray((p.scan_findings as { issues?: string[] })?.issues)
        ? (p.scan_findings as { issues: string[] }).issues.length
        : 0,
    });
    if (opp.hasScanData) scannedCount++;
    if (opp.tier === 'HOT') hotCount++;
    if (opp.tier === 'WARM') warmCount++;
  }

  const crmRevenue = indCrm.reduce((s, l) => s + Number(l.potential_revenue ?? 0), 0);

  return {
    industry,
    prospectCount: indProspects.length,
    hotCount,
    warmCount,
    scannedCount,
    crmRevenue,
    pipelineMrr: crmRevenue,
    pipelineArr: crmRevenue * 12,
  };
}

export function buildRevenueOpportunity(
  prospects: OwnerProspect[],
  crmLeads: OwnerCrmLead[],
): RevenueOpportunitySummary {
  const industries = new Set<string>();
  for (const p of prospects) industries.add(p.industry ?? 'General');
  for (const l of crmLeads) industries.add(l.industry ?? 'General');

  const industryPipelines = [...industries]
    .map((ind) => aggregateIndustry(ind, prospects, crmLeads))
    .filter((i) => i.prospectCount > 0 || i.crmRevenue > 0)
    .sort((a, b) => b.hotCount - a.hotCount || b.crmRevenue - a.crmRevenue);

  const scanned = prospects.filter((p) => p.scan_status === 'completed');

  const topOpportunities = prospects
    .filter((p) => p.scan_status === 'completed')
    .map((p) => {
      const opp = scoreOpportunity({
        leadScore: p.lead_score,
        scanScore: p.scan_score,
        scanRiskLevel: p.scan_risk_level,
        industry: p.industry,
        scanCompleted: true,
        potentialRevenue: p.estimated_mrr,
      });
      return {
        name: p.business_name,
        industry: p.industry,
        website: p.website,
        scanScore: p.scan_score,
        estimatedMrr: opp.estimatedMrr,
        tier: opp.tier,
        hasScan: true,
        priority: opp.priority,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
    .map(({ priority: _, ...rest }) => rest);

  const highestRisk = scanned
    .filter((p) => p.scan_score !== null)
    .sort((a, b) => (a.scan_score ?? 100) - (b.scan_score ?? 100))
    .slice(0, 5)
    .map((p) => ({
      name: p.business_name,
      website: p.website,
      scanScore: p.scan_score as number,
      riskLevel: p.scan_risk_level,
    }));

  const crmPipelineMrr = crmLeads.reduce((s, l) => s + Number(l.potential_revenue ?? 0), 0);
  const hotCount = prospects.filter((p) => p.lead_score === 'HOT').length;
  const warmCount = prospects.filter((p) => p.lead_score === 'WARM').length;

  return {
    crmPipelineMrr,
    crmPipelineArr: crmPipelineMrr * 12,
    totalScannedProspects: scanned.length,
    hotCount,
    warmCount,
    industries: industryPipelines,
    topOpportunities,
    highestRisk,
  };
}

export async function getRevenueOpportunity(): Promise<RevenueOpportunitySummary> {
  const admin = createAdminClient();
  const [prospectsRes, crmRes] = await Promise.all([
    admin.from('owner_prospects').select('*'),
    admin.from('owner_crm_leads').select('*'),
  ]);
  return buildRevenueOpportunity(prospectsRes.data ?? [], crmRes.data ?? []);
}
