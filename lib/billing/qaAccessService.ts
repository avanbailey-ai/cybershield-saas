import { createAdminClient } from '@/lib/supabase/admin';
import {
  applyQaPlanOverride,
  qaAccountFlagsFromProfile,
  type QaAccountFlags,
  type QaAccountProfileRow,
} from '@/lib/auth/qaAccount';
import type { SubscriptionAccess } from '@/lib/billing/getSubscriptionAccess';
import type { UserWithPlan } from '@/lib/auth/permissions';

const QA_PROFILE_COLUMNS = 'is_qa_account, qa_simulated_plan, qa_enterprise_enabled';

export type QaProfileReader = {
  from: (relation: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: QaAccountProfileRow | null }>;
      };
    };
  };
};

async function readQaFlagsFromClient(
  client: QaProfileReader,
  userId: string,
): Promise<QaAccountFlags | null> {
  try {
    const { data } = await client
      .from('profiles')
      .select(QA_PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    return qaAccountFlagsFromProfile(data as QaAccountProfileRow | null);
  } catch {
    return null;
  }
}

/** Prefer session client (RLS) in middleware; admin fallback for server jobs. */
export async function fetchQaAccountFlags(
  userId: string,
  sessionClient?: QaProfileReader,
): Promise<QaAccountFlags> {
  const empty: QaAccountFlags = {
    isQaAccount: false,
    qaSimulatedPlan: 'agency',
    qaEnterpriseEnabled: false,
  };

  if (sessionClient) {
    const fromSession = await readQaFlagsFromClient(sessionClient, userId);
    if (fromSession) return fromSession;
  }

  try {
    const supabase = createAdminClient();
    const fromAdmin = await readQaFlagsFromClient(supabase as unknown as QaProfileReader, userId);
    return fromAdmin ?? empty;
  } catch {
    return empty;
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
    isQaAccount: true,
    qaSimulatedPlan: flags.qaSimulatedPlan,
    qaEnterpriseEnabled: flags.qaEnterpriseEnabled,
  };
}

export function applyQaUserWithPlan<T extends UserWithPlan & { id?: string }>(
  user: T,
  flags: QaAccountFlags,
): T & { isQaAccount?: boolean; qaSimulatedPlan?: QaAccountFlags['qaSimulatedPlan']; qaEnterpriseEnabled?: boolean } {
  return applyQaPlanOverride(user, flags);
}
