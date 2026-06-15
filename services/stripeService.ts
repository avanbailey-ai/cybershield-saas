import { getStripe } from '@/lib/stripe/stripe';

export const stripeService = {
  isConfigured: () => !!process.env.STRIPE_SECRET_KEY,
  getStripe: () => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    return getStripe();
  },
};
