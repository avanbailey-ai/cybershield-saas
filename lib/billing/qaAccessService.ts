import { createAdminClient } from '@/lib/supabase/admin';
import {
  applyQaPlanOverride,
  qaAccountFlagsFromProfile,
  type QaAccountFlags,
  type QaAccountProfileRow,
} from '@/lib/auth/qaAccount';
import type { SubscriptionAccess } from '@/lib/billing/getSubscriptionAccess';
import type { UserWithPlan } from '@/lib/auth/permissions';

export async function fetchQaAccountFlags(userId: string): Promise<QaAccountFlags> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('profiles')
      .select('is_qa_account, qa_simulated_plan')
      .eq('id', userId)
      .maybeSingle();

    return qaAccountFlagsFromProfile(data as QaAccountProfileRow | null);
  } catch {
    return { isQaAccount: false, qaSimulatedPlan: 'agency' };
  }
}

export function applyQaSubscriptionAccess(
  access: SubscriptionAccess,
  flags: QaAccountFlags,
): SubscriptionAccess {
  if (!flags.isQaAccount) return access;
  return {
    ...access,
    plan: flags.qaSimulatedPlan,
    status: 'active',
    isActive: true,
    canAccessDashboard: true,
  };
}

export function applyQaUserWithPlan<T extends UserWithPlan & { id?: string }>(
  user: T,
  flags: QaAccountFlags,
): T & { isQaAccount?: boolean; qaSimulatedPlan?: QaAccountFlags['qaSimulatedPlan'] } {
  return applyQaPlanOverride(user, flags);
}
