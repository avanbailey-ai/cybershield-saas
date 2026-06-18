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

  const hotScanned = input.hotProspects.filter(
    (p) => p.lead_score === 'HOT' && p.scan_status === 'completed',
  );
  if (hotScanned.length > 0) {
    const top = hotScanned[0];
    const opp = scoreOpportunity({
      leadScore: top.lead_score,
      scanScore: top.scan_score,
      scanRiskLevel: top.scan_risk_level,
      industry: top.industry,
      scanCompleted: true,
    });
    actions.push({
      id: 'outreach-hot',
      title: `Contact ${top.business_name}`,
      description: `${hotScanned.length} HOT prospect(s) with completed scans. Score ${top.scan_score ?? '—'}/100. ${opp.rationale}`,
      impact: 'critical',
      module: 'outreach',
      cta: 'Generate outreach',
    });
  }

  const demoLeads = input.crmLeads.filter((l) => l.stage === 'demo' || l.stage === 'trial');
  if (demoLeads.length > 0) {
    const pipeline = demoLeads.reduce((s, l) => s + Number(l.potential_revenue ?? 0), 0);
    actions.push({
      id: 'close-demo',
      title: `Follow up with ${demoLeads.length} demo/trial lead(s)`,
      description:
        pipeline > 0
          ? `CRM pipeline value: $${pipeline.toLocaleString()}/mo entered`
          : 'Demo/trial leads waiting — add potential revenue in CRM',
      impact: 'critical',
      module: 'crm',
      cta: 'Open CRM',
    });
  }

  if ((input.churnRisk ?? 0) > 0) {
    actions.push({
      id: 'retain-churn',
      title: `Review ${input.churnRisk} at-risk account(s)`,
      description: 'Accounts with churn risk score > 70 in your platform data.',
      impact: 'high',
      module: 'customers',
      cta: 'Review customers',
    });
  }

  if (input.briefing.newSignups > 0) {
    actions.push({
      id: 'nurture-signups',
      title: `Welcome ${input.briefing.newSignups} new signup(s) from last 24h`,
      description: 'Real signups in the last 24 hours — send onboarding follow-up.',
      impact: 'high',
      module: 'outreach',
      cta: 'Start campaign',
    });
  }

  if ((input.unscannedProspects ?? 0) > 0) {
    actions.push({
      id: 'run-scans',
      title: `Scan ${input.unscannedProspects} imported prospect(s)`,
      description: 'Scans unlock HOT/WARM tiers and findings-based outreach.',
      impact: 'high',
      module: 'prospects',
      cta: 'Run scans',
    });
  }

  const contentReady = input.briefing.opportunities.some((o) =>
    o.toLowerCase().includes('finding'),
  );
  if (contentReady && actions.length < 3) {
    actions.push({
      id: 'publish-content',
      title: 'Publish content from this week’s scan findings',
      description: 'Content Intelligence has angles from real platform scans.',
      impact: 'medium',
      module: 'outreach',
      cta: 'Create content',
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'import-prospects',
      title: 'Import your first prospect list',
      description: 'Upload a CSV or paste URLs, then run scans to surface opportunities.',
      impact: 'critical',
      module: 'prospects',
      cta: 'Import prospects',
    });
  }

  return actions.slice(0, 3).map((a, i) => ({ ...a, rank: i + 1 }));
}
