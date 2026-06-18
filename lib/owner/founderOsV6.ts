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

function buildV6Inbox(
  base: FounderOsV5Data,
  health: CustomerHealthSummary,
  revenue: RevenueAtRiskSummary,
  expansion: CustomerExpansionSummary,
): FounderInboxItem[] {
  const inbox: FounderInboxItem[] = [...base.inbox];
  const seen = new Set(inbox.map((i) => i.id));

  for (const c of health.customers.filter((x) => x.status === 'Critical').slice(0, 3)) {
    const id = `risk-${c.userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    inbox.push({
      id,
      type: 'customer_risk',
      title: `Critical: ${c.email}`,
      description: c.recommendedActions[0] ?? 'Customer health critical',
      action: 'Approve retention',
      module: 'customers',
      meta: { userId: c.userId, mrr: c.mrr },
    });
  }

  for (const item of revenue.affectedCustomers.slice(0, 2)) {
    const id = `churn-${item.userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    inbox.push({
      id,
      type: 'customer_risk',
      title: `Revenue at risk: ${item.email}`,
      description: item.reasons.slice(0, 2).join(' · '),
      action: 'Approve retention',
      module: 'customers',
      meta: { userId: item.userId, mrr: item.mrr },
    });
  }

  for (const opp of expansion.opportunities.filter((o) => o.probability === 'High').slice(0, 2)) {
    const id = `exp-${opp.userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    inbox.push({
      id,
      type: 'expansion',
      title: `Upgrade: ${opp.email}`,
      description: `${opp.currentPlanLabel} → ${opp.recommendedPlanLabel} (+$${opp.mrrGain}/mo)`,
      action: 'Approve upgrade',
      module: 'customers',
      meta: { userId: opp.userId, mrrGain: opp.mrrGain, toPlan: opp.recommendedPlan },
    });
  }

  return inbox.slice(0, 15);
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
    });
  }

  for (const c of health.customers.filter((x) => x.status === 'Critical').slice(0, 2)) {
    items.push({
      id: `critical-${c.userId}`,
      severity: 'high',
      title: c.email,
      description: c.recommendedActions[0] ?? 'Critical health',
      mrrImpact: c.mrr,
    });
  }

  if (base.autopilot.outreachDrafts > 0) {
    items.push({
      id: 'outreach-pending',
      severity: 'medium',
      title: `${base.autopilot.outreachDrafts} outreach draft(s) awaiting approval`,
      description: 'Approve to send findings-based outreach',
    });
  }

  if (expansion.highProbability > 0) {
    items.push({
      id: 'expansion-ready',
      severity: 'low',
      title: `${expansion.highProbability} high-probability upgrade(s)`,
      description: `+$${expansion.totalPotentialMrr}/mo expansion potential`,
      mrrImpact: expansion.totalPotentialMrr,
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

  const inbox = buildV6Inbox(base, customerHealth, revenueAtRisk, expansion);
  const attention = buildAttention(customerHealth, revenueAtRisk, expansion, base);

  const chiefBullets = activityFeed.events.slice(0, 4).map((e) => {
    const detail = e.detail ? ` — ${e.detail}` : '';
    return `${e.timeLabel}: ${e.label}${detail}`;
  });

  if (chiefBullets.length === 0) {
    chiefBullets.push(...base.chiefOfStaff.bullets.slice(0, 3));
  }

  return {
    ...base,
    chiefOfStaff: {
      ...base.chiefOfStaff,
      bullets: chiefBullets,
      focus:
        attention.length > 0
          ? attention[0].title
          : base.biggestOpportunity
            ? `Close ${base.biggestOpportunity.businessName}`
            : base.chiefOfStaff.focus,
      upside:
        expansion.totalPotentialMrr > 0
          ? `+$${expansion.totalPotentialMrr}/mo expansion · $${revenueAtRisk.totalMrrAtRisk}/mo at risk`
          : base.chiefOfStaff.upside,
    },
    inbox,
    autopilot: {
      ...base.autopilot,
      expansionOpportunities: expansion.opportunities.length,
      items: inbox.filter((i) => i.type === 'outreach' || i.type === 'expansion'),
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
    whileAway: activityFeed.events.slice(0, 6).map((e) => ({
      label: e.label,
      value: 1,
    })),
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
