import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_LIMITS, type Plan } from './plans';
import { getEffectivePlan, type UserWithPlan } from '@/lib/auth/permissions';

export const PRIORITY_SLOT_LIMIT_MESSAGE =
  "You've reached your 25 priority monitoring slots. Disable priority monitoring on another website or contact us for custom limits.";

export function getPriorityMonitoringSlots(plan: Plan): number {
  if (plan === 'agency') {
    return PLAN_LIMITS.agency.priorityMonitoringSlots ?? 25;
  }
  return 0;
}

/** Agency-tier orgs (including owner entitlement) may use priority slots. */
export function canUsePriorityMonitoring(user: UserWithPlan): boolean {
  return getPriorityMonitoringSlots(getEffectivePlan(user)) > 0;
}

export async function countPriorityMonitoringUsed(
  supabase: SupabaseClient,
  orgId: string | null,
  userId: string,
): Promise<number> {
  let query = supabase
    .from('websites')
    .select('id', { count: 'exact', head: true })
    .eq('priority_monitoring', true);

  if (orgId) {
    query = query.eq('org_id', orgId);
  } else {
    query = query.eq('user_id', userId).is('org_id', null);
  }

  const { count } = await query;
  return count ?? 0;
}

export function isAgencyTierPlan(plan: Plan): boolean {
  return plan === 'agency';
}
