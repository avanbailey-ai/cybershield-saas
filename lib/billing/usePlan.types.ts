import type { Plan } from './plans';
import { PLAN_LIMITS } from './plans';

export interface PlanInfo {
  plan: Plan;
  limits: (typeof PLAN_LIMITS)[Plan];
  websiteCount: number;
  scansToday: number;
  websitesRemaining: number;
  scansRemaining: number;
  effectiveScansLimit: number;
  loading: boolean;
}
