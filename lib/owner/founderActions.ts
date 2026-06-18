import type { FounderBriefing } from './briefing';
import type { OwnerProspect, OwnerCrmLead } from './types';
import { scoreOpportunity } from './opportunityScore';

export interface FounderAction {
  id: string;
  rank: number;
  title: string;
  description: string;
  impact: 'critical' | 'high' | 'medium';
  module: string;
  cta: string;
}

export interface FounderActionInput {
  briefing: FounderBriefing;
  hotProspects: OwnerProspect[];
  crmLeads: OwnerCrmLead[];
  churnRisk?: number;
  unscannedProspects?: number;
}

export function generateFounderActions(input: FounderActionInput): FounderAction[] {
  const actions: Omit<FounderAction, 'rank'>[] = [];

  const hotUncontacted = input.hotProspects.filter(
    (p) => p.lead_score === 'HOT' && p.scan_status === 'completed',
  );
  if (hotUncontacted.length > 0) {
    const top = hotUncontacted[0];
    const opp = scoreOpportunity({
      leadScore: top.lead_score,
      scanScore: top.scan_score,
      scanRiskLevel: top.scan_risk_level,
      industry: top.industry,
    });
    actions.push({
      id: 'outreach-hot',
      title: `Outreach ${top.business_name} — $${opp.estimatedMrr}/mo potential`,
      description: `${hotUncontacted.length} HOT prospect(s) with completed scans. ${opp.rationale}`,
      impact: 'critical',
      module: 'outreach',
      cta: 'Generate outreach',
    });
  }

  const demoLeads = input.crmLeads.filter((l) => l.stage === 'demo' || l.stage === 'trial');
  if (demoLeads.length > 0) {
    actions.push({
      id: 'close-demo',
      title: `Close ${demoLeads.length} demo/trial lead(s)`,
      description: `Pipeline value: $${demoLeads.reduce((s, l) => s + Number(l.potential_revenue ?? 0), 0).toLocaleString()}`,
      impact: 'critical',
      module: 'crm',
      cta: 'Open CRM',
    });
  }

  if ((input.churnRisk ?? 0) > 0) {
    actions.push({
      id: 'retain-churn',
      title: `Save ${input.churnRisk} at-risk account(s)`,
      description: 'Proactive retention outreach recovers 20–30% of at-risk MRR.',
      impact: 'high',
      module: 'customer-intel',
      cta: 'Review churn signals',
    });
  }

  if (input.briefing.newSignups > 0) {
    actions.push({
      id: 'nurture-signups',
      title: `Nurture ${input.briefing.newSignups} new signup(s) from last 24h`,
      description: 'First 48 hours drive conversion — send onboarding + free scan CTA.',
      impact: 'high',
      module: 'campaigns',
      cta: 'Start nurture campaign',
    });
  }

  if ((input.unscannedProspects ?? 0) > 0) {
    actions.push({
      id: 'run-scans',
      title: `Run scans on ${input.unscannedProspects} pending prospect(s)`,
      description: 'Scans unlock HOT/WARM scores and findings-based outreach.',
      impact: 'high',
      module: 'prospects',
      cta: 'Run discovery',
    });
  }

  if (input.briefing.opportunities.length > 0 && actions.length < 3) {
    actions.push({
      id: 'review-opps',
      title: 'Review growth opportunities',
      description: input.briefing.opportunities[0],
      impact: 'medium',
      module: 'briefing',
      cta: 'View briefing',
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'discover',
      title: 'Run prospect discovery in your target market',
      description: 'No HOT leads or pipeline activity — generate prospects and auto-scan.',
      impact: 'critical',
      module: 'prospects',
      cta: 'Run discovery',
    });
    actions.push({
      id: 'content',
      title: 'Publish 1 LinkedIn post from scan insights',
      description: 'Content Intelligence can draft posts from real platform findings.',
      impact: 'medium',
      module: 'social',
      cta: 'Create content',
    });
    actions.push({
      id: 'campaign',
      title: 'Launch a 7-day growth campaign',
      description: 'Structured daily tasks for outbound, content, and CRM follow-up.',
      impact: 'medium',
      module: 'campaigns',
      cta: 'Create campaign',
    });
  }

  return actions.slice(0, 3).map((a, i) => ({ ...a, rank: i + 1 }));
}
