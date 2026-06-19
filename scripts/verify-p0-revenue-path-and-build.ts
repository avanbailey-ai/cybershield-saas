/**
 * P0 revenue path + build stability verification.
 * Run: npx tsx scripts/verify-p0-revenue-path-and-build.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAgencyAttributionUrl, buildAttributionSignupUrl } from '../lib/owner/prospectAttribution';
import { RECOMMENDED_PLAN_PRICES_USD } from '../lib/billing/planFeatures';
import { parseSignupAttributionParams, parseSignupPlanParam } from '../lib/conversion/signupPlanContext';

const root = process.cwd();
function read(rel: string): string {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error(`FAIL: missing ${rel}`);
    process.exit(1);
  }
  return readFileSync(p, 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log('P0 revenue path + build stability verification\n');

// Routes
assert(existsSync(join(root, 'app/agency/page.tsx')), '/agency page exists');
assert(existsSync(join(root, 'app/agencies/page.tsx')), '/agencies route exists');
const agenciesPage = read('app/agencies/page.tsx');
assert(/redirect\s*\([^)]*\/agency/.test(agenciesPage), '/agencies redirects to /agency');

const agencyPage = read('app/agency/page.tsx');
assert(agencyPage.includes('AgencyLandingPage'), '/agency renders agency landing component');

const summaryPage = read('app/summary/page.tsx');
assert(summaryPage.includes('loadPublicProspectSummary'), '/summary uses public prospect summary loader');
assert(summaryPage.includes('force-dynamic'), '/summary is force-dynamic (no static Supabase at build)');

// Signup plan=agency
const signupPage = read('app/signup/page.tsx');
assert(signupPage.includes('parseSignupAttributionParams'), 'signup page parses attribution params');
assert(signupPage.includes('signupPlanCopy'), 'signup page uses plan-aware copy');

const signupForm = read('components/auth/SignupForm.tsx');
assert(signupForm.includes('initialPlan'), 'SignupForm accepts initial plan');
assert(signupForm.includes('parseSignupAttributionParams'), 'SignupForm preserves attribution');

assert(parseSignupPlanParam('agency') === 'agency', 'parseSignupPlanParam accepts agency');
assert(parseSignupPlanParam('pro') === 'pro', 'parseSignupPlanParam accepts pro');
assert(parseSignupPlanParam('growth') === 'growth', 'parseSignupPlanParam accepts growth');

const sp = new URLSearchParams('plan=agency&source=agency_outreach&prospect=abc12345_xyz');
const parsed = parseSignupAttributionParams(sp);
assert(parsed.plan === 'agency' && parsed.hasValidProspect, 'signup parses plan=agency + valid prospect');

const bad = parseSignupAttributionParams(new URLSearchParams('prospect=!!!invalid!!!'));
assert(!bad.hasValidProspect, 'invalid prospect token rejected');

// Outreach CTA → summary
const agencyUrl = buildAgencyAttributionUrl('TESTTOKEN12345');
assert(/\/summary\?/.test(agencyUrl), 'agency outreach CTA points to /summary');
assert(/plan=agency/.test(agencyUrl), 'agency CTA includes plan=agency');

const smbUrl = buildAttributionSignupUrl('TESTTOKEN12345');
assert(/\/summary\?/.test(smbUrl), 'SMB outreach CTA points to /summary');

// Pricing
assert(RECOMMENDED_PLAN_PRICES_USD.pro === 79, 'Pro price $79');
assert(RECOMMENDED_PLAN_PRICES_USD.growth === 149, 'Growth price $149');
assert(RECOMMENDED_PLAN_PRICES_USD.agency === 299, 'Agency price $299');

const pricing = read('components/landing/Pricing.tsx');
assert(!/\$49|\$99|\$199/.test(pricing), 'no legacy pricing literals in Pricing component');
assert(/planParam === 'agency'/.test(pricing), 'Pricing honors plan=agency highlight');

// Founder OS not exposed on public nav
const navbar = read('components/landing/Navbar.tsx');
assert(!/\/dashboard\/admin\/owner/.test(navbar), 'public nav has no Founder OS link');
assert(navbar.includes('href="/agency"'), 'Navbar links to /agency');

// No auto-send
const exec = read('lib/owner/outreachExecution.ts');
assert(/require_approval/.test(exec), 'outreach execution respects require_approval');

// QA exclusion
const filters = read('lib/owner/internalAccountFilters.ts');
assert(filters.includes('is_qa_account'), 'QA accounts excluded via is_qa_account flag');
assert(filters.includes('test@gmail.com'), 'test@gmail.com excluded from metrics');

// Build config
const nextConfig = read('next.config.ts');
assert(nextConfig.includes('webpackMemoryOptimizations'), 'webpack memory optimizations enabled');
assert(nextConfig.includes('ignoreDuringBuilds: true'), 'eslint skipped during build (run separately)');

// Agency landing content
const agencyLanding = read('components/landing/AgencyLandingPage.tsx');
assert(agencyLanding.includes('$299') || agencyLanding.includes('AGENCY_PRICE'), 'agency landing shows $299');
assert(agencyLanding.includes('appendAttributionQuery'), 'agency CTAs preserve attribution params');

console.log('\nAll P0 revenue path + build checks passed.');
