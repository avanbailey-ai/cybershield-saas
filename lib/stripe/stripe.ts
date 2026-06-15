import Stripe from 'stripe';
import { getStripeSecretKey, isStripeConfigured } from './env';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!isStripeConfigured()) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(getStripeSecretKey(), {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
    });
  }
  return _stripe;
}
