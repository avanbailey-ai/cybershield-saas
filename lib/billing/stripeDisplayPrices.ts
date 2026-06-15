import { getStripe } from '@/lib/stripe/stripe';
import { isStripeConfigured, getStripePriceIds } from '@/lib/stripe/env';
import { BILLED_PLANS, type BilledPlan } from './plans';

export { formatDisplayPrice, formatDisplayPriceMonthly } from './formatPrice';

type PriceCache = {
  amounts: Partial<Record<BilledPlan, number>>;
  fetchedAt: number;
};

let cache: PriceCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Fetch display amounts (USD/mo) from Stripe — billing authority is Stripe, not these numbers. */
export async function getPlanDisplayAmounts(): Promise<Partial<Record<BilledPlan, number>>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.amounts;
  }

  const amounts: Partial<Record<BilledPlan, number>> = {};

  if (!isStripeConfigured()) {
    return amounts;
  }

  try {
    const stripe = getStripe();
    const priceIds = getStripePriceIds();
    for (const plan of BILLED_PLANS) {
      const priceId = priceIds[plan];
      if (!priceId) continue;
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (price.unit_amount != null) {
          amounts[plan] = price.unit_amount / 100;
        }
      } catch (err) {
        console.error(`[stripeDisplayPrices] failed to fetch ${plan}:`, err);
      }
    }
    cache = { amounts, fetchedAt: Date.now() };
  } catch (err) {
    console.error('[stripeDisplayPrices] fetch failed:', err);
  }

  return amounts;
}
