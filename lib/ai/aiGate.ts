import type { Plan } from '@/lib/billing/plans';
import { isWithinAiQuota, PLAN_AI_DAILY_LIMITS } from './usageLimiter';
import type { AiChangeSignal } from './changeDetection';

export type AiGateDecision =
  | { allowed: true; reason: 'change_detected' | 'quota_available' }
  | { allowed: false; reason: 'no_change' | 'plan_disabled' | 'quota_exceeded' | 'no_user' };

/** Gate OpenAI calls: requires change detection + plan quota. */
export function evaluateAiGate(params: {
  plan: Plan;
  changeSignal: AiChangeSignal;
  dailyUsage: number;
  userId: string | null;
}): AiGateDecision {
  const { plan, changeSignal, dailyUsage, userId } = params;
  const limit = PLAN_AI_DAILY_LIMITS[plan];

  if (limit === 0) {
    return { allowed: false, reason: 'plan_disabled' };
  }

  if (!userId) {
    return { allowed: false, reason: 'no_user' };
  }

  if (!changeSignal.changeDetected) {
    return { allowed: false, reason: 'no_change' };
  }

  if (!isWithinAiQuota(plan, dailyUsage)) {
    return { allowed: false, reason: 'quota_exceeded' };
  }

  return { allowed: true, reason: 'change_detected' };
}
