/**
 * Pure plan definitions and limit helpers (no Stripe, no DB).
 */

export type PlanId =
  | 'free'
  | 'starter'
  | 'pro'
  | 'growth'
  | 'agency'
  | 'owner';

export interface Plan {
  id: PlanId;
  name: string;
  websiteLimit: number | null;
  scanFrequency: string;
}

/** Canonical plan catalog — website limits match production PLAN_LIMITS. */
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    websiteLimit: 0,
    scanFrequency: 'manual',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    websiteLimit: 5,
    scanFrequency: 'weekly',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    websiteLimit: 25,
    scanFrequency: 'weekly',
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    websiteLimit: 100,
    scanFrequency: 'daily',
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    websiteLimit: null,
    scanFrequency: 'hourly',
  },
  owner: {
    id: 'owner',
    name: 'Owner',
    websiteLimit: null,
    scanFrequency: 'hourly',
  },
};

const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  starter: 'pro',
  business: 'pro',
};

export function normalizePlanId(raw: string | null | undefined): PlanId {
  if (!raw) return 'free';
  if (raw in LEGACY_PLAN_MAP) return LEGACY_PLAN_MAP[raw];
  if (raw in PLANS) return raw as PlanId;
  return 'free';
}

export function getPlanLimits(planId: string): {
  websiteLimit: number | null;
  scanFrequency: string;
} {
  const id = normalizePlanId(planId);
  const plan = PLANS[id] ?? PLANS.free;
  return {
    websiteLimit: plan.websiteLimit,
    scanFrequency: plan.scanFrequency,
  };
}

export function canAddWebsite(currentCount: number, planId: string): boolean {
  const { websiteLimit } = getPlanLimits(planId);
  if (websiteLimit === null) return true;
  return currentCount < websiteLimit;
}

export function getWebsiteLimitMessage(planId: string, websiteLimit: number): string {
  const id = normalizePlanId(planId);
  const upgrade =
    id === 'free'
      ? 'Pro'
      : id === 'pro' || id === 'starter'
        ? 'Growth'
        : id === 'growth'
          ? 'Agency'
          : null;
  return upgrade
    ? `Upgrade to ${upgrade} to add more websites`
    : `You've reached your website limit (${websiteLimit})`;
}
