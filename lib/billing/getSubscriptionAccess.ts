import { canAccessDashboard } from '@/lib/auth/permissions';
import { normalizePlan } from '@/lib/auth/permissions';
import { isOwner } from '@/lib/auth/owner';
import type { Plan } from './plans';
import { getActiveOrgId } from '@/lib/org/context';
import { getOrgSubscription } from './orgSubscriptionService';
import { isSubscriptionActive } from './subscriptionService';

export type SubscriptionAccess = {
  plan: Plan;
  status: string;
  isActive: boolean;
  canAccessDashboard: boolean;
  orgId?: string | null;
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

/** Resolve access from org subscription row (organization_subscriptions is source of truth). */
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

/** Server-side org subscription access (primary gating path). */
export async function getSubscriptionAccess(
  userId: string,
  email?: string | null,
  orgId?: string | null,
): Promise<SubscriptionAccess> {
  const resolvedOrgId = orgId ?? (await getActiveOrgId(userId));
  if (!resolvedOrgId) {
    return resolveSubscriptionAccess(email, null);
  }

  const subscription = await getOrgSubscription(resolvedOrgId);
  return {
    ...resolveSubscriptionAccess(email, {
      plan: subscription.plan,
      status: subscription.status,
    }),
    orgId: resolvedOrgId,
  };
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

/**
 * Session-scoped org subscription read (middleware, layouts).
 * Falls back to organization_subscriptions via admin when session client lacks table access.
 */
export async function getSubscriptionAccessFromSession(
  supabase: SessionSubscriptionClient,
  userId: string,
  email?: string | null,
  orgId?: string | null,
): Promise<SubscriptionAccess> {
  const { resolveOrgSessionContextFromSession } = await import('@/lib/org/sessionContext');
  const ctx = await resolveOrgSessionContextFromSession(supabase, userId, email, orgId);
  return { ...ctx.access, orgId: ctx.orgId };
}
