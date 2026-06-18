import type { LeadScore } from './types';

export interface OpportunityScoreInput {
  leadScore?: LeadScore | null;
  scanScore?: number | null;
  scanRiskLevel?: string | null;
  industry?: string | null;
  issueCount?: number;
  stage?: string | null;
}

export interface OpportunityScore {
  leadScore: LeadScore;
  conversionLikelihood: number;
  estimatedMrr: number;
  estimatedArr: number;
  priority: number;
  tier: 'HOT' | 'WARM' | 'LOW';
  rationale: string;
}

const INDUSTRY_MRR: Record<string, number> = {
  healthcare: 149,
  legal: 129,
  finance: 199,
  ecommerce: 99,
  saas: 149,
  agency: 299,
  restaurant: 49,
  retail: 79,
  education: 99,
  nonprofit: 49,
  default: 79,
};

function industryMrr(industry?: string | null): number {
  if (!industry) return INDUSTRY_MRR.default;
  const key = industry.toLowerCase().trim();
  for (const [k, v] of Object.entries(INDUSTRY_MRR)) {
    if (key.includes(k)) return v;
  }
  return INDUSTRY_MRR.default;
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

const STAGE_BOOST: Record<string, number> = {
  demo: 25,
  trial: 30,
  replied: 15,
  contacted: 8,
  new_lead: 0,
  customer: 0,
  lost: -50,
};

export function scoreOpportunity(input: OpportunityScoreInput): OpportunityScore {
  const tier = inferLeadScore(input);
  const baseMrr = industryMrr(input.industry);

  let conversionLikelihood =
    tier === 'HOT' ? 35 : tier === 'WARM' ? 18 : 8;

  if (input.scanScore !== null && input.scanScore !== undefined && input.scanScore < 60) {
    conversionLikelihood += 10;
  }
  if (input.stage && STAGE_BOOST[input.stage] !== undefined) {
    conversionLikelihood += STAGE_BOOST[input.stage];
  }
  conversionLikelihood = Math.min(95, Math.max(2, conversionLikelihood));

  const planMultiplier = tier === 'HOT' ? 1.2 : tier === 'WARM' ? 1 : 0.85;
  const estimatedMrr = Math.round(baseMrr * planMultiplier);
  const estimatedArr = estimatedMrr * 12;

  let priority = conversionLikelihood;
  if (tier === 'HOT') priority += 30;
  else if (tier === 'WARM') priority += 15;
  if (input.scanScore !== null && input.scanScore !== undefined && input.scanScore < 50) {
    priority += 20;
  }

  const rationale =
    tier === 'HOT'
      ? `High-risk scan + ${input.industry ?? 'target'} fit — fast-track outreach`
      : tier === 'WARM'
        ? `Moderate security gaps — nurture with audit summary`
        : `Lower urgency — batch into weekly outreach`;

  return {
    leadScore: tier,
    conversionLikelihood,
    estimatedMrr,
    estimatedArr,
    priority,
    tier,
    rationale,
  };
}

export function sortByOpportunity<T extends OpportunityScore>(items: T[]): T[] {
  return [...items].sort((a, b) => b.priority - a.priority);
}

export function opportunityTierColor(tier: LeadScore): string {
  switch (tier) {
    case 'HOT':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'WARM':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    default:
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  }
}
