import { createAdminClient } from '@/lib/supabase/admin';
import { scoreOpportunity } from './opportunityScore';
import type { OwnerProspect, OwnerCrmLead } from './types';

export interface IndustryPipeline {
  industry: string;
  prospectCount: number;
  hotCount: number;
  warmCount: number;
  pipelineMrr: number;
  pipelineArr: number;
  weightedMrr: number;
  conversionRate: number;
}

export interface RevenueOpportunitySummary {
  totalPipelineMrr: number;
  totalPipelineArr: number;
  weightedPipelineMrr: number;
  industries: IndustryPipeline[];
  topOpportunities: {
    name: string;
    industry: string | null;
    estimatedMrr: number;
    conversionLikelihood: number;
    tier: string;
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

  let pipelineMrr = 0;
  let weightedMrr = 0;
  let hotCount = 0;
  let warmCount = 0;

  for (const p of indProspects) {
    const opp = scoreOpportunity({
      leadScore: p.lead_score,
      scanScore: p.scan_score,
      scanRiskLevel: p.scan_risk_level,
      industry: p.industry,
      issueCount: Array.isArray((p.scan_findings as { issues?: string[] })?.issues)
        ? (p.scan_findings as { issues: string[] }).issues.length
        : 0,
    });
    pipelineMrr += opp.estimatedMrr;
    weightedMrr += opp.estimatedMrr * (opp.conversionLikelihood / 100);
    if (opp.tier === 'HOT') hotCount++;
    if (opp.tier === 'WARM') warmCount++;
  }

  for (const l of indCrm) {
    const rev = Number(l.potential_revenue ?? 0);
    pipelineMrr += rev;
    weightedMrr += rev * 0.25;
  }

  const customers = indCrm.filter((l) => l.stage === 'customer').length;
  const total = indProspects.length + indCrm.length;
  const conversionRate = total > 0 ? Math.round((customers / total) * 1000) / 10 : 0;

  return {
    industry,
    prospectCount: indProspects.length,
    hotCount,
    warmCount,
    pipelineMrr,
    pipelineArr: pipelineMrr * 12,
    weightedMrr: Math.round(weightedMrr),
    conversionRate,
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
    .sort((a, b) => b.weightedMrr - a.weightedMrr);

  const topOpportunities = prospects
    .map((p) => {
      const opp = scoreOpportunity({
        leadScore: p.lead_score,
        scanScore: p.scan_score,
        scanRiskLevel: p.scan_risk_level,
        industry: p.industry,
      });
      return {
        name: p.business_name,
        industry: p.industry,
        estimatedMrr: opp.estimatedMrr,
        conversionLikelihood: opp.conversionLikelihood,
        tier: opp.tier,
        priority: opp.priority,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
    .map(({ priority: _, ...rest }) => rest);

  const totalPipelineMrr = industryPipelines.reduce((s, i) => s + i.pipelineMrr, 0);
  const weightedPipelineMrr = industryPipelines.reduce((s, i) => s + i.weightedMrr, 0);

  return {
    totalPipelineMrr,
    totalPipelineArr: totalPipelineMrr * 12,
    weightedPipelineMrr,
    industries: industryPipelines,
    topOpportunities,
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
