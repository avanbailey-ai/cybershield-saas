import { normalizePlanId, type PlanId } from './plans';

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  growth: 3,
  agency: 4,
  owner: 5,
};

/**
 * Pure: can the user upgrade from currentPlan to targetPlan?
 */
export function canUserUpgrade(currentPlan: string, targetPlan: string): boolean {
  const current = normalizePlanId(currentPlan);
  const target = normalizePlanId(targetPlan);

  if (current === target) return false;
  if (target === 'owner') return false;

  return PLAN_RANK[target] > PLAN_RANK[current];
}
