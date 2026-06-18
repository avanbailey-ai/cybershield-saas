import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { PLAN_LIMITS, type Plan } from '@/lib/billing/plans';
import { isInternalCustomerEmail } from './founderCustomerFilters';

export type ExpansionProbability = 'High' | 'Medium' | 'Low';

export interface ExpansionOpportunity {
  userId: string;
  email: string;
  currentPlan: string;
  currentPlanLabel: string;
  recommendedPlan: string;
  recommendedPlanLabel: string;
  currentMrr: number;
  targetMrr: number;
  mrrGain: number;
  probability: ExpansionProbability;
  reasoning: string[];
  signals: string[];
  websiteCount: number;
}

export interface CustomerExpansionSummary {
  generatedAt: string;
  opportunities: ExpansionOpportunity[];
  totalPotentialMrr: number;
  highProbability: number;
}

const PLAN_LABELS: Record<string, string> = {
  pro: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
  enterprise: 'Enterprise',
};

const UPGRADE_PATHS: { from: string; to: string; minSites: number; minScans30d: number }[] = [
  { from: 'pro', to: 'growth', minSites: 7, minScans30d: 5 },
  { from: 'growth', to: 'agency', minSites: 35, minScans30d: 10 },
  { from: 'agency', to: 'enterprise', minSites: 180, minScans30d: 20 },
];

const ENTERPRISE_MRR = 499;

function planLabel(plan: string): string {
  return PLAN_LABELS[plan] ?? plan;
}

function probability(
  siteCount: number,
  minSites: number,
  scans30d: number,
  minScans: number,
  loginDays: number,
): ExpansionProbability {
  let pts = 0;
  if (siteCount >= minSites) pts += 2;
  if (siteCount >= minSites * 1.2) pts += 1;
  if (scans30d >= minScans) pts += 2;
  if (loginDays <= 14) pts += 1;
  if (pts >= 5) return 'High';
  if (pts >= 3) return 'Medium';
  return 'Low';
}

export async function getCustomerExpansion(): Promise<CustomerExpansionSummary> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [profilesRes, websitesRes, scansRes, displayAmounts] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, plan, subscription_status, last_active_at, updated_at')
      .eq('subscription_status', 'active')
      .in('plan', ['pro', 'growth', 'agency']),
    admin.from('websites').select('user_id'),
    admin.from('scans').select('user_id').gte('created_at', thirtyDaysAgo),
    getPlanDisplayAmounts(),
  ]);

  const websitesByUser = new Map<string, number>();
  for (const w of websitesRes.data ?? []) {
    const uid = w.user_id as string;
    websitesByUser.set(uid, (websitesByUser.get(uid) ?? 0) + 1);
  }

  const scansByUser = new Map<string, number>();
  for (const s of scansRes.data ?? []) {
    const uid = s.user_id as string;
    scansByUser.set(uid, (scansByUser.get(uid) ?? 0) + 1);
  }

  const opportunities: ExpansionOpportunity[] = [];

  for (const p of profilesRes.data ?? []) {
    const email = (p.email as string) ?? '';
    if (isInternalCustomerEmail(email)) continue;

    const userId = p.id as string;
    const plan = (p.plan as string) ?? 'pro';
    const siteCount = websitesByUser.get(userId) ?? 0;
    const scans30d = scansByUser.get(userId) ?? 0;
    const lastActive = (p.last_active_at as string) ?? (p.updated_at as string);
    const loginDays = lastActive
      ? Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000)
      : 999;

    const path = UPGRADE_PATHS.find((u) => u.from === plan);
    if (!path) continue;

    const limit = PLAN_LIMITS[plan as Plan]?.websites ?? 10;
    const nearLimit = limit !== Infinity && siteCount >= limit * 0.75;
    const highEngagement = scans30d >= path.minScans30d || loginDays <= 7;

    if (!nearLimit && siteCount < path.minSites && !highEngagement) continue;

    const currentMrr = displayAmounts[plan as keyof typeof displayAmounts] ?? 0;
    const targetMrr =
      path.to === 'enterprise'
        ? ENTERPRISE_MRR
        : (displayAmounts[path.to as keyof typeof displayAmounts] ?? 0);
    const mrrGain = Math.max(0, targetMrr - currentMrr);
    if (mrrGain <= 0) continue;

    const signals: string[] = [];
    if (nearLimit) signals.push(`At ${siteCount}/${limit} website limit`);
    if (siteCount >= path.minSites) signals.push(`${siteCount} websites monitored`);
    if (scans30d >= path.minScans30d) signals.push(`${scans30d} scans in 30 days`);
    if (loginDays <= 14) signals.push('Frequent logins');

    const reasoning = [
      `${planLabel(plan)} → ${planLabel(path.to)} upgrade path`,
      nearLimit
        ? 'Approaching plan website limit'
        : 'High product engagement signals upgrade readiness',
      `+$${mrrGain}/mo MRR opportunity`,
    ];

    opportunities.push({
      userId,
      email,
      currentPlan: plan,
      currentPlanLabel: planLabel(plan),
      recommendedPlan: path.to,
      recommendedPlanLabel: planLabel(path.to),
      currentMrr,
      targetMrr,
      mrrGain,
      probability: probability(siteCount, path.minSites, scans30d, path.minScans30d, loginDays),
      reasoning,
      signals,
      websiteCount: siteCount,
    });
  }

  opportunities.sort((a, b) => {
    const probOrder = { High: 0, Medium: 1, Low: 2 };
    const pd = probOrder[a.probability] - probOrder[b.probability];
    if (pd !== 0) return pd;
    return b.mrrGain - a.mrrGain;
  });

  return {
    generatedAt: new Date().toISOString(),
    opportunities,
    totalPotentialMrr: opportunities.reduce((s, o) => s + o.mrrGain, 0),
    highProbability: opportunities.filter((o) => o.probability === 'High').length,
  };
}
