/**
 * plans.ts — Plan limits and feature metadata (NOT billing prices).
 *
 * Billing authority: Stripe price IDs via env vars below.
 * Display amounts: fetched from Stripe via lib/billing/stripeDisplayPrices.ts
 */

export const PLAN_LIMITS = {
  free: {
    name: 'Free',
    websites: 0,
    maxScansPerDay: 1,
    maxScansPerWebsite: 1,
    scanFrequency: 'manual' as const,
  },
  pro: {
    name: 'Pro',
    websites: 25,
    maxScansPerDay: 50,
    scanFrequency: 'weekly' as const,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
  },
  growth: {
    name: 'Growth',
    websites: 100,
    maxScansPerDay: 200,
    scanFrequency: 'daily' as const,
    stripePriceEnvKey: 'STRIPE_PRICE_GROWTH',
    mostPopular: true,
  },
  agency: {
    name: 'Agency',
    websites: Infinity,
    maxScansPerDay: 500,
    scanFrequency: 'hourly' as const,
    stripePriceEnvKey: 'STRIPE_PRICE_AGENCY',
  },
  owner: {
    name: 'Owner',
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

/** Queue priority for claim_scan_jobs (higher = claimed first). */
export function getPlanQueuePriority(plan: Plan): number {
  switch (plan) {
    case 'agency':
    case 'owner':
      return 3;
    case 'growth':
      return 2;
    case 'pro':
      return 1;
    default:
      return 0;
  }
}
