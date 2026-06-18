import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { getCustomerHealth, type CustomerHealthRecord } from './customerHealth';
import { isInternalCustomerEmail } from './founderCustomerFilters';

export interface RevenueAtRiskItem {
  userId: string;
  email: string;
  plan: string;
  mrr: number;
  reasons: string[];
  suggestedActions: string[];
}

export interface RevenueAtRiskSummary {
  generatedAt: string;
  totalMrrAtRisk: number;
  affectedCustomers: RevenueAtRiskItem[];
  potentialMonthlyLoss: number;
  suggestedActions: string[];
}

const MS_DAY = 86400000;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_DAY);
}

function customerToRiskItem(c: CustomerHealthRecord): RevenueAtRiskItem | null {
  if (isInternalCustomerEmail(c.email)) return null;
  if (c.mrr <= 0 && c.plan === 'free') return null;

  const reasons: string[] = [];
  const actions: string[] = [];

  const paymentPastDue = c.reasons.some((r) => !r.ok && r.label.includes('Payment past due'));
  const inactive =
    daysSince(c.lastActivityAt) !== null && (daysSince(c.lastActivityAt) ?? 0) > 30;

  if (c.status === 'Critical') {
    for (const r of c.reasons) {
      if (!r.ok) reasons.push(r.label);
    }
    actions.push('Immediate founder outreach');
  } else if (c.status === 'At Risk') {
    for (const r of c.reasons) {
      if (!r.ok && !r.label.includes('No scans in 30+ days')) reasons.push(r.label);
    }
    if (reasons.length === 0) {
      reasons.push('At-risk health score');
    }
    actions.push('Review in customer success center');
  } else if (paymentPastDue) {
    reasons.push('Payment past due');
    actions.push('Resolve billing issue');
  } else {
    return null;
  }

  if (inactive && c.status !== 'Healthy') {
    if (!reasons.some((r) => r.includes('Inactive') || r.includes('login'))) {
      reasons.push('Inactive 30+ days');
    }
    actions.push('Send re-engagement campaign');
  }

  if (reasons.length === 0) return null;

  return {
    userId: c.userId,
    email: c.email,
    plan: c.plan,
    mrr: c.mrr,
    reasons: [...new Set(reasons)].slice(0, 6),
    suggestedActions: [...new Set([...actions, ...c.recommendedActions])].slice(0, 4),
  };
}

export async function getRevenueAtRisk(): Promise<RevenueAtRiskSummary> {
  const admin = createAdminClient();
  const [health, displayAmounts, subsRes] = await Promise.all([
    getCustomerHealth(),
    getPlanDisplayAmounts(),
    admin
      .from('subscriptions')
      .select('user_id, status, plan')
      .in('status', ['past_due', 'canceled', 'unpaid']),
  ]);

  const affectedMap = new Map<string, RevenueAtRiskItem>();

  for (const c of health.customers) {
    const item = customerToRiskItem(c);
    if (item) affectedMap.set(c.userId, item);
  }

  for (const sub of subsRes.data ?? []) {
    const userId = sub.user_id as string;
    const plan = (sub.plan as string) ?? 'free';
    const mrr =
      plan === 'free' ? 0 : (displayAmounts[plan as keyof typeof displayAmounts] ?? 0);
    if (mrr <= 0) continue;

    const healthRecord = health.customers.find((c) => c.userId === userId);
    if (healthRecord && isInternalCustomerEmail(healthRecord.email)) continue;

    const existing = affectedMap.get(userId);
    const paymentReason = `Subscription ${sub.status}`;
    if (existing) {
      if (!existing.reasons.includes(paymentReason)) existing.reasons.push(paymentReason);
      if (!existing.suggestedActions.includes('Resolve billing issue')) {
        existing.suggestedActions.push('Resolve billing issue');
      }
    } else {
      affectedMap.set(userId, {
        userId,
        email: healthRecord?.email ?? 'Customer',
        plan,
        mrr,
        reasons: [paymentReason],
        suggestedActions: ['Resolve billing issue', 'Contact customer directly'],
      });
    }
  }

  const affectedCustomers = [...affectedMap.values()].sort((a, b) => b.mrr - a.mrr);
  const totalMrrAtRisk = affectedCustomers.reduce((s, c) => s + c.mrr, 0);

  const globalActions: string[] = [];
  if (affectedCustomers.length > 0) {
    globalActions.push(`Prioritize ${affectedCustomers.length} at-risk account(s)`);
  }
  if ((health.critical ?? 0) > 0) {
    globalActions.push(`Address ${health.critical} critical health account(s)`);
  }
  if (globalActions.length === 0) {
    globalActions.push('Revenue base is stable — focus on expansion');
  }

  return {
    generatedAt: new Date().toISOString(),
    totalMrrAtRisk,
    affectedCustomers,
    potentialMonthlyLoss: totalMrrAtRisk,
    suggestedActions: globalActions,
  };
}
