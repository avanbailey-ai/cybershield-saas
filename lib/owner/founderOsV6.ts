import {
  getFounderOsV5,
  EMPTY_FOUNDER_OS_V5,
  type FounderOsV5Data,
  type FounderInboxItem,
} from './founderOsV5';
import { getCustomerHealth } from './customerHealth';
import { getRevenueAtRisk } from './revenueAtRisk';
import { getCustomerExpansion } from './customerExpansion';
import { getActivityFeed } from './activityFeed';
import type { CustomerHealthSummary } from './customerHealth';
import type { RevenueAtRiskSummary } from './revenueAtRisk';
import type { CustomerExpansionSummary } from './customerExpansion';
import type { ActivityFeedSummary } from './activityFeed';
import type { OwnerProspect, OwnerCrmLead } from './types';

export interface FounderAttentionItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  mrrImpact?: number;
  section: 'inbox' | 'success' | 'prospects';
}

export interface FounderOsV6Data extends FounderOsV5Data {
  v6: {
    customerHealth: CustomerHealthSummary;
    revenueAtRisk: RevenueAtRiskSummary;
    expansion: CustomerExpansionSummary;
    activityFeed: ActivityFeedSummary;
    attention: FounderAttentionItem[];
    homeSummary: {
      mrr: number;
      mrrAtRisk: number;
      changesCount: number;
      topOpportunity: string | null;
      needsAttention: number;
    };
  };
}

export const EMPTY_FOUNDER_OS_V6: FounderOsV6Data = {
  ...EMPTY_FOUNDER_OS_V5,
  v6: {
    customerHealth: {
      generatedAt: new Date(0).toISOString(),
      customers: [],
      healthy: 0,
      atRisk: 0,
      critical: 0,
      inactive: 0,
    },
    revenueAtRisk: {
      generatedAt: new Date(0).toISOString(),
      totalMrrAtRisk: 0,
      affectedCustomers: [],
      potentialMonthlyLoss: 0,
      suggestedActions: [],
    },
    expansion: {
      generatedAt: new Date(0).toISOString(),
      opportunities: [],
      totalPotentialMrr: 0,
      highProbability: 0,
    },
    activityFeed: { generatedAt: new Date(0).toISOString(), events: [] },
    attention: [],
    homeSummary: {
      mrr: 0,
      mrrAtRisk: 0,
      changesCount: 0,
      topOpportunity: null,
      needsAttention: 0,
    },
  },
};

