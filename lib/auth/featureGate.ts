import { isOwner } from './owner';
import { normalizePlan, type UserWithPlan } from './permissions';
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
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  growth: 2,
  agency: 3,
  owner: 4,
};

const FEATURE_MIN_PLAN: Record<Exclude<Feature, 'admin'>, Plan> = {
  dashboard: 'pro',
  monitoring: 'growth',
  alerts: 'growth',
  team: 'agency',
  unlimited_websites: 'agency',
};

function hasActiveSubscription(user: UserForFeatureGate): boolean {
  const status = user.subscription_status ?? 'inactive';
  return status === 'active' || status === 'trialing';
}

function effectiveRank(user: UserForFeatureGate): number {
  if (isOwner(user.email)) return PLAN_RANK.owner;
  const plan = normalizePlan(user.plan);
  if (plan === 'owner') return PLAN_RANK.owner;
  return PLAN_RANK[plan] ?? 0;
}

/** Central feature gate — plan + status from subscriptions table only. */
export function canAccessFeature(user: UserForFeatureGate, feature: Feature): boolean {
  if (isOwner(user.email)) return true;

  if (feature === 'admin') return false;

  if (!hasActiveSubscription(user)) return false;

  const minPlan = FEATURE_MIN_PLAN[feature];
  return effectiveRank(user) >= PLAN_RANK[minPlan];
}

export function getRequiredPlanForFeature(feature: Feature): Plan | null {
  if (feature === 'admin') return 'owner';
  return FEATURE_MIN_PLAN[feature];
}
