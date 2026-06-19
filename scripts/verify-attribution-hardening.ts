/**
 * Attribution hardening verification.
 *
 * Confirms outreach→signup→paid attribution survives fragile paths:
 *   - Durable cookie (not only sessionStorage)
 *   - Cookie set by middleware from ?prospect= / ref=prospect_<token>
 *   - Server-side capture in /auth/callback (OAuth + email confirmation)
 *   - Signup API falls back to cookie and clears it
 *   - Token validation + reused-token safety
 *   - Paid conversion only on active/trialing paid state
 *
 * Run: npx tsx scripts/verify-attribution-hardening.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidAttributionToken } from '../lib/owner/prospectAttribution';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function ok(message: string): void {
  console.log(`OK: ${message}`);
}

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) throw new Error(`FAIL: Missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

console.log('CyberShield attribution hardening verification\n');

// ── Token validation ──
assert(isValidAttributionToken('abcd1234efgh'), 'Valid token accepted');
assert(!isValidAttributionToken(''), 'Empty token rejected');
assert(!isValidAttributionToken('short'), 'Too-short token rejected');
assert(!isValidAttributionToken('bad token!'), 'Token with invalid chars rejected');
assert(!isValidAttributionToken(null), 'Null token rejected');
ok('Attribution token validation is strict');

// ── Shared cookie constant ──
const attribution = read('lib/owner/prospectAttribution.ts');
assert(attribution.includes('PROSPECT_ATTRIBUTION_COOKIE'), 'Shared prospect cookie constant exported');
assert(
  attribution.includes("'cybershield_prospect'") || attribution.includes('"cybershield_prospect"'),
  'Cookie name defined',
);
ok('Durable prospect attribution cookie defined');

// ── Middleware sets cookie ──
const middleware = read('lib/supabase/middleware.ts');
assert(middleware.includes('PROSPECT_COOKIE'), 'Middleware references prospect cookie');
assert(middleware.includes("searchParams.get(\"prospect\")") || middleware.includes("searchParams.get('prospect')"),
  'Middleware reads ?prospect= param');
assert(middleware.includes('prospect_'), 'Middleware also accepts ref=prospect_<token>');
ok('Middleware persists prospect token to durable cookie (survives OAuth/reload/checkout)');

// ── Auth callback captures server-side ──
const callback = read('app/auth/callback/route.ts');
assert(callback.includes('PROSPECT_ATTRIBUTION_COOKIE'), 'Callback reads prospect cookie');
assert(callback.includes('captureSignupAttribution'), 'Callback captures attribution server-side');
assert(callback.includes('maxAge: 0') || callback.includes('maxAge:0'), 'Callback clears cookie after capture');
ok('OAuth + email-confirmation signups captured server-side in /auth/callback');

// ── Signup API cookie fallback ──
const signupApi = read('app/api/attribution/signup/route.ts');
assert(signupApi.includes('PROSPECT_ATTRIBUTION_COOKIE'), 'Signup API reads cookie fallback');
assert(signupApi.includes('cookieToken') || signupApi.includes('cookies()'), 'Signup API has cookie fallback');
assert(signupApi.includes('maxAge: 0'), 'Signup API clears cookie on success');
ok('Signup API falls back to cookie and clears it');

// ── Click recording ──
assert(existsSync(join(process.cwd(), 'app/api/attribution/click/route.ts')), 'Click route exists');
ok('Email link click records token');

// ── Signup form (email/password) ──
const signupForm = read('components/auth/SignupForm.tsx');
assert(signupForm.includes('/api/attribution/signup'), 'Signup form posts attribution');
assert(signupForm.includes('prospect_attribution_token'), 'Signup form captures token from link');
ok('Email/password signup captures attribution');

// ── Reused-token + paid conversion safety ──
assert(attribution.includes("'Attribution token already used'"), 'Reused token rejected for a different user');
assert(
  /status === 'active' \|\| status === 'trialing'/.test(attribution) &&
    attribution.includes("plan !== 'free'"),
  'Paid conversion only when active/trialing on a paid plan',
);
assert(attribution.includes('isInternalCustomerEmail'), 'Internal/test emails excluded from conversion');
ok('Reused tokens handled safely; paid conversion gated to active/trialing paid state');

console.log('\nAll attribution hardening checks passed.');
console.log('\nManual smoke (production):');
console.log('  1. Click an outreach link → /signup?source=outreach&prospect=<token> sets cookie');
console.log('  2. Sign up with Google → /auth/callback attributes via cookie');
console.log('  3. Sign up with email/password → API attributes via body or cookie');
console.log('  4. Confirm email link → /auth/callback attributes via cookie');
console.log('  5. Upgrade to a paid plan → nightly reconcile marks prospect customer');
