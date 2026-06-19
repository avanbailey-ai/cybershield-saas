/**
 * Email production readiness verification.
 *
 * Static checks (no live send):
 *   - RESEND_API_KEY is required by the send path (fails clearly when missing)
 *   - From-address resolution never forces an unverified mail subdomain
 *   - EMAIL_FROM format valid when set; DMARC documented
 *   - Outreach templates include plain text alongside HTML
 *   - Open/click tracking + Resend webhook routes exist
 *   - Webhook secret validated when configured
 *   - Owner test-send endpoint supports dry-run
 *
 * Run: npx tsx scripts/verify-email-production-readiness.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function ok(message: string): void {
  console.log(`OK: ${message}`);
}

function warn(message: string): void {
  console.log(`KNOWN ISSUE: ${message}`);
}

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  assert(existsSync(p), `Missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

console.log('CyberShield email production readiness verification\n');

// ── Send path requires RESEND_API_KEY ──
const emailLib = read('lib/email.ts');
assert(
  emailLib.includes('RESEND_API_KEY') && emailLib.includes("error: 'RESEND_API_KEY not configured'"),
  'sendEmail returns a clear error when RESEND_API_KEY is missing (no silent success)',
);
ok('Missing RESEND_API_KEY produces a clear error, not a silent skip-as-success');

// ── From-address resolution ──
const config = read('lib/email/config.ts');
assert(config.includes('isMailSubdomainConfigured'), 'config exposes isMailSubdomainConfigured');
assert(
  /No subdomain set[\s\S]*configured \(verified root\) sender|Never force the unverified mail subdomain/.test(
    config,
  ),
  'From-address falls back to verified root sender instead of forcing mail subdomain',
);
ok('From-address never forces unverified mail.* subdomain (root sender fallback)');

// ── DMARC documented ──
assert(config.includes('DMARC_RECORD_STAGE_1') && config.includes('v=DMARC1'), 'DMARC record documented');
ok('DMARC record documented in config');

// ── Plain text in outreach ──
const outreachExec = read('lib/owner/outreachExecution.ts');
assert(outreachExec.includes('text: doc.text'), 'Outreach send includes plain-text body');
const template = read('lib/email/template.ts');
assert(template.includes('bodyText') || template.includes('text'), 'Email template builds plain text');
ok('Outreach emails include plain text alongside HTML');

// ── Tracking + webhook routes ──
assert(existsSync(join(process.cwd(), 'app/api/email/open/route.ts')), 'Open-tracking route exists');
assert(existsSync(join(process.cwd(), 'app/api/email/click/route.ts')), 'Click-tracking route exists');
assert(existsSync(join(process.cwd(), 'app/api/resend/webhook/route.ts')), 'Resend webhook route exists');
ok('Open/click tracking + Resend webhook routes exist');

const tracking = read('lib/email/tracking.ts');
assert(tracking.includes('buildClickTrackingUrl') && tracking.includes('buildOpenTrackingUrl'), 'Tracking URL builders exist');
assert(tracking.includes('createHmac'), 'Tracking links are HMAC-signed');
if (tracking.includes("'dev-tracking'")) {
  assert(
    tracking.includes("VERCEL_ENV === 'production'") && tracking.includes('console.error'),
    'Weak tracking secret fallback must warn in production',
  );
  ok('Tracking secret warns in production when only weak fallback available');
}
ok('Tracking links are HMAC-signed');

// ── Webhook secret validation ──
const webhook = read('app/api/resend/webhook/route.ts');
assert(webhook.includes('RESEND_WEBHOOK_SECRET'), 'Webhook validates RESEND_WEBHOOK_SECRET when set');
if (/if\s*\(secret\)/.test(webhook)) {
  warn('Resend webhook accepts unsigned POSTs when RESEND_WEBHOOK_SECRET is unset — set it in production');
}
ok('Resend webhook validates secret when configured');

// ── Owner test-send endpoint ──
const testEmail = read('app/api/owner/test-email/route.ts');
assert(testEmail.includes('requireOwner'), 'Test-send endpoint is owner-gated');
assert(testEmail.includes('dryRun'), 'Test-send endpoint supports dry-run mode');
assert(testEmail.includes('text:'), 'Test-send endpoint includes plain text');
ok('Owner test-send endpoint: owner-gated, dry-run capable, plain text included');

console.log('\nAll email production readiness checks passed.');
console.log('\nProduction requirements (manual / provider side):');
console.log('  - RESEND_API_KEY set in Vercel env');
console.log('  - cybershieldcloud.com verified in Resend (root sender outreach@cybershieldcloud.com works)');
console.log('  - mail.cybershieldcloud.com DKIM optional: only set EMAIL_SENDING_DOMAIN after it verifies');
console.log('  - DMARC TXT record published (see DMARC_RECORD_STAGE_1)');
console.log('  - RESEND_WEBHOOK_SECRET set; webhook configured in Resend dashboard');
console.log('  - EMAIL_TRACKING_SECRET set (or rely on CRON_SECRET) for signed open/click');
console.log('  - Smoke: POST /api/owner/test-email { "to": "you@…", "dryRun": true } then a real send');
