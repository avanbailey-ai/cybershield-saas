import {
  formatLeadDomainDisplay,
  isExcludedLeadStatus,
  isQualifiableLead,
  isValidLeadDomain,
} from '@/lib/sales/leadValidation';

export interface EnterpriseLeadRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  domain: string | null;
  company_size: string | null;
  security_needs: string[] | null;
  message: string | null;
  lead_score: number;
  status: string;
  created_at: string;
  admin_notes?: string | null;
  last_contacted_at?: string | null;
  last_scan_score?: number | null;
  risk_level?: string | null;
}

export interface PipelineRow {
  lead_id: string;
  value_estimate: number | null;
  stage?: string | null;
}

export interface SalesDashboardMetrics {
  totalLeads: number;
  qualifiedCount: number;
  conversionRate: number;
  pipelineValue: number;
  topDomains: Array<{ domain: string; count: number }>;
  recentLeads: EnterpriseLeadRow[];
  excludedLeadCount: number;
}

export function filterDashboardLeads(
  leads: EnterpriseLeadRow[],
  includeExcluded: boolean,
): EnterpriseLeadRow[] {
  if (includeExcluded) return leads;
  return leads.filter((lead) => !isExcludedLeadStatus(lead.status));
}

export function computeSalesMetrics(
  allLeads: EnterpriseLeadRow[],
  pipelineRows: PipelineRow[],
  includeExcluded: boolean,
): SalesDashboardMetrics {
  const visibleLeads = filterDashboardLeads(allLeads, includeExcluded);
  const leadsById = new Map(allLeads.map((lead) => [lead.id, lead]));

  const qualifiedCount = visibleLeads.filter((l) => l.status === 'qualified').length;
  const totalLeads = visibleLeads.length;
  const conversionRate =
    totalLeads > 0 ? Math.round((qualifiedCount / totalLeads) * 100) : 0;

  const pipelineValue = pipelineRows.reduce((sum, row) => {
    const lead = leadsById.get(row.lead_id);
    if (!lead || !isQualifiableLead(lead)) return sum;
    return sum + Number(row.value_estimate ?? 0);
  }, 0);

  const domainCounts = visibleLeads.reduce<Record<string, number>>((acc, lead) => {
    if (!isValidLeadDomain(lead.domain)) return acc;
    const label = formatLeadDomainDisplay(lead.domain);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return {
    totalLeads,
    qualifiedCount,
    conversionRate,
    pipelineValue,
    topDomains,
    recentLeads: visibleLeads.slice(0, 20),
    excludedLeadCount: allLeads.filter((l) => isExcludedLeadStatus(l.status)).length,
  };
}

export function estimatePipelineValue(
  leadScore: number,
  companySize: string | null | undefined,
  qualifiable: boolean,
): number {
  if (!qualifiable) return 0;
  if (leadScore >= 70) return 12000;
  if (companySize === '500+') return 8000;
  return 5000;
}
