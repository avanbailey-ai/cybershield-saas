/**
 * plans.ts — Stripe Price IDs for paid plans.
 *
 * Set STRIPE_PRICE_PRO and STRIPE_PRICE_AGENCY in your environment after
 * creating the corresponding products in the Stripe Dashboard.
 *
 * These are the only two plans that map to Stripe subscriptions. 'free' and
 * 'business' do not have Stripe price IDs.
 */

export const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  agency: process.env.STRIPE_PRICE_AGENCY ?? '',
} as const;

export type BilledPlan = 'pro' | 'agency';

export const BILLED_PLANS: BilledPlan[] = ['pro', 'agency'];

export function isBilledPlan(plan: string): plan is BilledPlan {
  return BILLED_PLANS.includes(plan as BilledPlan);
}
