/** Seat limits per org plan (enterprise billing). */

export type OrgPlan = 'free' | 'pro' | 'growth' | 'agency' | 'enterprise';

export const ORG_SEAT_LIMITS: Record<OrgPlan, number> = {
  free: 1,
  pro: 5,
  growth: 25,
  agency: 100,
  enterprise: Infinity,
};

export function getSeatLimitForPlan(plan: string): number {
  if (plan in ORG_SEAT_LIMITS) {
    return ORG_SEAT_LIMITS[plan as OrgPlan];
  }
  return ORG_SEAT_LIMITS.free;
}

/** Per-org hourly scan rate limit (enterprise queue throttling). */
export const ORG_HOURLY_SCAN_LIMIT: Record<OrgPlan, number> = {
  free: 10,
  pro: 50,
  growth: 200,
  agency: 500,
  enterprise: 2000,
};

export function getOrgHourlyScanLimit(plan: string): number {
  if (plan in ORG_HOURLY_SCAN_LIMIT) {
    return ORG_HOURLY_SCAN_LIMIT[plan as OrgPlan];
  }
  return ORG_HOURLY_SCAN_LIMIT.free;
}
