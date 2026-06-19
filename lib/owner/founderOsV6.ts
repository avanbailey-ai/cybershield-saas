import {
  getFounderOsV5,
  EMPTY_FOUNDER_OS_V5,
  type FounderOsV5Data,
  type FounderInboxItem,
} from './founderOsV5';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCustomerHealth } from './customerHealth';
import { getRevenueAtRisk } from './revenueAtRisk';
import { getCustomerExpansion } from './customerExpansion';
import { getActivityFeed } from './activityFeed';
import { getDueFollowUps } from './followUpScheduler';
import { getBusinessHealthMetrics, type BusinessHealthMetrics } from './businessHealthMetrics';
import { getAutomationHealth, type AutomationHealthSummary } from './automationHealth';
import { getEmailHealth, type EmailHealthSummary } from './emailHealth';
import { getEmailIntelligence, type EmailIntelligenceSummary } from './emailIntelligence';
import {
  buildRevenueOpportunities,
  type RevenueOpportunityItem,
} from './revenueOpportunities';
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
    executionStats: {
      pendingApprovals: number;
      emailsSent24h: number;
      followUpsDue: number;
    };
    businessHealth: BusinessHealthMetrics;
    automationHealth: AutomationHealthSummary;
    emailHealth: EmailHealthSummary;
    emailIntelligence: EmailIntelligenceSummary;
    revenueOpportunities: RevenueOpportunityItem[];
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
    executionStats: {
      pendingApprovals: 0,
      emailsSent24h: 0,
      followUpsDue: 0,
    },
    businessHealth: {
      mrr: 0,
      arr: 0,
      payingCustomers: 0,
      activeTrials: 0,
      newSignups30d: 0,
      conversionRate: 0,
      churnRisk: 'Low',
      churnRiskCount: 0,
      revenueAtRisk: 0,
      mrrGoal: 1000,
      goalProgressPct: 0,
      daysToGoal: null,
      calculation: {
        generatedAt: new Date(0).toISOString(),
        mrr: { value: 0, includedPlans: [], excludedAccounts: [], rules: [] },
        conversion: { value: 0, newSignups: 0, upgradedInWindow: 0, windowDays: 30, rules: [] },
      },
    },
    automationHealth: {
      generatedAt: new Date(0).toISOString(),
      overall: 'healthy',
      checks: [],
    },
    emailHealth: {
      generatedAt: new Date(0).toISOString(),
      overall: 'healthy',
      sendingDomain: 'mail.cybershieldcloud.com',
      checks: [],
    },
    emailIntelligence: {
      generatedAt: new Date(0).toISOString(),
      sentToday: 0,
      delivered: 0,
      opened: 0,
      uniqueOpens: 0,
      uniqueOpenRate: 0,
      clicked: 0,
      bounced: 0,
      conversions: 0,
      topTemplates: [],
      topCategories: [],
    },
    revenueOpportunities: [],
  },
};

async function loadDismissedIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin.from('owner_inbox_dismissals').select('inbox_item_id');
  return new Set((data ?? []).map((d) => d.inbox_item_id as string));
}

function enrichOutreachItems(base: FounderOsV5Data): FounderInboxItem[] {
  return base.inbox
    .filter((i) => i.type === 'outreach')
    .map((i) => ({
      ...i,
      whyItMatters: i.whyItMatters ?? 'Outreach-ready prospect — approval sends real email via Resend.',
      revenueImpact: i.revenueImpact ?? null,
      action: 'Approve & Send',
    }));
}

