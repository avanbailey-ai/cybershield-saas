import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { isInternalCustomerProfile } from './internalAccountFilters';

export const PAYING_PLAN_IDS = ['pro', 'growth', 'agency'] as const;

export interface PayingCustomerRow {
  userId: string;
  email: string;
  plan: string;
  subscriptionStatus: string;
  mrr: number;
}

export interface FounderCustomerMetrics {
  generatedAt: string;
  payingCustomers: number;
  mrr: number;
  arr: number;
  activeTrials: number;
  customers: PayingCustomerRow[];
}

type ProfileRow = {
  id: string;
  email: string | null;
  plan: string | null;
  subscription_status: string | null;
  is_qa_account?: boolean | null;
};

/** Shared rules for Home, Customers, Success, and business health. */
export function classifyPayingCustomer(
  profile: ProfileRow,
  displayAmounts: Partial<Record<string, number>>,
): { paying: PayingCustomerRow | null; trialing: boolean } {
  if (
    isInternalCustomerProfile({
      email: profile.email,
      is_qa_account: profile.is_qa_account ?? null,
      plan: profile.plan,
    })
  ) {
    return { paying: null, trialing: false };
  }

  const plan = (profile.plan ?? 'free').toLowerCase();
  const status = (profile.subscription_status ?? '').toLowerCase();

  if (plan === 'free' || plan === 'owner') {
    return { paying: null, trialing: false };
  }

  if (status === 'trialing') {
    return { paying: null, trialing: true };
  }

  if (status !== 'active') {
    return { paying: null, trialing: false };
  }

  const mrr = displayAmounts[plan] ?? 0;
  if (mrr <= 0) {
    return { paying: null, trialing: false };
  }

  return {
    paying: {
      userId: profile.id,
      email: profile.email ?? '',
      plan,
      subscriptionStatus: status,
      mrr,
    },
    trialing: false,
  };
}

export async function getFounderCustomerMetrics(): Promise<FounderCustomerMetrics> {
  const admin = createAdminClient();
  const displayAmounts = await getPlanDisplayAmounts();

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, plan, subscription_status, is_qa_account');

  const customers: PayingCustomerRow[] = [];
  let activeTrials = 0;

  for (const row of profiles ?? []) {
    const { paying, trialing } = classifyPayingCustomer(row as ProfileRow, displayAmounts);
    if (paying) customers.push(paying);
    if (trialing) activeTrials++;
  }

  customers.sort((a, b) => b.mrr - a.mrr || a.email.localeCompare(b.email));
  const mrr = customers.reduce((sum, c) => sum + c.mrr, 0);

  return {
    generatedAt: new Date().toISOString(),
    payingCustomers: customers.length,
    mrr,
    arr: mrr * 12,
    activeTrials,
    customers,
  };
}
