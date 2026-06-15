import { normalizePlan, type UserWithPlan } from './permissions';
import type { OrgRole } from '@/lib/auth/rbac';
import { isOrgAdminRole } from '@/lib/auth/rbac';
import type { Plan } from '@/lib/billing/plans';

export type Feature =
  | 'dashboard'
  | 'monitoring'
  | 'alerts'
  | 'team'
  | 'unlimited_websites'
  | 'admin';

export type UserForFeatureGate = UserWithPlan & {
  subscription_status?: string | null;
  orgRole?: OrgRole | null;
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  growth: 2,
  agency: 3,
  owner: 4,
};

const FEATURE_MIN_PLAN: Record<Exclude<Feature, 'admin'>, Plan> = {
  dashboard: 'free',
  monitoring: 'pro',
  alerts: 'pro',
  team: 'agency',
  unlimited_websites: 'agency',
};

/** Features available without an active paid subscription. */
const FREE_TIER_FEATURES = new Set<Feature>(['dashboard']);

function hasActiveSubscription(user: UserForFeatureGate): boolean {
  const status = user.subscription_status ?? 'inactive';
  return status === 'active' || status === 'trialing';
}

function effectiveRank(user: UserForFeatureGate): number {
  const plan = normalizePlan(user.plan);
  if (plan === 'owner') return PLAN_RANK.owner;
  return PLAN_RANK[plan] ?? 0;
}

/** Central feature gate — plan + status from organization_subscriptions. */
export function canAccessFeature(user: UserForFeatureGate, feature: Feature): boolean {
  if (feature === 'admin') {
    return user.orgRole != null && isOrgAdminRole(user.orgRole);
  }

  if (feature === 'team' || feature === 'unlimited_websites') {
    if (!user.orgRole || !isOrgAdminRole(user.orgRole)) return false;
  }

  const minPlan = FEATURE_MIN_PLAN[feature];
  const rank = effectiveRank(user);

  if (FREE_TIER_FEATURES.has(feature)) {
    return rank >= PLAN_RANK[minPlan];
  }

  if (!hasActiveSubscription(user)) return false;

  return rank >= PLAN_RANK[minPlan];
}

export function getRequiredPlanForFeature(feature: Feature): Plan | null {
  if (feature === 'admin') return 'owner';
  return FEATURE_MIN_PLAN[feature];
}