function buildInbox(
  base: FounderOsV5Data,
  health: CustomerHealthSummary,
  revenue: RevenueAtRiskSummary,
  expansion: CustomerExpansionSummary,
  signups24: number,
): FounderInboxItem[] {
  const inbox: FounderInboxItem[] = [];
  const seen = new Set<string>();

  for (const d of base.inbox.filter((i) => i.type === 'outreach')) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    inbox.push(d);
  }

  for (const c of health.customers.filter((x) => x.status === 'Critical')) {
    const id = `risk-${c.userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    inbox.push({
      id,
      type: 'customer_risk',
      title: `Critical: ${c.email}`,
      description: c.recommendedActions[0] ?? 'Customer health critical',
      action: 'Approve retention',
      module: 'success',
      meta: { userId: c.userId, mrr: c.mrr },
    });
  }

  for (const item of revenue.affectedCustomers) {
    const id = `churn-${item.userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    inbox.push({
      id,
      type: 'customer_risk',
      title: `Revenue at risk: ${item.email}`,
      description: item.reasons.slice(0, 2).join(' · '),
      action: 'Approve retention',
      module: 'success',
      meta: { userId: item.userId, mrr: item.mrr },
    });
  }

  for (const opp of expansion.opportunities
    .filter((o) => o.probability === 'High' || o.probability === 'Medium')
    .slice(0, 3)) {
    const id = `exp-${opp.userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    inbox.push({
      id,
      type: 'expansion',
      title: `Upgrade: ${opp.email}`,
      description: `${opp.currentPlanLabel} → ${opp.recommendedPlanLabel} (+$${opp.mrrGain}/mo)`,
      action: 'Approve upgrade',
      module: 'success',
      meta: { userId: opp.userId, mrrGain: opp.mrrGain, toPlan: opp.recommendedPlan },
    });
  }

  if (signups24 > 0) {
    inbox.push({
      id: 'signup-latest',
      type: 'signup',
      title: `${signups24} new signup${signups24 === 1 ? '' : 's'} in last 24h`,
      description: 'Review onboarding path for new users.',
      action: 'Review signups',
      module: 'customers',
    });
  }

  return inbox.slice(0, 15);
}

function buildChiefBullets(
  base: FounderOsV5Data,
  health: CustomerHealthSummary,
  revenue: RevenueAtRiskSummary,
  expansion: CustomerExpansionSummary,
  activityFeed: ActivityFeedSummary,
  signups24: number,
): string[] {
  const bullets: string[] = [];

  const discoveries = activityFeed.events.filter((e) => e.label.includes('discovered')).length;
  const drafts = activityFeed.events.filter((e) => e.type === 'outreach_draft').length;

  if (signups24 > 0) {
    bullets.push(
      `CyberShield gained ${signups24} new signup${signups24 === 1 ? '' : 's'} in the last 24 hours.`,
    );
  }
  if (discoveries > 0) {
    bullets.push(
      `${discoveries} discovery run${discoveries === 1 ? '' : 's'} completed overnight.`,
    );
  }
  if (base.biggestOpportunity && base.biggestOpportunity.opportunityScore >= 25) {
    bullets.push(
      `${base.biggestOpportunity.businessName} is your top opportunity (${base.biggestOpportunity.opportunityScore}/100).`,
    );
  }
  if (revenue.affectedCustomers.length > 0) {
    bullets.push(
      `$${revenue.totalMrrAtRisk}/mo across ${revenue.affectedCustomers.length} account(s) needs retention attention.`,
    );
  } else if (health.healthy > 0) {
    bullets.push(`${health.healthy} paying customer${health.healthy === 1 ? '' : 's'} are healthy.`);
  }
  if (expansion.opportunities.length > 0) {
    bullets.push(
      `${expansion.opportunities.length} expansion signal${expansion.opportunities.length === 1 ? '' : 's'} detected (+$${expansion.totalPotentialMrr}/mo potential).`,
    );
  }
  if (drafts > 0) {
    bullets.push(`${drafts} outreach draft${drafts === 1 ? '' : 's'} ready for your approval.`);
  }

  if (bullets.length === 0) {
    bullets.push('Quiet period — run discovery to feed the revenue engine.');
  }

  return bullets.slice(0, 4);
}

function buildAttention(
  health: CustomerHealthSummary,
  revenue: RevenueAtRiskSummary,
  expansion: CustomerExpansionSummary,
  base: FounderOsV5Data,
): FounderAttentionItem[] {
  const items: FounderAttentionItem[] = [];

  if (revenue.totalMrrAtRisk > 0) {
    items.push({
      id: 'revenue-at-risk',
      severity: 'high',
      title: `$${revenue.totalMrrAtRisk}/mo revenue at risk`,
      description: `${revenue.affectedCustomers.length} customer(s) need intervention`,
      mrrImpact: revenue.totalMrrAtRisk,
      section: 'success',
    });
  }

  for (const c of health.customers.filter((x) => x.status === 'Critical').slice(0, 2)) {
    items.push({
      id: `critical-${c.userId}`,
      severity: 'high',
      title: c.email,
      description: c.recommendedActions[0] ?? 'Critical health',
      mrrImpact: c.mrr,
      section: 'success',
    });
  }

  const outreachPending = base.inbox.filter((i) => i.type === 'outreach').length;
  if (outreachPending > 0) {
    items.push({
      id: 'outreach-pending',
      severity: 'medium',
      title: `${outreachPending} outreach draft(s) awaiting approval`,
      description: 'Approve to send findings-based outreach',
      section: 'inbox',
    });
  }

  if (expansion.highProbability > 0) {
    items.push({
      id: 'expansion-ready',
      severity: 'low',
      title: `${expansion.highProbability} high-probability upgrade(s)`,
      description: `+$${expansion.totalPotentialMrr}/mo expansion potential`,
      mrrImpact: expansion.totalPotentialMrr,
      section: 'success',
    });
  }

  return items.slice(0, 6);
}

export async function getFounderOsV6(input?: {
  prospects?: OwnerProspect[];
  crmLeads?: OwnerCrmLead[];
}): Promise<FounderOsV6Data> {
  const [base, customerHealth, revenueAtRisk, expansion, activityFeed] = await Promise.all([
    getFounderOsV5(input),
    getCustomerHealth(),
    getRevenueAtRisk(),
    getCustomerExpansion(),
    getActivityFeed(24),
  ]);

  const signups24 = activityFeed.events.filter((e) => e.type === 'signup').length;
  const inbox = buildInbox(base, customerHealth, revenueAtRisk, expansion, signups24);
  const attention = buildAttention(customerHealth, revenueAtRisk, expansion, base);
  const outreachPending = inbox.filter((i) => i.type === 'outreach').length;

  const chiefBullets = buildChiefBullets(
    base,
    customerHealth,
    revenueAtRisk,
    expansion,
    activityFeed,
    signups24,
  );

  const focus =
    revenueAtRisk.totalMrrAtRisk > 0
      ? `Protect $${revenueAtRisk.totalMrrAtRisk}/mo — review at-risk customers`
      : outreachPending > 0
        ? `Approve ${outreachPending} outreach draft${outreachPending === 1 ? '' : 's'}`
        : base.biggestOpportunity
          ? `Close ${base.biggestOpportunity.businessName}`
          : 'Run targeted discovery';

  const upside =
    expansion.totalPotentialMrr > 0 || revenueAtRisk.totalMrrAtRisk > 0
      ? [
          expansion.totalPotentialMrr > 0 ? `+$${expansion.totalPotentialMrr}/mo expansion` : null,
          revenueAtRisk.totalMrrAtRisk > 0
            ? `$${revenueAtRisk.totalMrrAtRisk}/mo at risk`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : base.chiefOfStaff.upside;

  const approvableItems = inbox.filter(
    (i) =>
      i.type === 'outreach' ||
      i.type === 'expansion' ||
      (i.type === 'customer_risk' && i.action.toLowerCase().includes('approve')),
  );

  return {
    ...base,
    chiefOfStaff: {
      ...base.chiefOfStaff,
      bullets: chiefBullets,
      focus,
      upside,
    },
    inbox,
    autopilot: {
      outreachDrafts: outreachPending,
      followUps: inbox.filter((i) => i.type === 'follow_up').length,
      expansionOpportunities: inbox.filter((i) => i.type === 'expansion').length,
      items: approvableItems,
    },
    customerSuccess: {
      healthy: customerHealth.healthy,
      needsAttention: customerHealth.atRisk + customerHealth.critical,
      expansionOpportunities: expansion.opportunities.length,
      potentialExpansionMrr: expansion.totalPotentialMrr,
      atRisk: customerHealth.customers
        .filter((c) => c.status !== 'Healthy')
        .slice(0, 5)
        .map((c) => ({ name: c.email, reason: c.reasons.find((r) => !r.ok)?.label ?? c.status })),
      expansions: expansion.opportunities.slice(0, 5).map((o) => ({
        name: o.email,
        from: o.currentPlanLabel,
        to: o.recommendedPlanLabel,
        mrr: o.mrrGain,
      })),
    },
    v6: {
      customerHealth,
      revenueAtRisk,
      expansion,
      activityFeed,
      attention,
      homeSummary: {
        mrr: base.businessStatus.mrr,
        mrrAtRisk: revenueAtRisk.totalMrrAtRisk,
        changesCount: activityFeed.events.length,
        topOpportunity: base.biggestOpportunity?.businessName ?? null,
        needsAttention: attention.length,
      },
    },
  };
}
