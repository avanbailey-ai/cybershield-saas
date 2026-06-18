import type { BusinessOverviewMetrics } from '../types';

export interface MarketingInsight {
  id: string;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

export function generateMarketingInsights(
  overview: BusinessOverviewMetrics,
  extras?: {
    hotProspects?: number;
    churnRisk?: number;
    contentPosts?: number;
  },
): MarketingInsight[] {
  const insights: MarketingInsight[] = [];

  if (overview.conversionRate < 5 && overview.newSignups > 0) {
    insights.push({
      id: 'low-conversion',
      title: 'Signup-to-paid conversion below 5%',
      body: `Only ${overview.conversionRate}% of recent signups converted. Test pricing page CTA and onboarding email sequence.`,
      priority: 'high',
      category: 'Conversion',
    });
  }

  if (overview.mrr > 0 && overview.mrrGrowthPct < 0) {
    insights.push({
      id: 'mrr-decline',
      title: 'MRR growth slowing',
      body: `MRR growth at ${overview.mrrGrowthPct}%. Focus on retention campaigns and upsell to Growth/Agency plans.`,
      priority: 'high',
      category: 'Revenue',
    });
  }

  if ((extras?.hotProspects ?? 0) > 0) {
    insights.push({
      id: 'hot-prospects',
      title: `${extras!.hotProspects} HOT prospects ready`,
      body: 'High-risk prospect scans completed. Run outreach generator and move top leads to CRM demo stage.',
      priority: 'high',
      category: 'Outbound',
    });
  }

  if ((extras?.churnRisk ?? 0) > 3) {
    insights.push({
      id: 'churn-risk',
      title: `${extras!.churnRisk} accounts at churn risk`,
      body: 'Proactive outreach to at-risk accounts can recover 20-30% of revenue. Check CEO dashboard churn signals.',
      priority: 'medium',
      category: 'Retention',
    });
  }

  insights.push({
    id: 'content-cadence',
    title: 'Maintain 3x weekly social posts',
    body: `You have ${extras?.contentPosts ?? 0} tracked posts. Consistent LinkedIn content drives inbound leads for security SaaS.`,
    priority: 'medium',
    category: 'Content',
  });

  insights.push({
    id: 'scan-velocity',
    title: `${overview.scans} scans in window`,
    body: 'Scan volume correlates with engagement. Promote free scan on landing page and referral loop.',
    priority: 'low',
    category: 'Growth',
  });

  return insights;
}
