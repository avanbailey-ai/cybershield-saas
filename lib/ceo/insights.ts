/**
 * CEO insights — rule-based decision support from daily metrics.
 * ADVISORY ONLY: insights are stored for review, never auto-applied.
 */

import type { DailyMetrics } from './metrics';

export interface CEOInsight {
  id?: string;
  problem: string;
  impact: string;
  recommended_action: string;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  metadata?: Record<string, unknown>;
  positive?: boolean;
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function funnelDropoff(metrics: DailyMetrics, from: string, to: string): number {
  const fromCount = metrics.funnelStages[from] ?? 0;
  const toCount = metrics.funnelStages[to] ?? 0;
  if (fromCount <= 0) return 0;
  return Math.round(((fromCount - toCount) / fromCount) * 1000) / 10;
}

export function generateDailyInsights(
  metrics: DailyMetrics,
  previousMetrics?: DailyMetrics,
): CEOInsight[] {
  const insights: CEOInsight[] = [];

  const pricingDropoff = funnelDropoff(metrics, 'report_viewed', 'pricing_viewed');
  if (pricingDropoff > 50) {
    insights.push({
      problem: `Pricing page drop-off is ${pricingDropoff}% after report view`,
      impact: 'Users see scan results but abandon before viewing pricing — lost upgrade intent',
      recommended_action: 'Reorder pricing to surface Growth plan earlier and soften paywall timing',
      priority: 'high',
      category: 'conversion',
      metadata: { pricingDropoff, stage: 'report_viewed→pricing_viewed' },
    });
  }

  const growthCount = metrics.revenueByPlan.growth?.count ?? 0;
  const proCount = metrics.revenueByPlan.pro?.count ?? 0;
  if (proCount > 0 && growthCount / proCount >= 2) {
    insights.push({
      problem: 'Growth plan converts at 2×+ the rate of Pro',
      impact: 'Revenue mix favors Growth — under-highlighting it leaves MRR on the table',
      recommended_action: 'Highlight Growth plan as the recommended tier on pricing',
      priority: 'high',
      category: 'pricing',
      metadata: { growthCount, proCount, ratio: growthCount / proCount },
      positive: true,
    });
  }

  const scanReportDropoff = funnelDropoff(metrics, 'scan_completed', 'report_viewed');
  if (scanReportDropoff > 40) {
    insights.push({
      problem: `Scan→report drop-off is ${scanReportDropoff}%`,
      impact: 'Users complete scans but never view the report preview — weak value demonstration',
      recommended_action: 'Improve report preview CTA and show partial AI insights earlier',
      priority: 'high',
      category: 'onboarding',
      metadata: { scanReportDropoff },
    });
  }

  if (previousMetrics) {
    const leadDelta = deltaPct(
      metrics.enterpriseLeadCount,
      previousMetrics.enterpriseLeadCount,
    );
    const prevDemos = previousMetrics.funnelStages?.enterprise_demos ?? 0;
    const currDemos = metrics.funnelStages?.enterprise_demos ?? 0;
    if (leadDelta > 20 && currDemos <= prevDemos) {
      insights.push({
        problem: 'Enterprise leads are up but demo bookings are flat',
        impact: 'Inbound interest is growing without sales follow-through — pipeline leakage',
        recommended_action: 'Prioritize demo scheduling outreach for new enterprise leads',
        priority: 'medium',
        category: 'enterprise',
        metadata: { leadDelta, leads: metrics.enterpriseLeadCount },
      });
    }
  }

  if (metrics.scanCompletionRate < 60 && metrics.funnelStages.scan_started > 10) {
    insights.push({
      problem: `Scan completion rate is only ${metrics.scanCompletionRate}%`,
      impact: 'Friction in the scan flow reduces top-of-funnel volume',
      recommended_action: 'Add onboarding clarification for first-time scanners',
      priority: 'medium',
      category: 'onboarding',
      metadata: { scanCompletionRate: metrics.scanCompletionRate },
    });
  }

  if (metrics.upgradeConversionRate > 5) {
    insights.push({
      problem: `Upgrade conversion at ${metrics.upgradeConversionRate}% — above baseline`,
      impact: 'Current pricing UX is performing well for viewers who reach checkout',
      recommended_action: 'Maintain current CTA placement; consider A/B test on headline only',
      priority: 'low',
      category: 'conversion',
      metadata: { upgradeConversionRate: metrics.upgradeConversionRate },
      positive: true,
    });
  }

  if (metrics.viralReferralRate > 10) {
    insights.push({
      problem: `Viral referral conversion at ${metrics.viralReferralRate}%`,
      impact: 'Referral loop is contributing meaningful acquisition',
      recommended_action: 'Double down on share prompts after high-score scans',
      priority: 'low',
      category: 'viral',
      metadata: { viralReferralRate: metrics.viralReferralRate },
      positive: true,
    });
  }

  const checkoutDropoff = funnelDropoff(metrics, 'checkout_started', 'checkout_completed');
  if (checkoutDropoff > 30 && (metrics.funnelStages.checkout_started ?? 0) > 3) {
    insights.push({
      problem: `Checkout abandonment at ${checkoutDropoff}%`,
      impact: 'Users start checkout but do not complete — payment friction or hesitation',
      recommended_action: 'Improve CTA copy on checkout recovery and add trust signals',
      priority: 'high',
      category: 'conversion',
      metadata: { checkoutDropoff },
    });
  }

  if (metrics.churnRateInactive > 25) {
    insights.push({
      problem: `${metrics.churnRateInactive}% of users inactive 30+ days`,
      impact: 'Large dormant cohort — re-engagement or churn risk',
      recommended_action: 'Review retention messaging (brain layer handles emails separately)',
      priority: 'medium',
      category: 'retention',
      metadata: { churnRateInactive: metrics.churnRateInactive },
    });
  }

  return insights;
}
