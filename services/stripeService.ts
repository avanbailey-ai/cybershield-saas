import { getStripe } from '@/lib/stripe/stripe';
import { isStripeConfigured } from '@/lib/stripe/env';

export const stripeService = {
  isConfigured: () => isStripeConfigured(),
  getStripe: () => {
    if (!isStripeConfigured()) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    return getStripe();
  },
};
