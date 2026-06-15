/**
 * planService.ts — Server-side plan resolution and limit enforcement.
 *
 * Plan values must match the `profiles.plan` DB constraint:
 *   'free' | 'pro' | 'growth' | 'agency' | 'owner'
 *
 * Paid roles are set by the Stripe webhook only. Owner override is detected by email at runtime.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_LIMITS, type Plan } from './plans';
import { getEffectivePlan, normalizePlan, type UserWithPlan } from '@/lib/auth/permissions';

export type { Plan };

export interface PlanLimits {
  maxWebsites: number;
  maxScansPerDay: number;
  scanFrequency: (typeof PLAN_LIMITS)[Plan]['scanFrequency'];
}

export interface UserProfile {
  plan: string | null;
  email: string | null;
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
 * Fetch plan + email for a user from profiles.
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('plan, email')
      .eq('id', userId)
      .single();

    if (error || !data) return { plan: 'free', email: null };
    return { plan: data.plan ?? 'free', email: data.email ?? null };
  } catch {
    return { plan: 'free', email: null };
  }
}

/**
 * Fetch the effective plan for a user (owner email → agency limits).
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const profile = await getUserProfile(userId);
  return getEffectivePlan(profile);
}

/** Build a UserWithPlan object for permission checks. */
export async function getUserWithPlan(userId: string): Promise<UserWithPlan & { id: string }> {
  const profile = await getUserProfile(userId);
  return {
    id: userId,
    email: profile.email,
    plan: profile.plan,
  };
}

/** Human-readable plan display name. */
export function getPlanDisplayName(plan: Plan): string {
  return PLAN_LIMITS[plan]?.name ?? 'Free';
}

/** Normalize raw DB plan value. */
export { normalizePlan };
