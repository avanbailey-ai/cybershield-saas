/**
 * planService.ts — Plan definitions and limit enforcement.
 *
 * Source of truth for what each plan is allowed to do.
 * Intentionally standalone — does not import from lib/plans.ts to keep
 * billing logic isolated and free of marketing-copy concerns.
 *
 * Plan values must match the `profiles.plan` DB constraint:
 *   'free' | 'pro' | 'business' | 'agency'
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ---- Types ----------------------------------------------------------------

/** All plan values that can appear in the `profiles.plan` column. */
export type Plan = 'free' | 'pro' | 'business' | 'agency';

export interface PlanLimits {
  /** Maximum number of active websites the user can add. Infinity = unlimited. */
  maxWebsites: number;
  /** Maximum number of scans the user can trigger in a single calendar day. */
  maxScansPerDay: number;
}

// ---- Limits table ---------------------------------------------------------

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free:     { maxWebsites: 1,        maxScansPerDay: 3   },
  pro:      { maxWebsites: 25,       maxScansPerDay: 50  },
  business: { maxWebsites: 10,       maxScansPerDay: 30  },
  agency:   { maxWebsites: Infinity, maxScansPerDay: 200 },
};

// ---- Helpers ---------------------------------------------------------------

/**
 * Fetch the current plan for a user from the profiles table.
 * Defaults to 'free' on any error — billing logic should NEVER throw.
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
    // Guard against unknown values stored in DB (e.g. 'starter', 'business' alias etc.)
    if (plan in PLAN_LIMITS) return plan as Plan;

    // Known aliases / legacy values
    if (plan === 'starter') return 'pro';

    return 'free';
  } catch {
    return 'free';
  }
}

/** Return the limits for a given plan. */
export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/** Human-readable plan display name. */
export function getPlanDisplayName(plan: Plan): string {
  const names: Record<Plan, string> = {
    free:     'Free',
    pro:      'Pro',
    business: 'Business',
    agency:   'Agency',
  };
  return names[plan] ?? 'Free';
}
