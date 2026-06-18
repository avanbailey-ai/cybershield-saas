import { isOwner } from '@/lib/auth/owner';

export type UserPlan = 'free' | 'pro' | 'growth' | 'agency' | 'owner';

export interface GatedReport {
  canViewFull: boolean;
  genericMessage: string;
  plan: UserPlan;
}

export function gateReport(
  riskScore: number,
  plan: UserPlan,
  email?: string | null,
  subscriptionStatus?: string | null,
  isQaAccount?: boolean,
): GatedReport {
  const hasActivePaid =
    isQaAccount === true ||
    (plan !== 'free' && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing'));
  const canViewFull = isOwner(email) || hasActivePaid;
  const genericMessage = riskScore > 40
    ? 'Risk Detected — upgrade to see full details'
    : 'No major issues found — upgrade for continuous monitoring';

  return { canViewFull, genericMessage, plan };
}

export function isPaidPlan(plan: UserPlan, email?: string | null): boolean {
  if (isOwner(email)) return true;
  return plan !== 'free';
}
