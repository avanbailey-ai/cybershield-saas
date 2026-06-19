import { createAdminClient } from '@/lib/supabase/admin';
import { getCustomerHealth, type CustomerHealthRecord } from './customerHealth';
import { getCustomerExpansion } from './customerExpansion';
import { getRevenueAtRisk } from './revenueAtRisk';
import { getFounderCustomerMetrics } from './founderCustomerMetrics';

export interface CustomerDirectoryEntry {
  userId: string;
  email: string;
  plan: string;
  planLabel: string;
  mrr: number;
  healthScore: number;
  healthStatus: string;
  lastLoginAt: string | null;
  websites: { url: string; isActive: boolean }[];
  scansLast30Days: number;
  alertsLast30Days: number;
  risks: string[];
  expansionOpportunity: {
    recommendedPlan: string;
    mrrGain: number;
    probability: string;
  } | null;
  nextAction: string;
}

export interface CustomerDirectorySummary {
  generatedAt: string;
  totalMrr: number;
  customers: CustomerDirectoryEntry[];
}

function planLabel(plan: string): string {
  const map: Record<string, string> = {
    pro: 'Starter',
    growth: 'Growth',
    agency: 'Agency',
    free: 'Free',
  };
  return map[plan] ?? plan;
}

function nextActionForCustomer(
  c: CustomerHealthRecord,
  hasExpansion: boolean,
): string {
  if (c.status === 'Critical') return 'Approve retention outreach';
  if (c.status === 'At Risk') return 'Send re-engagement email';
  if (hasExpansion) return 'Review upgrade opportunity';
  if (c.websiteCount === 0) return 'Prompt to add website';
  return 'Monitor — healthy';
}

export async function getCustomerDirectory(): Promise<CustomerDirectorySummary> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [health, expansion, revenue, founderMetrics, websitesRes, scansRes, alertsRes] = await Promise.all([
    getCustomerHealth(),
    getCustomerExpansion(),
    getRevenueAtRisk(),
    getFounderCustomerMetrics(),
    admin.from('websites').select('user_id, url, is_active'),
    admin
      .from('scans')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo),
    admin
      .from('alerts')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const expansionByUser = new Map(
    expansion.opportunities.map((o) => [o.userId, o]),
  );
  const riskByUser = new Map(revenue.affectedCustomers.map((r) => [r.userId, r]));

  const websitesByUser = new Map<string, { url: string; isActive: boolean }[]>();
  for (const w of websitesRes.data ?? []) {
    const uid = w.user_id as string;
    const list = websitesByUser.get(uid) ?? [];
    list.push({ url: w.url as string, isActive: w.is_active as boolean });
    websitesByUser.set(uid, list);
  }

  const scansByUser = new Map<string, number>();
  for (const s of scansRes.data ?? []) {
    const uid = s.user_id as string;
    scansByUser.set(uid, (scansByUser.get(uid) ?? 0) + 1);
  }

  const alertsByUser = new Map<string, number>();
  for (const a of alertsRes.data ?? []) {
    const uid = a.user_id as string;
    alertsByUser.set(uid, (alertsByUser.get(uid) ?? 0) + 1);
  }

  const customers: CustomerDirectoryEntry[] = health.customers.map((c) => {
    const exp = expansionByUser.get(c.userId);
    const risk = riskByUser.get(c.userId);
    const risks = [
      ...c.reasons.filter((r) => !r.ok).map((r) => r.label),
      ...(risk?.reasons ?? []),
    ].slice(0, 4);

    return {
      userId: c.userId,
      email: c.email,
      plan: c.plan,
      planLabel: planLabel(c.plan),
      mrr: c.mrr,
      healthScore: c.score,
      healthStatus: c.status,
      lastLoginAt: c.lastActivityAt,
      websites: websitesByUser.get(c.userId) ?? [],
      scansLast30Days: scansByUser.get(c.userId) ?? 0,
      alertsLast30Days: alertsByUser.get(c.userId) ?? 0,
      risks,
      expansionOpportunity: exp
        ? {
            recommendedPlan: exp.recommendedPlanLabel,
            mrrGain: exp.mrrGain,
            probability: exp.probability,
          }
        : null,
      nextAction: nextActionForCustomer(c, Boolean(exp)),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totalMrr: founderMetrics.mrr,
    customers,
  };
}
