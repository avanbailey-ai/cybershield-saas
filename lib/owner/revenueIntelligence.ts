import type { OwnerProspect } from './types';
import { activeProspects } from './prospectFilters';

export interface RevenueIntelligenceSummary {
  potentialOpportunities: number;
  outreachReady: number;
  estimatedMonthlyRevenue: number;
  estimatedAnnualRevenue: number;
  highestConfidenceLead: OwnerProspect | null;
  bestIndustry: string | null;
}

export function computeRevenueIntelligence(
  prospects: OwnerProspect[],
): RevenueIntelligenceSummary {
  const active = activeProspects(prospects);
  const qualified = active.filter((p) =>
    ['qualified', 'outreach_ready', 'contacted', 'interested'].includes(
      p.pipeline_state ?? '',
    ),
  );
  const outreachReady = active.filter((p) => p.pipeline_state === 'outreach_ready');

  const revenueProspects = outreachReady.length > 0 ? outreachReady : qualified;
  const estimatedMonthlyRevenue = revenueProspects.reduce(
    (sum, p) => sum + (p.estimated_plan_fit ?? 0),
    0,
  );

  const ranked = [...active].sort(
    (a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0),
  );
  const highestConfidenceLead = ranked[0] ?? null;

  const industryCounts = new Map<string, number>();
  for (const p of active.filter((x) => (x.opportunity_score ?? 0) >= 50)) {
    const ind = p.industry?.trim();
    if (!ind) continue;
    industryCounts.set(ind, (industryCounts.get(ind) ?? 0) + 1);
  }
  let bestIndustry: string | null = null;
  let bestCount = 0;
  for (const [ind, count] of industryCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestIndustry = ind;
    }
  }

  return {
    potentialOpportunities: qualified.length + outreachReady.length,
    outreachReady: outreachReady.length,
    estimatedMonthlyRevenue,
    estimatedAnnualRevenue: estimatedMonthlyRevenue * 12,
    highestConfidenceLead,
    bestIndustry,
  };
}

export function formatRevenue(amount: number): string {
  if (amount <= 0) return '—';
  return `$${amount.toLocaleString()}`;
}
