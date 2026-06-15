import type { BilledPlan } from '@/lib/billing/plans';

const PLACEHOLDER_PATTERNS = ['sk_test_...', 'price_...', 'placeholder', 'your-'] as const;

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern));
}

function readEnv(key: string): string {
  return (process.env[key] ?? '').trim();
}

/** Server/runtime — Stripe secret key (never expose to client). */
export function getStripeSecretKey(): string {
  return readEnv('STRIPE_SECRET_KEY');
}

export function getStripeWebhookSecret(): string {
  return readEnv('STRIPE_WEBHOOK_SECRET');
}

export function getStripePublishableKey(): string {
  return readEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
}

/** Server/runtime — reads price IDs at call time (avoids build-time bake). */
export function getStripePriceIds(): Record<BilledPlan, string> {
  return {
    pro: readEnv('STRIPE_PRICE_PRO'),
    growth: readEnv('STRIPE_PRICE_GROWTH'),
    agency: readEnv('STRIPE_PRICE_AGENCY'),
  };
}

export function getStripePriceId(plan: BilledPlan): string {
  return getStripePriceIds()[plan];
}

export function isStripeConfigured(): boolean {
  const key = getStripeSecretKey();
  if (!key || isPlaceholder(key)) return false;
  return key.startsWith('sk_');
}

/** First missing/invalid Stripe env var for checkout/webhook diagnostics. */
export function getMissingStripeEnv(): string | null {
  if (!isStripeConfigured()) return 'STRIPE_SECRET_KEY';
  return null;
}
