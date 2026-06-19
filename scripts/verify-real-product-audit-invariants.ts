/**
 * Structural invariants supporting the real product audit.
 * Live UX must still be verified in the browser — this script does NOT replace human QA.
 *
 * Run: npx tsx scripts/verify-real-product-audit-invariants.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RECOMMENDED_PLAN_PRICES_USD } from '../lib/billing/planFeatures';
import { resolveSiteUrl } from '../lib/site/getSiteUrl';

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log('Real product audit — structural invariants\n');

// Re-use critical safety checks (subset of verify-product-qa-invariants)
const middleware = read('lib/supabase/middleware.ts');
assert(/isOwnerOnlyPath/.test(middleware), 'middleware owner-only path guard exists');

const ownerRoutes = read('app/dashboard/admin/owner/page.tsx');
assert(/isOwner/.test(ownerRoutes), 'Founder OS page checks isOwner');

const exec = read('lib/owner/outreachExecution.ts');
assert(/require_approval/.test(exec), 'outreach requires approval path exists');
assert(!/sendApprovedOutreach/.test(read('app/api/cron/prospect-discovery/route.ts')), 'cron does not auto-send outreach');

const filters = read('lib/owner/internalAccountFilters.ts');
assert(filters.includes('is_qa_account'), 'QA accounts excluded from metrics by code');
assert(filters.includes('test@gmail.com'), 'test@gmail.com excluded from founder metrics');

const planFeatures = read('lib/billing/planFeatures.ts');
assert(planFeatures.includes('No automated monitoring'), 'free tier does not promise continuous monitoring');
assert(RECOMMENDED_PLAN_PRICES_USD.pro === 79, 'Pro $79');
assert(RECOMMENDED_PLAN_PRICES_USD.growth === 149, 'Growth $149');
assert(RECOMMENDED_PLAN_PRICES_USD.agency === 299, 'Agency $299');

// Public nav isolation
const navbar = read('components/landing/Navbar.tsx');
assert(!/\/dashboard\/admin\/owner/.test(navbar), 'public navbar has no Founder OS link');

// Canonical / SEO — no preview URLs in metadata helpers
const metadata = read('lib/seo/metadata.ts');
const constants = read('lib/seo/constants.ts');
const siteUrl = resolveSiteUrl();
assert(!siteUrl.includes('vercel.app'), 'resolveSiteUrl is not a Vercel preview URL');
assert(!metadata.includes('vercel.app'), 'metadata helper has no hardcoded preview URL');
assert(!constants.includes('vercel.app'), 'SEO constants have no preview URL');

// Mobile-critical routes exist in codebase
for (const route of [
  'app/page.tsx',
  'app/pricing/page.tsx',
  'app/signup/page.tsx',
  'app/login/page.tsx',
  'app/scan/page.tsx',
  'app/scan-result/[id]/page.tsx',
]) {
  assert(existsSync(join(process.cwd(), route)), `route exists: ${route}`);
}

// Agency path — note production may lag until deploy
const hasAgencyPage = existsSync(join(process.cwd(), 'app/agency/page.tsx'));
if (hasAgencyPage) {
  assert(true, '/agency page present in repo (verify live after deploy)');
} else {
  console.log('NOTE: /agency page not in repo — live production returned 404 during audit');
}

const signup = read('app/signup/page.tsx');
if (/parseSignupPlanParam|parseSignupAttributionParams|signupPlanCopy/.test(signup)) {
  assert(true, 'signup plan=agency handling present in repo');
} else {
  console.log('NOTE: signup plan=agency not yet in repo — live signup showed generic copy during audit');
}

console.log('\nAll structural invariants passed.');
console.log('MANUAL-REVIEW: Live browser audit required for UX, mobile, and conversion (see audit doc).');
