/**

 * planService.ts — Server-side plan resolution and limit enforcement.

 *

 * Access gating uses organization_subscriptions (via getUserWithPlan).

 * profiles.plan is metadata/display only.

 */



import { createAdminClient } from '@/lib/supabase/admin';

import { PLAN_LIMITS, type Plan } from './plans';

import { getEffectivePlan, normalizePlan, type UserWithPlan } from '@/lib/auth/permissions';

import { getActiveOrgId } from '@/lib/org/context';

import { getOrgSubscription } from './orgSubscriptionService';



export type { Plan };



export interface PlanLimits {

  maxWebsites: number;

  maxScansPerDay: number;

  scanFrequency: (typeof PLAN_LIMITS)[Plan]['scanFrequency'];

}



export interface UserProfile {

  plan: string | null;

  email: string | null;

  subscription_status: string | null;

  bonus_scans: number;

  pro_unlock_until: string | null;

}



/** Return the limits for a given plan. */

export function getPlanLimits(plan: Plan): PlanLimits {

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  return {

    maxWebsites: limits.websites,

    maxScansPerDay: limits.maxScansPerDay,

    scanFrequency: limits.scanFrequency,

  };

}



/**

 * Fetch profile metadata (plan fields are display-only, not used for gating).

 */

export async function getUserProfile(userId: string): Promise<UserProfile> {

  try {

    const supabase = createAdminClient();

    const { data, error } = await supabase

      .from('profiles')

      .select('plan, email, subscription_status, bonus_scans, pro_unlock_until')

      .eq('id', userId)

      .single();



    if (error || !data) {

      return { plan: 'free', email: null, subscription_status: null, bonus_scans: 0, pro_unlock_until: null };

    }

    return {

      plan: data.plan ?? 'free',

      email: data.email ?? null,

      subscription_status: data.subscription_status ?? null,

      bonus_scans: data.bonus_scans ?? 0,

      pro_unlock_until: data.pro_unlock_until ?? null,

    };

  } catch {

    return { plan: 'free', email: null, subscription_status: null, bonus_scans: 0, pro_unlock_until: null };

  }

}



/** Effective daily scan cap including referral bonus scans and temporary Pro unlock. */

export async function getEffectiveMaxScansPerDay(userId: string, orgId?: string | null): Promise<number> {

  const userWithPlan = await getUserWithPlan(userId, orgId);

  const plan = getEffectivePlan(userWithPlan);

  const baseLimit = getPlanLimits(plan).maxScansPerDay;



  const profile = await getUserProfile(userId);

  let effectiveLimit = baseLimit;



  const proUnlockActive =

    profile.pro_unlock_until !== null && new Date(profile.pro_unlock_until) > new Date();

  if (proUnlockActive && plan === 'free') {

    effectiveLimit = getPlanLimits('pro').maxScansPerDay;

  }



  return effectiveLimit + (profile.bonus_scans ?? 0);

}



/**

 * Fetch the effective plan for a user from their active org subscription.

 */

export async function getUserPlan(userId: string, orgId?: string | null): Promise<Plan> {

  const userWithPlan = await getUserWithPlan(userId, orgId);

  return getEffectivePlan(userWithPlan);

}



/** Build a UserWithPlan object for permission checks (org subscription is source of truth). */

export async function getUserWithPlan(userId: string, orgId?: string | null): Promise<UserWithPlan & { id: string }> {

  const [profile, resolvedOrgId] = await Promise.all([

    getUserProfile(userId),

    orgId !== undefined ? Promise.resolve(orgId) : getActiveOrgId(userId),

  ]);



  if (!resolvedOrgId) {

    return {

      id: userId,

      email: profile.email,

      plan: 'free',

      subscription_status: 'inactive',

    };

  }



  const subscription = await getOrgSubscription(resolvedOrgId);

  return {

    id: userId,

    email: profile.email,

    plan: subscription.plan,

    subscription_status: subscription.status,

  };

}



/** Human-readable plan display name. */

export function getPlanDisplayName(plan: Plan): string {

  return PLAN_LIMITS[plan]?.name ?? 'Free';

}



/** Normalize raw DB plan value. */

export { normalizePlan };

