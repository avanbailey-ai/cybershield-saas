/**
 * Production browser security headers for CyberShield Cloud.
 * Applied globally via next.config.ts — do not duplicate in middleware.
 *
 * CSP exceptions documented:
 * - style-src 'unsafe-inline': required for Next.js / Tailwind runtime styles
 * - script-src 'unsafe-inline' https: : required for Next.js chunks + Stripe.js CDN
 * - connect-src https: wss: : Supabase auth/API, Stripe API, same-origin fetches
 * - frame-src Stripe hosts: Checkout / Elements embedded frames
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://*.stripe.com",
  "upgrade-insecure-requests",
].join('; ');

export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=()';

export const SECURITY_HEADER_ENTRIES: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
];

/** Next.js headers() config shape */
export function productionSecurityHeadersForNextConfig(): Array<{
  source: string;
  headers: Array<{ key: string; value: string }>;
}> {
  return [
    {
      source: '/:path*',
      headers: [...SECURITY_HEADER_ENTRIES],
    },
  ];
}
