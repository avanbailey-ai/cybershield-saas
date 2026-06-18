import type { LeadScore } from './types';

export interface OpportunityScoreInput {
  leadScore?: LeadScore | null;
  scanScore?: number | null;
  scanRiskLevel?: string | null;
  industry?: string | null;
  issueCount?: number;
  stage?: string | null;
  /** CRM-entered potential monthly revenue — only source for pipeline $ */
  potentialRevenue?: number | null;
  /** True when prospect scan_status is completed */
  scanCompleted?: boolean;
}

export interface OpportunityScore {
  leadScore: LeadScore | null;
  conversionLikelihood: number | null;
  estimatedMrr: number | null;
  estimatedArr: number | null;
  priority: number;
  tier: LeadScore | null;
  rationale: string;
  hasScanData: boolean;
}

function hasRealScanData(input: OpportunityScoreInput): boolean {
  if (input.scanCompleted) return true;
  return input.scanScore !== null && input.scanScore !== undefined;
}

function inferLeadScore(input: OpportunityScoreInput): LeadScore {
  if (input.leadScore) return input.leadScore;
  const score = input.scanScore ?? 100;
  const issues = input.issueCount ?? 0;
  const risk = input.scanRiskLevel?.toLowerCase() ?? '';

  if (risk === 'critical' || risk === 'high' || score < 50 || issues >= 5) return 'HOT';
  if (risk === 'medium' || score < 75 || issues >= 2) return 'WARM';
  return 'LOW';
}

const STAGE_PRIORITY: Record<string, number> = {
  demo: 25,
  trial: 30,
  replied: 15,
  contacted: 8,
  new_lead: 0,
  customer: 0,
  lost: -50,
};

export function scoreOpportunity(input: OpportunityScoreInput): OpportunityScore {
  const hasScan = hasRealScanData(input);
  const crmRevenue = input.potentialRevenue ?? null;

  if (!hasScan && !input.leadScore) {
    return {
      leadScore: null,
      conversionLikelihood: null,
      estimatedMrr: crmRevenue,
      estimatedArr: crmRevenue !== null ? crmRevenue * 12 : null,
      priority: crmRevenue ? 40 : 0,
      tier: null,
      rationale: 'Run a CyberShield scan to score this opportunity.',
      hasScanData: false,
    };
  }

  const tier = inferLeadScore(input);
  let priority = tier === 'HOT' ? 80 : tier === 'WARM' ? 55 : 30;

  if (input.scanScore !== null && input.scanScore !== undefined && input.scanScore < 50) {
    priority += 15;
  }
  if (input.stage && STAGE_PRIORITY[input.stage] !== undefined) {
    priority += STAGE_PRIORITY[input.stage];
  }
  if (crmRevenue && crmRevenue > 0) {
    priority += Math.min(20, Math.round(crmRevenue / 50));
  }

  const rationale =
    tier === 'HOT'
      ? `Scan shows elevated risk (${input.scanScore ?? '—'}/100) — prioritize outreach`
      : tier === 'WARM'
        ? 'Moderate security gaps detected — nurture with audit summary'
        : 'Lower urgency from scan — batch into weekly follow-up';

  return {
    leadScore: tier,
    conversionLikelihood: null,
    estimatedMrr: crmRevenue,
    estimatedArr: crmRevenue !== null ? crmRevenue * 12 : null,
    priority,
    tier,
    rationale,
    hasScanData: hasScan,
  };
}

export function sortByOpportunity<T extends { priority?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function opportunityTierColor(tier: LeadScore | null): string {
  switch (tier) {
    case 'HOT':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'WARM':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'LOW':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    default:
      return 'text-gray-500 bg-gray-800/40 border-gray-700';
  }
}
