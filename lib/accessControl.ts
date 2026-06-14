export type UserPlan = 'free' | 'pro' | 'business' | 'agency';

export interface GatedReport {
  canViewFull: boolean;
  genericMessage: string;
  plan: UserPlan;
}

export function gateReport(riskScore: number, plan: UserPlan): GatedReport {
  const canViewFull = plan !== 'free';
  const genericMessage = riskScore > 40
    ? 'Risk Detected — upgrade to see full details'
    : 'No major issues found — upgrade for continuous monitoring';

  return { canViewFull, genericMessage, plan };
}

export function isPaidPlan(plan: UserPlan): boolean {
  return plan !== 'free';
}
