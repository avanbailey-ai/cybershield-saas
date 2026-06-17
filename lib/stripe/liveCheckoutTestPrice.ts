import { getStripe } from '@/lib/stripe/stripe';

export const LIVE_CHECKOUT_TEST_LOOKUP_KEY = 'cybershield_live_checkout_test_pro_1usd';
export const LIVE_CHECKOUT_TEST_PRODUCT_NAME = 'CyberShield Live Checkout Test (Internal)';

/**
 * Resolve or create the internal $1/month live checkout test price in Stripe.
 */
export async function getOrCreateLiveCheckoutTestPriceId(): Promise<string> {
  const stripe = getStripe();

  const existing = await stripe.prices.list({
    lookup_keys: [LIVE_CHECKOUT_TEST_LOOKUP_KEY],
    limit: 1,
  });

  if (existing.data[0]?.id) {
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name: LIVE_CHECKOUT_TEST_PRODUCT_NAME,
    metadata: { internal: 'true', purpose: 'live_checkout_test' },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 100,
    currency: 'usd',
    recurring: { interval: 'month' },
    lookup_key: LIVE_CHECKOUT_TEST_LOOKUP_KEY,
    metadata: { plan: 'pro', liveCheckoutTest: 'true' },
  });

  return price.id;
}
