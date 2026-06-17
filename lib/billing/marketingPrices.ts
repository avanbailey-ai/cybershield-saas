import type { BilledPlan } from './plans';

/** Display-only fallback when Stripe prices are unavailable (billing authority remains Stripe). */
export const MARKETING_FALLBACK_PRICES: Record<BilledPlan, number> = {
  pro: 79,
  growth: 149,
  agency: 299,
};
