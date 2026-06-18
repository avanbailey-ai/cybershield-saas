import type { FounderInboxItem } from './founderOsV5';
import type { OwnerProspect } from './types';
import type { CustomerExpansionSummary } from './customerExpansion';
import type { RevenueAtRiskSummary } from './revenueAtRisk';
import { hasOutreachContact, resolveProspectList } from './prospectDisplay';
import { confidenceLabel } from './pipeline';

export interface RevenueOpportunityItem {
  id: string;
  type: 'outreach' | 'follow_up' | 'onboarding' | 'expansion' | 'retention';
  title: string;
  estimatedMrr: number | null;
  confidence: string;
  reason: string;
  actionLabel: string;
  actionTarget: 'inbox' | 'prospects' | 'success' | 'customers';
  inboxId?: string;
  prospectId?: string;
  userId?: string;
}

export function buildRevenueOpportunities(input: {
  prospects: OwnerProspect[];
  inbox: FounderInboxItem[];
  expansion: CustomerExpansionSummary;
  revenueAtRisk: RevenueAtRiskSummary;
  signups24h: number;
}): RevenueOpportunityItem[] {
  const items: RevenueOpportunityItem[] = [];
  const resolved = resolveProspectList(input.prospects);

  for (const p of resolved
    .filter((x) => x.pipeline_state === 'outreach_ready' && hasOutreachContact(x))
    .sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0))
    .slice(0, 5)) {
    const draftItem = input.inbox.find(
      (i) => i.type === 'outreach' && i.meta?.prospectId === p.id,
    );
    items.push({
      id: `opp-outreach-${p.id}`,
      type: 'outreach',
      title: p.business_name,
      estimatedMrr: p.estimated_plan_fit ?? null,
      confidence: confidenceLabel(p.conversion_likelihood, p.opportunity_score),
      reason:
        Array.isArray(p.qualification_reasons) && p.qualification_reasons[0]
          ? p.qualification_reasons[0]
          : 'Outreach-ready with contact email',
      actionLabel: 'Approve & Send',
      actionTarget: draftItem ? 'inbox' : 'prospects',
      inboxId: draftItem?.id,
      prospectId: p.id,
    });
  }

  for (const fu of input.inbox.filter((i) => i.type === 'follow_up').slice(0, 3)) {
    items.push({
      id: `opp-followup-${fu.id}`,
      type: 'follow_up',
      title: fu.title,
      estimatedMrr: fu.revenueImpact ?? null,
      confidence: 'Medium',
      reason: fu.description,
      actionLabel: fu.action,
      actionTarget: 'inbox',
      inboxId: fu.id,
    });
  }

  if (input.signups24h > 0) {
    const signupItem = input.inbox.find((i) => i.type === 'signup');
    items.push({
      id: 'opp-signup',
      type: 'onboarding',
      title: `${input.signups24h} new signup${input.signups24h === 1 ? '' : 's'}`,
      estimatedMrr: null,
      confidence: 'High',
      reason: 'Early onboarding improves trial-to-paid conversion.',
      actionLabel: signupItem?.action ?? 'Approve onboarding',
      actionTarget: 'inbox',
      inboxId: signupItem?.id,
    });
  }

  for (const o of input.expansion.opportunities
    .filter((x) => x.probability === 'High' || x.probability === 'Medium')
    .slice(0, 2)) {
    const expItem = input.inbox.find(
      (i) => i.type === 'expansion' && i.meta?.userId === o.userId,
    );
    items.push({
      id: `opp-exp-${o.userId}`,
      type: 'expansion',
      title: o.email,
      estimatedMrr: o.mrrGain,
      confidence: o.probability,
      reason: o.signals[0] ?? o.reasoning[0] ?? 'Usage signals indicate upgrade readiness',
      actionLabel: expItem?.action ?? 'Approve upgrade',
      actionTarget: 'inbox',
      inboxId: expItem?.id,
      userId: o.userId,
    });
  }

  for (const r of input.revenueAtRisk.affectedCustomers.slice(0, 2)) {
    const riskItem = input.inbox.find(
      (i) =>
        i.type === 'customer_risk' &&
        (i.meta?.userId === r.userId || i.id === `churn-${r.userId}`),
    );
    items.push({
      id: `opp-retention-${r.userId}`,
      type: 'retention',
      title: r.email,
      estimatedMrr: r.mrr,
      confidence: r.mrr >= 149 ? 'High' : 'Medium',
      reason: r.reasons[0] ?? 'Customer health declining',
      actionLabel: riskItem?.action ?? 'Approve retention',
      actionTarget: 'inbox',
      inboxId: riskItem?.id,
      userId: r.userId,
    });
  }

  return items.slice(0, 10);
}
