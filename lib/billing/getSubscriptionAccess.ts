import { canAccessDashboard } from '@/lib/auth/permissions';
import { normalizePlan } from '@/lib/auth/permissions';
import { isOwner } from '@/lib/auth/owner';
import type { Plan } from './plans';
import { getUserSubscription, isSubscriptionActive } from './subscriptionService';

export type SubscriptionAccess = {
  plan: Plan;
  status: string;
  isActive: boolean;
  canAccessDashboard: boolean;
};

export type SubscriptionRow = {
  plan?: string | null;
  status?: string | null;
};

const DEFAULT_ACCESS: SubscriptionAccess = {
  plan: 'free',
  status: 'inactive',
  isActive: false,
  canAccessDashboard: false,
};

/** Resolve access from subscription row (subscriptions table is source of truth). */
export function resolveSubscriptionAccess(
  email: string | null | undefined,
  subscription: SubscriptionRow | null,
): SubscriptionAccess {
  if (isOwner(email)) {
    return {
      plan: 'agency',
      status: 'active',
      isActive: true,
      canAccessDashboard: true,
    };
  }

  if (!subscription) {
    return DEFAULT_ACCESS;
  }

  const plan = normalizePlan(subscription.plan);
  const status = subscription.status ?? 'inactive';
  const isActive = isSubscriptionActive(status);
  const userForGate = { email, plan, subscription_status: status };

  return {
    plan,
    status,
    isActive,
    canAccessDashboard: canAccessDashboard(userForGate),
  };
}

/** Server-side access resolution via admin client (subscriptions table only). */
export async function getSubscriptionAccess(
  userId: string,
  email?: string | null,
): Promise<SubscriptionAccess> {
  const subscription = await getUserSubscription(userId);
  return resolveSubscriptionAccess(email, {
    plan: subscription.plan,
    status: subscription.status,
  });
}

export type SessionSubscriptionClient = {
  from: (relation: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: SubscriptionRow | null }>;
      };
    };
  };
};

/** Session-scoped subscription read (middleware, layouts, auth redirects). */
export async function getSubscriptionAccessFromSession(
  supabase: SessionSubscriptionClient,
  userId: string,
  email?: string | null,
): Promise<SubscriptionAccess> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle();

  return resolveSubscriptionAccess(email, sub);
}
