/**
 * Product honesty verification.
 *
 * Ensures customer-facing copy does not promise continuous monitoring to the
 * free tier (which is manual scans only) and that monitoring is consistently
 * framed as a paid capability.
 *
 * Run: npx tsx scripts/verify-product-honesty.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAN_LIMITS } from '../lib/billing/plans';
import { PLAN_MARKETING } from '../lib/billing/planFeatures';

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

console.log('CyberShield product honesty verification\n');

// ── Source of truth: free plan is manual-only ──
assert(PLAN_LIMITS.free.scanFrequency === 'manual', 'Free plan scanFrequency is manual');
ok('Free plan is manual scans only (plan limits)');

// ── Free marketing must not claim automated monitoring ──
const freeMarketing = PLAN_MARKETING.free;
assert(
  /no automated monitoring/i.test(freeMarketing.monitoringLabel),
  'Free marketing monitoringLabel states no automated monitoring',
);
const freeBlob = JSON.stringify(freeMarketing).toLowerCase();
assert(
  !/(continuous|automated|24\/7)\s+monitoring/.test(freeBlob) ||
    freeBlob.includes('no automated monitoring') ||
    freeBlob.includes('require upgrade'),
  'Free marketing does not promise continuous/automated monitoring',
);
assert(
  freeMarketing.bullets.some((b) => /upgrade/i.test(b)),
  'Free marketing clarifies monitoring/reports require upgrade',
);
ok('Free plan marketing is honest (no automated monitoring; upgrade clarified)');

// ── Paid plans correctly describe monitoring ──
assert(/daily/i.test(PLAN_MARKETING.pro.monitoringLabel), 'Pro describes daily monitoring');
assert(/hourly/i.test(PLAN_MARKETING.growth.monitoringLabel), 'Growth describes hourly monitoring');
assert(/5 min|priority/i.test(PLAN_MARKETING.agency.monitoringLabel), 'Agency describes priority monitoring');
ok('Paid plans accurately describe their monitoring cadence');

// ── No blatantly misleading free+continuous claims in customer copy ──
const customerCopyFiles = [
  'app/page.tsx',
  'components/landing/Hero.tsx',
  'components/landing/HowItWorks.tsx',
  'components/landing/CTA.tsx',
  'components/landing/Pricing.tsx',
  'app/signup/page.tsx',
  'app/pricing/page.tsx',
];

const BAD_PATTERNS = [
  /free\s+continuous\s+monitoring/i,
  /continuous\s+monitoring\s+(?:for\s+)?free/i,
  /monitoring\s+included\s+(?:for\s+)?free/i,
  /always[- ]on\s+monitoring\s+(?:for\s+)?free/i,
];

for (const file of customerCopyFiles) {
  const content = read(file);
  for (const pattern of BAD_PATTERNS) {
    assert(!pattern.test(content), `${file} contains misleading free-monitoring claim: ${pattern}`);
  }
}
ok('No misleading "free continuous monitoring" claims in customer copy');

// ── HowItWorks frames monitoring as paid ──
const howItWorks = read('components/landing/HowItWorks.tsx');
assert(
  /paid plan/i.test(howItWorks) && /free.*scan/i.test(howItWorks),
  'HowItWorks frames monitoring as a paid capability after the free scan',
);
ok('HowItWorks distinguishes free scan from paid monitoring');

// ── Dashboard monitoring card is plan-aware ──
const topRow = read('components/dashboard/DashboardV4TopRow.tsx');
assert(topRow.includes('monitoringEnabled'), 'Dashboard monitoring card is plan-aware');
assert(/manual scans only/i.test(topRow), 'Free dashboard clarifies manual scans only');
ok('Dashboard does not tell free users monitoring is active');

console.log('\nAll product honesty checks passed.');
console.log('\nNote: paid-plan continuous-monitoring claims are accurate and intentionally retained.');
