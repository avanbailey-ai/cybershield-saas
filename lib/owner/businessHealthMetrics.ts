import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { isInternalCustomerEmail } from './founderCustomerFilters';
import { getRevenueAtRisk } from './revenueAtRisk';

const DEFAULT_MRR_GOAL = 1000;
const MS_DAY = 86400000;

export interface MetricCalculationMeta {
  generatedAt: string;
  mrr: {
    value: number;
    includedPlans: string[];
    excludedAccounts: string[];
    rules: string[];
  };
  conversion: {
    value: number;
    newSignups: number;
    upgradedInWindow: number;
    windowDays: number;
    rules: string[];
  };
}

export interface BusinessHealthMetrics {
  mrr: number;
  arr: number;
  payingCustomers: number;
  activeTrials: number;
  newSignups30d: number;
  conversionRate: number;
  churnRisk: 'Low' | 'Medium' | 'High';
  churnRiskCount: number;
  revenueAtRisk: number;
  mrrGoal: number;
  goalProgressPct: number;
  daysToGoal: number | null;
  calculation: MetricCalculationMeta;
}

function daysToReachGoal(current: number, goal: number, dailyPace: number): number | null {
  if (current >= goal || dailyPace <= 0) return null;
  return Math.ceil((goal - current) / dailyPace);
}

export async function getBusinessHealthMetrics(): Promise<BusinessHealthMetrics> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_DAY).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_DAY).toISOString();

  const [profilesRes, goalRes, displayAmounts, revenueAtRisk] = await Promise.all([
    admin.from('profiles').select(
      'id, email, plan, subscription_status, churn_risk_score, created_at, updated_at',
    ),
    admin
      .from('owner_founder_settings')
      .select('value')
      .eq('key', 'mrr_goal')
      .maybeSingle(),
    getPlanDisplayAmounts(),
    getRevenueAtRisk(),
  ]);

  const profiles = profilesRes.data ?? [];
  const excludedAccounts: string[] = [];
  const includedPlans = ['pro', 'growth', 'agency'];

  let mrr = 0;
  let payingCustomers = 0;
  let activeTrials = 0;
  let churnRiskCount = 0;
  let newSignups30d = 0;
  let upgradedInWindow = 0;

  for (const p of profiles) {
    const email = (p.email as string) ?? '';
    if (isInternalCustomerEmail(email)) {
      excludedAccounts.push(email);
      continue;
    }

    const status = p.subscription_status as string;
    const plan = (p.plan as string) ?? 'free';

    if (status === 'trialing') activeTrials++;

    if (
      (status === 'active' || status === 'trialing') &&
      plan !== 'free' &&
      plan !== 'owner'
    ) {
      const price = displayAmounts[plan as keyof typeof displayAmounts] ?? 0;
      if (status === 'active' && price > 0) {
        mrr += price;
        payingCustomers++;
      }
    }

    if ((p.churn_risk_score ?? 0) > 70) churnRiskCount++;

    const created = p.created_at as string | undefined;
    if (created && created >= thirtyDaysAgo) {
      newSignups30d++;
      if (
        includedPlans.includes(plan) &&
        (status === 'active' || status === 'trialing')
      ) {
        upgradedInWindow++;
      }
    }
  }

  const mrrGoal =
    typeof goalRes.data?.value === 'object' &&
    goalRes.data?.value &&
    'amount' in (goalRes.data.value as object)
      ? Number((goalRes.data.value as { amount: number }).amount)
      : DEFAULT_MRR_GOAL;

  const goalProgressPct =
    mrrGoal > 0 ? Math.min(100, Math.round((mrr / mrrGoal) * 100)) : 0;

  const mrr7dAgoEstimate = mrr;
  const dailyPace = mrr7dAgoEstimate > 0 ? (mrr - mrr7dAgoEstimate) / 7 : 0;
  const daysToGoal = daysToReachGoal(mrr, mrrGoal, dailyPace > 0 ? dailyPace : 0);

  const conversionRate =
    newSignups30d > 0
      ? Math.round((upgradedInWindow / newSignups30d) * 1000) / 10
      : 0;

  const churnRisk: 'Low' | 'Medium' | 'High' =
    churnRiskCount >= 5 ? 'High' : churnRiskCount >= 2 ? 'Medium' : 'Low';

  const generatedAt = new Date().toISOString();

  return {
    mrr,
    arr: mrr * 12,
    payingCustomers,
    activeTrials,
    newSignups30d,
    conversionRate,
    churnRisk,
    churnRiskCount,
    revenueAtRisk: revenueAtRisk.totalMrrAtRisk,
    mrrGoal,
    goalProgressPct,
    daysToGoal,
    calculation: {
      generatedAt,
      mrr: {
        value: mrr,
        includedPlans,
        excludedAccounts: excludedAccounts.slice(0, 20),
        rules: [
          'Counts active paid subscriptions only (trialing excluded from MRR total).',
          'Uses Stripe display prices from getPlanDisplayAmounts().',
          'Excludes owner plan, free plan, and internal/test emails via founderCustomerFilters.',
          'Owner email, test@gmail.com, +test@, stripe-preview-test, and disposable domains excluded.',
        ],
      },
      conversion: {
        value: conversionRate,
        newSignups: newSignups30d,
        upgradedInWindow,
        windowDays: 30,
        rules: [
          'Conversion = paid plan upgrades ÷ new signups in last 30 days.',
          'Test/internal accounts excluded from both numerator and denominator.',
          'Paid plans: pro (Starter), growth, agency.',
        ],
      },
    },
  };
}
