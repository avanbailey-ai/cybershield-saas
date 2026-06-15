'use client';

import type { PlanInfo } from './usePlan.types';
export type { PlanInfo } from './usePlan.types';

import { useUser } from '@/lib/auth/useUser';

/** @deprecated Prefer useUser() — kept for backward compatibility. */
export function usePlan(): PlanInfo {
  const user = useUser();
  return {
    plan: user.plan,
    limits: user.limits,
    websiteCount: user.websiteCount,
    scansToday: user.scansToday,
    websitesRemaining: user.websitesRemaining ?? 0,
    scansRemaining: user.scansRemaining,
    effectiveScansLimit: user.effectiveScansLimit,
    loading: user.loading,
  };
}
