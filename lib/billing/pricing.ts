import { PLAN_LIMITS, type BilledPlan } from './plans';

export const PRICING = {
  pro: {
    name: 'Pro',
    price: 49,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? '',
    websites: PLAN_LIMITS.pro.websites,
    scansPerDay: PLAN_LIMITS.pro.maxScansPerDay,
    scanFrequency: PLAN_LIMITS.pro.scanFrequency,
    interval: 'month' as const,
    features: ['5 websites', 'Weekly scans', 'Email alerts', 'Security scoring'],
  },
  growth: {
    name: 'Growth',
    price: 99,
    stripePriceEnvKey: 'STRIPE_PRICE_GROWTH',
    stripePriceId: process.env.STRIPE_PRICE_GROWTH ?? '',
    websites: PLAN_LIMITS.growth.websites,
    scansPerDay: PLAN_LIMITS.growth.maxScansPerDay,
    scanFrequency: PLAN_LIMITS.growth.scanFrequency,
    interval: 'month' as const,
    features: ['25 websites', 'Daily scans', 'Security scoring', 'Priority queue'],
    mostPopular: true,
  },
  agency: {
    name: 'Agency',
    price: 199,
    stripePriceEnvKey: 'STRIPE_PRICE_AGENCY',
    stripePriceId: process.env.STRIPE_PRICE_AGENCY ?? '',
    websites: PLAN_LIMITS.agency.websites,
    scansPerDay: PLAN_LIMITS.agency.maxScansPerDay,
    scanFrequency: PLAN_LIMITS.agency.scanFrequency,
    interval: 'month' as const,
    features: ['100 websites', 'Hourly monitoring', 'Team access', 'Priority support'],
  },
} as const;

export type { BilledPlan };

export function getPricingPlan(plan: BilledPlan) {
  return PRICING[plan];
}

export function getStripePriceId(plan: BilledPlan): string {
  const priceId = PRICING[plan].stripePriceId;
  if (!priceId) {
    throw new Error(`Missing Stripe price for plan: ${plan}. Set ${PRICING[plan].stripePriceEnvKey} env var.`);
  }
  return priceId;
}
