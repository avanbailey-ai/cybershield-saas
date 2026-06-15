/**
 * Required environment variables for production billing + auth.
 * Call from server startup or health checks — logs warnings, never throws.
 */

const REQUIRED_SERVER = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_GROWTH',
  'STRIPE_PRICE_AGENCY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const REQUIRED_PUBLIC = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
] as const;

const LOCALHOST_PATTERNS = [/localhost/i, /127\.0\.0\.1/];

export type EnvValidationResult = {
  missing: string[];
  localhostUrls: { key: string; value: string }[];
  invalidPriceIds: string[];
};

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const localhostUrls: { key: string; value: string }[] = [];
  const invalidPriceIds: string[] = [];

  for (const key of [...REQUIRED_SERVER, ...REQUIRED_PUBLIC]) {
    if (!process.env[key]) missing.push(key);
  }

  for (const key of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_APP_URL'] as const) {
    const value = process.env[key];
    if (value && LOCALHOST_PATTERNS.some((p) => p.test(value))) {
      localhostUrls.push({ key, value });
    }
  }

  for (const key of ['STRIPE_PRICE_PRO', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_AGENCY'] as const) {
    const value = process.env[key];
    if (value && !value.startsWith('price_')) {
      invalidPriceIds.push(key);
    }
  }

  return { missing, localhostUrls, invalidPriceIds };
}

export function logEnvValidationWarnings(): void {
  const result = validateEnv();
  if (result.missing.length > 0) {
    console.warn('[env] Missing required variables:', result.missing.join(', '));
  }
  for (const { key, value } of result.localhostUrls) {
    console.warn(`[env] ${key} uses localhost (${value}) — Stripe webhooks/checkout require a public URL`);
  }
  if (result.invalidPriceIds.length > 0) {
    console.warn('[env] Invalid Stripe price IDs (must start with price_):', result.invalidPriceIds.join(', '));
  }
}
