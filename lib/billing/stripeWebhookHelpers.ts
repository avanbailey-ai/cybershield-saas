import type Stripe from 'stripe';

/** Internal subscription status stored in subscriptions + profiles.subscription_status. */
export type InternalSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'inactive';

/** Map Stripe subscription.status to internal status values. */
export function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
): InternalSubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    case 'unpaid':
      return 'past_due';
    case 'paused':
      return 'inactive';
    default:
      return 'inactive';
  }
}

/** True when a paid plan should be revoked (terminal / non-entitled states). */
export function shouldDowngradePlanFromStatus(status: InternalSubscriptionStatus): boolean {
  return status === 'canceled' || status === 'incomplete' || status === 'inactive';
}

/** Resolve Stripe price ID from an invoice line (API-version tolerant). */
export function priceIdFromInvoiceLine(line: Stripe.InvoiceLineItem | undefined): string | null {
  if (!line) return null;

  const pricingPrice = (line as { pricing?: { price_details?: { price?: string | { id?: string } } } })
    .pricing?.price_details?.price;
  if (typeof pricingPrice === 'string') return pricingPrice;
  if (pricingPrice && typeof pricingPrice === 'object' && 'id' in pricingPrice && pricingPrice.id) {
    return pricingPrice.id;
  }

  const legacyPrice = (line as { price?: string | { id?: string } | null }).price;
  if (typeof legacyPrice === 'string') return legacyPrice;
  if (legacyPrice && typeof legacyPrice === 'object' && 'id' in legacyPrice && legacyPrice.id) {
    return legacyPrice.id;
  }

  return null;
}

export function periodEndFromSubscription(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  const end = item?.current_period_end;
  if (!end) return null;
  return new Date(end * 1000).toISOString();
}
