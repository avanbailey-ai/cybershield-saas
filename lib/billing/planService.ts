/**
 * planService.ts — Server-side plan resolution and limit enforcement.
 *
 * Plan values must match the `profiles.plan` DB constraint:
 *   'free' | 'pro' | 'growth' | 'agency'
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_LIMITS, type Plan } from './plans';

export type { Plan };

export interface PlanLimits {
  maxWebsites: number;
  maxScansPerDay: number;
  scanFrequency: (typeof PLAN_LIMITS)[Plan]['scanFrequency'];
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
 * Fetch the current plan for a user from the profiles table.
 * Defaults to 'free' when missing — orchestrator enforces actual subscription tier.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (error || !data?.plan) return 'free';

    const plan = data.plan as string;
    if (plan in PLAN_LIMITS) return plan as Plan;

    if (plan === 'starter' || plan === 'business') return 'pro';

    return 'free';
  } catch {
    return 'free';
  }
}

/** Human-readable plan display name. */
export function getPlanDisplayName(plan: Plan): string {
  const names: Record<Plan, string> = {
    free: 'Free',
    pro: 'Pro',
    growth: 'Growth',
    agency: 'Agency',
  };
  return names[plan] ?? 'Free';
}
