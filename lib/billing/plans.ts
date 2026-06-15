/**
 * plans.ts — Stripe Price IDs and plan limits (source of truth).
 *
 * Set STRIPE_PRICE_PRO, STRIPE_PRICE_GROWTH, and STRIPE_PRICE_AGENCY in your
 * environment after creating the corresponding products in the Stripe Dashboard.
 */

export const PLAN_LIMITS = {
  free: {
    websites: 1,
    scanFrequency: 'manual' as const,
    maxScansPerDay: 3,
  },
  pro: {
    websites: 5,
    scanFrequency: 'weekly' as const,
    maxScansPerDay: 1,
  },
  growth: {
    websites: 25,
    scanFrequency: 'daily' as const,
    maxScansPerDay: 5,
  },
  agency: {
    websites: 100,
    scanFrequency: 'hourly' as const,
    maxScansPerDay: 50,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
export type BilledPlan = 'pro' | 'growth' | 'agency';

export const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  growth: process.env.STRIPE_PRICE_GROWTH ?? '',
  agency: process.env.STRIPE_PRICE_AGENCY ?? '',
} as const;

export const BILLED_PLANS: BilledPlan[] = ['pro', 'growth', 'agency'];

export function isBilledPlan(plan: string): plan is BilledPlan {
  return BILLED_PLANS.includes(plan as BilledPlan);
}

export function getPriceId(plan: BilledPlan): string {
  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    throw new Error(`Missing Stripe price for plan: ${plan}. Set STRIPE_PRICE_${plan.toUpperCase()} env var.`);
  }
  return priceId;
}

/** Map a Stripe price ID back to a billed plan, if configured. */
export function planFromPriceId(priceId: string): BilledPlan | null {
  for (const plan of BILLED_PLANS) {
    const id = STRIPE_PRICE_IDS[plan];
    if (id && id === priceId) return plan;
  }
  return null;
}
