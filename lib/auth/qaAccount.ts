import type { Plan } from '@/lib/billing/plans';

export type QaSimulatedPlan = 'pro' | 'growth' | 'agency';

export interface QaAccountFlags {
  isQaAccount: boolean;
  qaSimulatedPlan: QaSimulatedPlan;
  qaEnterpriseEnabled: boolean;
}

export interface QaAccountProfileRow {
  is_qa_account?: boolean | null;
  qa_simulated_plan?: string | null;
  qa_enterprise_enabled?: boolean | null;
}

const QA_PLANS = new Set<QaSimulatedPlan>(['pro', 'growth', 'agency']);

export function parseQaSimulatedPlan(raw: string | null | undefined): QaSimulatedPlan {
  if (raw && QA_PLANS.has(raw as QaSimulatedPlan)) {
    return raw as QaSimulatedPlan;
  }
  return 'agency';
}

export function isQaAccountProfile(row: QaAccountProfileRow | null | undefined): boolean {
  return row?.is_qa_account === true;
}

export function qaAccountFlagsFromProfile(
  row: QaAccountProfileRow | null | undefined,
): QaAccountFlags {
  const isQaAccount = isQaAccountProfile(row);
  return {
    isQaAccount,
    qaSimulatedPlan: isQaAccount ? parseQaSimulatedPlan(row?.qa_simulated_plan) : 'agency',
    qaEnterpriseEnabled: isQaAccount && row?.qa_enterprise_enabled === true,
  };
}

/** Apply QA simulation to plan/status fields used for gating (not billing UI). */
export function applyQaPlanOverride<T extends { plan?: string | null; subscription_status?: string | null }>(
  user: T,
  flags: QaAccountFlags,
): T & { isQaAccount?: boolean; qaSimulatedPlan?: QaSimulatedPlan; qaEnterpriseEnabled?: boolean } {
  if (!flags.isQaAccount) return user;
  return {
    ...user,
    isQaAccount: true,
    qaSimulatedPlan: flags.qaSimulatedPlan,
    qaEnterpriseEnabled: flags.qaEnterpriseEnabled,
    plan: flags.qaSimulatedPlan,
    subscription_status: 'active',
  };
}

export function qaEffectivePlan(flags: QaAccountFlags, fallback: Plan): Plan {
  if (!flags.isQaAccount) return fallback;
  return flags.qaSimulatedPlan;
}
