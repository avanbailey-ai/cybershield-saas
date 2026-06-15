/**
 * plans.ts — Stripe Price IDs and plan limits (source of truth).
 *
 * Set STRIPE_PRICE_PRO, STRIPE_PRICE_GROWTH, and STRIPE_PRICE_AGENCY in your
 * environment after creating the corresponding products in the Stripe Dashboard.
 */

export const PLAN_LIMITS = {
  free: {
    name: 'Free',
    price: 0,
    websites: 0,
    maxScansPerDay: 0,
    scanFrequency: 'manual' as const,
  },
  pro: {
    name: 'Pro',
    price: 49,
    websites: 25,
    maxScansPerDay: 50,
    scanFrequency: 'weekly' as const,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
  },
  growth: {
    name: 'Growth',
    price: 99,
    websites: 100,
    maxScansPerDay: 200,
    scanFrequency: 'daily' as const,
    stripePriceEnvKey: 'STRIPE_PRICE_GROWTH',
    mostPopular: true,
  },
  agency: {
    name: 'Agency',
    price: 199,
    websites: Infinity,
    maxScansPerDay: 500,
    scanFrequency: 'hourly' as const,
    stripePriceEnvKey: 'STRIPE_PRICE_AGENCY',
  },
  owner: {
    name: 'Owner',
    price: 0,
    websites: Infinity,
    maxScansPerDay: Infinity,
    scanFrequency: 'hourly' as const,
  },
} as const;

export const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  growth: process.env.STRIPE_PRICE_GROWTH ?? '',
  agency: process.env.STRIPE_PRICE_AGENCY ?? '',
} as const;

export type Plan = 'free' | 'pro' | 'growth' | 'agency' | 'owner';
export type BilledPlan = 'pro' | 'growth' | 'agency';

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

export function formatWebsiteLimit(websites: number): string {
  if (websites === Infinity) return 'Unlimited websites';
  return `${websites} website${websites === 1 ? '' : 's'}`;
}

export function formatScanFrequency(frequency: (typeof PLAN_LIMITS)[Plan]['scanFrequency']): string {
  const labels: Record<(typeof PLAN_LIMITS)[Plan]['scanFrequency'], string> = {
    manual: 'Manual scans',
    weekly: 'Weekly scans',
    daily: 'Daily scans',
    hourly: 'Hourly monitoring',
  };
  return labels[frequency];
}
