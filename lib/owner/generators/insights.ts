import type { FounderBriefing } from '@/lib/owner/briefing';
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';
import type { CustomerIntelligenceSummary } from '@/lib/owner/customerIntelligence';
import type { ContentSuggestion } from '@/lib/owner/generators/contentIntel';
import type { BusinessOverviewMetrics } from '../types';

export interface MarketingInsight {
  id: string;
  title: string;
  body: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

const MIN_SIGNUPS_FOR_CONVERSION = 10;
const MIN_FINDING_MENTIONS = 5;

export function generateMarketingInsights(
  overview: BusinessOverviewMetrics,
  extras?: {
    hotProspects?: number;
    warmProspects?: number;
    churnRisk?: number;
    contentPosts?: number;
    briefing?: FounderBriefing;
    revenue?: RevenueOpportunitySummary;
    intelligence?: CustomerIntelligenceSummary;
    contentSuggestions?: ContentSuggestion[];
  },
): MarketingInsight[] {
  const insights: MarketingInsight[] = [];

  if (
    overview.newSignups >= MIN_SIGNUPS_FOR_CONVERSION &&
    overview.conversionRate < 5
  ) {
    insights.push({
      id: 'low-conversion',
      title: 'Signup-to-paid conversion below 5%',
      body: `${overview.conversionRate}% of ${overview.newSignups} recent signups converted (platform data).`,
      recommendation: 'Review onboarding drop-off and pricing page for the last 30 days.',
      priority: 'high',
      category: 'Conversion',
    });
  }

  if (overview.mrr > 0 && overview.mrrGrowthPct < 0) {
    insights.push({
      id: 'mrr-decline',
      title: 'MRR growth negative in this window',
      body: `MRR trend: ${overview.mrrGrowthPct}% vs prior period (Stripe/subscription data).`,
      recommendation: 'Focus on retention outreach for at-risk accounts.',
      priority: 'high',
      category: 'Revenue',
    });
  }

  if ((extras?.hotProspects ?? 0) > 0) {
    insights.push({
      id: 'hot-prospects',
      title: `${extras!.hotProspects} HOT prospect(s) in pipeline`,
      body: 'Prospects with completed scans scored HOT in Founder OS.',
      recommendation: 'Generate findings-based outreach while scan context is fresh.',
      priority: 'high',
      category: 'Outbound',
    });
  }

  if ((extras?.churnRisk ?? 0) > 0) {
    insights.push({
      id: 'churn-risk',
      title: `${extras!.churnRisk} account(s) at churn risk`,
      body: 'Profiles with churn_risk_score > 70.',
      recommendation: 'Personal founder outreach within 7 days.',
      priority: 'high',
      category: 'Retention',
    });
  }

  if (extras?.revenue && extras.revenue.crmPipelineMrr > 0) {
    const top = extras.revenue.industries.find((i) => i.crmRevenue > 0);
    if (top) {
      insights.push({
        id: 'crm-pipeline',
        title: `$${extras.revenue.crmPipelineMrr.toLocaleString()}/mo in CRM pipeline`,
        body: `${top.industry}: ${top.hotCount} HOT · ${top.warmCount} WARM scanned prospects.`,
        recommendation: 'Prioritize CRM leads with demo/trial stage and entered revenue.',
        priority: 'medium',
        category: 'Pipeline',
      });
    }
  }

  const topFinding = extras?.intelligence?.commonFindings[0];
  if (topFinding && topFinding.count >= MIN_FINDING_MENTIONS) {
    insights.push({
      id: 'content-finding',
      title: `Finding seen in ${topFinding.count} platform scans`,
      body: `"${topFinding.finding.slice(0, 80)}…"`,
      recommendation: 'Use Content Intelligence to draft a post from this real finding.',
      priority: 'medium',
      category: 'Content',
    });
  }

  if ((extras?.contentSuggestions?.length ?? 0) > 0) {
    insights.push({
      id: 'content-ready',
      title: `${extras!.contentSuggestions!.length} content angle(s) from scan data`,
      body: 'Generated from aggregated findings in your database.',
      recommendation: 'Publish the highest-priority suggestion this week.',
      priority: 'medium',
      category: 'Content',
    });
  }

  return insights;
}
