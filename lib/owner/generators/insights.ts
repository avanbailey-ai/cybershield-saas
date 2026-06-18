import type { FounderBriefing } from '@/lib/owner/briefing';
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';
import type { CustomerIntelligenceSummary } from '@/lib/owner/customerIntelligence';
import type { ContentSuggestion } from '@/lib/owner/generators/contentIntel';

export interface MarketingInsight {
  id: string;
  title: string;
  body: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

import type { BusinessOverviewMetrics } from '../types';

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

  if (overview.conversionRate < 5 && overview.newSignups > 0) {
    insights.push({
      id: 'low-conversion',
      title: 'Signup-to-paid conversion below 5%',
      body: `Only ${overview.conversionRate}% of recent signups converted.`,
      recommendation: 'A/B test pricing page CTA and add day-1 onboarding email with free scan.',
      priority: 'high',
      category: 'Conversion',
    });
  }

  if (overview.mrr > 0 && overview.mrrGrowthPct < 0) {
    insights.push({
      id: 'mrr-decline',
      title: 'MRR growth slowing',
      body: `Signup trend at ${overview.mrrGrowthPct}% vs prior period.`,
      recommendation: 'Focus on retention + upsell to Growth/Agency; pause new acquisition spend.',
      priority: 'high',
      category: 'Revenue',
    });
  }

  if ((extras?.hotProspects ?? 0) > 0) {
    insights.push({
      id: 'hot-prospects',
      title: `${extras!.hotProspects} HOT prospects in pipeline`,
      body: 'Completed scans show critical/high risk — highest conversion window is 48h.',
      recommendation: 'Use Outreach Engine with audit_summary type; move responders to CRM demo stage.',
      priority: 'high',
      category: 'Outbound',
    });
  }

  if ((extras?.churnRisk ?? 0) > 0) {
    insights.push({
      id: 'churn-risk',
      title: `${extras!.churnRisk} accounts at churn risk`,
      body: 'Churn risk score > 70 indicates disengagement or billing friction.',
      recommendation: 'Personal outreach from founder + offer security review call within 7 days.',
      priority: 'high',
      category: 'Retention',
    });
  }

  if (extras?.revenue && extras.revenue.weightedPipelineMrr > 0) {
    const top = extras.revenue.industries[0];
    if (top) {
      insights.push({
        id: 'pipeline-industry',
        title: `${top.industry}: $${top.weightedMrr.toLocaleString()} weighted pipeline MRR`,
        body: `${top.hotCount} HOT · ${top.warmCount} WARM prospects in vertical.`,
        recommendation: `Double down on ${top.industry} discovery scans and industry-specific content.`,
        priority: 'medium',
        category: 'Pipeline',
      });
    }
  }

  const topFinding = extras?.intelligence?.commonFindings[0];
  if (topFinding) {
    insights.push({
      id: 'content-finding',
      title: `Content angle: "${topFinding.finding.slice(0, 50)}…"`,
      body: `Seen in ${topFinding.count} recent scans — high resonance topic.`,
      recommendation: 'Publish LinkedIn post from Content Intelligence suggestions this week.',
      priority: 'medium',
      category: 'Content',
    });
  }

  insights.push({
    id: 'content-cadence',
    title: 'Maintain 3× weekly social posts',
    body: `${extras?.contentPosts ?? 0} tracked posts · ${extras?.contentSuggestions?.length ?? 0} AI suggestions ready.`,
    recommendation: 'Batch-create 3 posts Sunday; schedule via Content Intelligence Center.',
    priority: 'medium',
    category: 'Content',
  });

  insights.push({
    id: 'scan-velocity',
    title: `${overview.scans} scans in window`,
    body: 'Scan volume correlates with engagement and data moat growth.',
    recommendation: 'Promote free scan on landing page; add referral CTA post-scan.',
    priority: 'low',
    category: 'Growth',
  });

  return insights;
}