async function buildInbox(
  base: FounderOsV5Data,
  health: CustomerHealthSummary,
  revenue: RevenueAtRiskSummary,
  expansion: CustomerExpansionSummary,
  signups24: number,
  prospects: OwnerProspect[],
): Promise<FounderInboxItem[]> {
  const admin = createAdminClient();
  const dismissed = await loadDismissedIds();
  const inbox: FounderInboxItem[] = [];
  const seen = new Set<string>();

  const push = (item: FounderInboxItem) => {
    if (seen.has(item.id) || dismissed.has(item.id)) return;
    seen.add(item.id);
    inbox.push(item);
  };

  for (const d of enrichOutreachItems(base)) {
    push(d);
  }

  const dueFollowUps = await getDueFollowUps(admin, 5);
  for (const fu of dueFollowUps) {
    const prospect = fu.owner_prospects as {
      business_name?: string;
      contact_email?: string;
    } | null;
    push({
      id: `followup-${fu.prospect_id}:${fu.id}`,
      type: 'follow_up',
      title: `Follow-up due: ${prospect?.business_name ?? 'Prospect'}`,
      description: `Follow-up #${fu.follow_up_number} — approve to send via Resend.`,
      whyItMatters: 'Timely follow-up increases reply rate on contacted prospects.',
      revenueImpact: null,
      action: 'Approve follow-up',
      module: 'inbox',
      meta: { prospectId: fu.prospect_id, followUpId: fu.id },
    });
  }

  for (const p of prospects.filter((x) => x.pipeline_state === 'interested').slice(0, 3)) {
    push({
      id: `interested-${p.id}`,
      type: 'interested',
      title: `Interested: ${p.business_name}`,
      description: 'Prospect showed interest — review and move toward close.',
      whyItMatters: 'Hot lead in pipeline — next step converts to paying customer.',
      revenueImpact: p.estimated_plan_fit ?? null,
      action: 'Review lead',
      module: 'prospects',
      meta: { prospectId: p.id },
    });
  }

  for (const c of health.customers.filter((x) => x.status === 'Critical')) {
    push({
      id: `risk-${c.userId}`,
      type: 'customer_risk',
      title: `Critical: ${c.email}`,
      description: c.recommendedActions[0] ?? 'Customer health critical',
      whyItMatters: 'At-risk customer — retention protects recurring revenue.',
      revenueImpact: c.mrr,
      action: 'Approve retention',
      module: 'success',
      meta: { userId: c.userId, mrr: c.mrr },
    });
  }

  for (const item of revenue.affectedCustomers) {
    push({
      id: `churn-${item.userId}`,
      type: 'customer_risk',
      title: `Revenue at risk: ${item.email}`,
      description: item.reasons.slice(0, 2).join(' · '),
      whyItMatters: 'Churn signals detected — intervention prevents MRR loss.',
      revenueImpact: item.mrr,
      action: 'Approve retention',
      module: 'success',
      meta: { userId: item.userId, mrr: item.mrr },
    });
  }

  for (const opp of expansion.opportunities
    .filter((o) => o.probability === 'High' || o.probability === 'Medium')
    .slice(0, 3)) {
    push({
      id: `exp-${opp.userId}`,
      type: 'expansion',
      title: `Upgrade: ${opp.email}`,
      description: `${opp.currentPlanLabel} → ${opp.recommendedPlanLabel} (+$${opp.mrrGain}/mo)`,
      whyItMatters: 'Usage signals indicate readiness for a higher plan.',
      revenueImpact: opp.mrrGain,
      action: 'Approve upgrade',
      module: 'success',
      meta: { userId: opp.userId, mrrGain: opp.mrrGain, toPlan: opp.recommendedPlan },
    });
  }

  const { data: failedDrafts } = await admin
    .from('owner_outreach_drafts')
    .select('id, business_name, send_error, recipient_email, prospect_id')
    .eq('status', 'failed')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(3);

  for (const f of failedDrafts ?? []) {
    push({
      id: `failed-${f.id}`,
      type: 'failed_email',
      title: `Failed send: ${f.business_name ?? 'Prospect'}`,
      description: (f.send_error as string) ?? 'Resend delivery failed',
      whyItMatters: 'Outreach did not deliver — fix and retry to keep pipeline moving.',
      revenueImpact: null,
      action: 'Retry send',
      module: 'inbox',
      meta: { draftId: f.id, prospectId: f.prospect_id },
    });
  }

  if (signups24 > 0) {
    push({
      id: 'signup-latest',
      type: 'signup',
      title: `${signups24} new signup${signups24 === 1 ? '' : 's'} in last 24h`,
      description: 'Review onboarding path for new users.',
      whyItMatters: 'Early onboarding quality improves trial-to-paid conversion.',
      revenueImpact: null,
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
  const sent = activityFeed.events.filter((e) => e.type === 'email_sent').length;

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
  if (sent > 0) {
    bullets.push(`${sent} outreach email${sent === 1 ? '' : 's'} sent in the last 24 hours.`);
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
  inbox: FounderInboxItem[],
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

  const outreachPending = inbox.filter((i) => i.type === 'outreach').length;
  if (outreachPending > 0) {
    items.push({
      id: 'outreach-pending',
      severity: 'medium',
      title: `${outreachPending} outreach draft(s) awaiting approval`,
      description: 'Approve to send findings-based outreach via Resend',
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
  const admin = createAdminClient();
  const prospectsPromise = input?.prospects
    ? Promise.resolve(input.prospects)
    : admin
        .from('owner_prospects')
        .select('*')
        .is('deleted_at', null)
        .not('pipeline_state', 'eq', 'archived')
        .not('pipeline_state', 'eq', 'ignore_forever')
        .then((r) => (r.data ?? []) as OwnerProspect[]);

  const [base, customerHealth, revenueAtRisk, expansion, activityFeed, prospects, businessHealth, automationHealth, emailHealth, emailIntelligence] =
    await Promise.all([
      getFounderOsV5(input),
      getCustomerHealth(),
      getRevenueAtRisk(),
      getCustomerExpansion(),
      getActivityFeed(24),
      prospectsPromise,
      getBusinessHealthMetrics(),
      getAutomationHealth(),
      getEmailHealth(),
      getEmailIntelligence(),
    ]);

  const signups24 = activityFeed.events.filter((e) => e.type === 'signup').length;
  const inbox = await buildInbox(
    base,
    customerHealth,
    revenueAtRisk,
    expansion,
    signups24,
    prospects,
  );
  const attention = buildAttention(customerHealth, revenueAtRisk, expansion, inbox);
  const approvableTypes = new Set([
    'outreach',
    'follow_up',
    'failed_email',
    'customer_risk',
    'expansion',
    'signup',
  ]);
  const pendingApprovals = inbox.filter((i) => approvableTypes.has(i.type)).length;
  const outreachDraftCount = inbox.filter((i) => i.type === 'outreach').length;

  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const [sent24Res, followDueRes] = await Promise.all([
    admin
      .from('owner_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'email_sent')
      .gte('created_at', dayAgo),
    admin
      .from('owner_follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'due'),
  ]);

  const revenueOpportunities = buildRevenueOpportunities({
    prospects,
    inbox,
    expansion,
    revenueAtRisk,
    signups24h: signups24,
  });

  const executionStats = {
    pendingApprovals,
    emailsSent24h: sent24Res.count ?? 0,
    followUpsDue: followDueRes.count ?? 0,
  };

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
      : pendingApprovals > 0
        ? `Approve ${pendingApprovals} pending item${pendingApprovals === 1 ? '' : 's'}`
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

  const approvableItems = inbox.filter((i) => approvableTypes.has(i.type));

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
      outreachDrafts: outreachDraftCount,
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
        mrr: businessHealth.mrr,
        mrrAtRisk: revenueAtRisk.totalMrrAtRisk,
        changesCount: activityFeed.events.length,
        topOpportunity: base.biggestOpportunity?.businessName ?? null,
        needsAttention: attention.length,
      },
      executionStats,
      businessHealth,
      automationHealth,
      emailHealth,
      emailIntelligence,
      revenueOpportunities,
    },
  };
}
