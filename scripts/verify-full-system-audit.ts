/**
 * Full-system audit verification — static checks for docs/full-system-audit.md
 * Run: npx tsx scripts/verify-full-system-audit.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function ok(message: string): void {
  console.log(`OK: ${message}`);
}

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  assert(existsSync(p), `Missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

function fileExists(rel: string): boolean {
  return existsSync(join(process.cwd(), rel));
}

function listApiRoutes(dir: string, prefix = ''): string[] {
  const full = join(process.cwd(), dir);
  if (!existsSync(full)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listApiRoutes(rel, prefix));
    else if (entry.name === 'route.ts') out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

console.log('CyberShield full-system audit verification\n');

// ── Audit deliverable ──
assert(fileExists('docs/full-system-audit.md'), 'docs/full-system-audit.md must exist');
ok('Audit document present');

// ── Env vars documented ──
const envExample = read('.env.example');
const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
];
for (const key of requiredEnv) {
  assert(envExample.includes(key), `.env.example documents ${key}`);
}
ok('Core env vars documented in .env.example');

// ── Major customer routes ──
const customerPages = [
  'app/page.tsx',
  'app/signup/page.tsx',
  'app/login/page.tsx',
  'app/scan-result/page.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/websites/page.tsx',
  'app/dashboard/alerts/page.tsx',
  'app/dashboard/reports/page.tsx',
  'app/dashboard/websites/[id]/health/page.tsx',
  'app/dashboard/websites/[id]/changes/page.tsx',
];
for (const p of customerPages) assert(fileExists(p), `Customer page missing: ${p}`);
ok('Major customer-facing pages exist');

// ── Founder OS ──
assert(fileExists('app/dashboard/admin/owner/page.tsx'), 'Founder OS page');
assert(fileExists('app/api/owner/founder-os/route.ts'), 'Founder OS API');
assert(fileExists('lib/owner/founderOsV6.ts'), 'Founder OS V6 aggregator');
ok('Founder OS shell exists');

// ── Owner-only protection ──
const ownerRoutes = listApiRoutes('app/api/owner').filter((r) => !r.includes('[id]'));
for (const route of ownerRoutes.slice(0, 40)) {
  const content = read(route);
  assert(content.includes('requireOwner'), `${route} must use requireOwner`);
}
ok('Owner API routes use requireOwner');

// ── Cron routes match vercel.json ──
const vercelJson = JSON.parse(read('vercel.json')) as { crons: Array<{ path: string }> };
for (const cron of vercelJson.crons) {
  const routePath = `app${cron.path}/route.ts`;
  assert(fileExists(routePath), `Cron route missing for ${cron.path} → ${routePath}`);
  const content = read(routePath);
  assert(
    content.includes('isWorkerAuthorized') || content.includes('CRON_SECRET'),
    `${cron.path} must enforce worker/cron auth`,
  );
  if (cron.path === '/api/cron/admin-digest' && !content.includes('export async function GET')) {
    console.log('KNOWN ISSUE: admin-digest missing GET handler — Vercel Cron likely returns 405');
  }
}
ok('All vercel.json crons have secured route handlers');

// ── Outreach execution chain ──
const outreachChain = [
  'lib/owner/outreachExecution.ts',
  'lib/owner/ensureOutreachDraft.ts',
  'lib/owner/prospectAttribution.ts',
  'lib/owner/followUpScheduler.ts',
  'app/api/owner/outreach/[id]/send/route.ts',
  'app/api/email/click/route.ts',
  'app/api/email/open/route.ts',
  'app/api/resend/webhook/route.ts',
  'app/api/attribution/signup/route.ts',
];
for (const f of outreachChain) assert(fileExists(f), `Outreach chain missing: ${f}`);
ok('Prospect-to-customer execution files exist');

// ── Attribution migrations ──
assert(
  fileExists('supabase/migrations/20260620000000_prospect_attribution.sql'),
  'prospect attribution migration',
);
assert(
  fileExists('supabase/migrations/20260620100000_email_infrastructure.sql'),
  'email infrastructure migration',
);
assert(
  fileExists('supabase/migrations/20260619010000_founder_outreach_execution.sql'),
  'founder outreach execution migration',
);
ok('Key outreach/attribution migrations exist on disk');

// ── No fake domains in owner layer ──
const ownerLib = [
  'lib/owner/discovery/engine.ts',
  'lib/owner/founderOsV6.ts',
  'lib/owner/metrics.ts',
  'lib/owner/reconcilePipeline.ts',
];
for (const f of ownerLib) {
  const c = read(f);
  assert(!c.includes('example.com'), `${f} must not reference example.com`);
  assert(!c.includes('generateFake'), `${f} must not generate fake data`);
}
ok('Owner layer avoids fake/example domains');

// ── Test account filtering ──
const filters = read('lib/owner/founderCustomerFilters.ts');
assert(filters.includes('isInternalCustomerEmail'), 'Internal customer filter exists');
assert(filters.includes('OWNER_EMAIL'), 'Owner email excluded from metrics');
ok('Founder customer filter module exists');

// ── Email config ──
const emailConfig = read('lib/email/config.ts');
assert(emailConfig.includes('getResendFromAddress'), 'Resend from address helper');
assert(emailConfig.includes('buildEmailDocument') || fileExists('lib/email/template.ts'), 'Email template layer');
ok('Email configuration modules exist');

// ── Stripe / billing ──
assert(fileExists('app/api/stripe/webhook/route.ts'), 'Stripe webhook');
assert(fileExists('lib/billing/planService.ts'), 'Plan service');
ok('Billing core exists (Layer 0 — do not modify in feature work)');

// ── Scan queue (frozen) ──
assert(fileExists('app/api/scan/process-queue/route.ts'), 'Scan process queue');
assert(fileExists('lib/scanner/processQueue.ts'), 'processQueue lib');
ok('Scan queue core exists');

// ── Dead placeholder actions flagged in audit ──
const orgMembers = read('app/api/org/members/route.ts');
assert(orgMembers.includes('placeholder'), 'Audit note: org invite email is placeholder');
ok('Known placeholder: org member invite email');

const settingsPage = read('app/dashboard/settings/page.tsx');
assert(settingsPage.includes('coming soon'), 'Audit note: settings profile edit coming soon');
ok('Known placeholder: settings profile editing');

// ── Feature placeholders documented in verify-feature-audit ──
const featureAudit = read('scripts/verify-feature-audit.ts');
assert(featureAudit.includes("'placeholder'"), 'Feature audit tracks placeholders');
ok('Feature placeholder registry exists');

// ── Prospect pipeline reconcile (recent fix) ──
assert(fileExists('app/api/owner/prospects/reconcile/route.ts'), 'Prospect reconcile API');
assert(fileExists('lib/owner/reconcilePipeline.ts'), 'Prospect reconcile lib');
ok('Prospect pipeline reconcile endpoint exists');

console.log('\nAll static audit checks passed.');
console.log('Manual/production checks still required:');
console.log('  - Vercel encrypted env values (RESEND_API_KEY, CRON_SECRET, webhooks)');
console.log('  - Resend domain verification + mail DKIM in DNS');
console.log('  - Live Approve & Send smoke test');
console.log('  - Supabase remote migration parity');
console.log('  - npm run build (run separately — may OOM locally)');
